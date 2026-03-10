"""Application service for Connection layer."""

from sqlalchemy.exc import IntegrityError

from app.repositories.connection import ConnectionRepository
from app.schemas.connection import (
    ConnectionAutogenerateRequest,
    ConnectionCreateRequest,
    ConnectionPatchRequest,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.graph_topology_validation_service import GraphTopologyValidationService
from app.services.project_service import ProjectService


class ConnectionService:
    """Use-cases for lane-level transitions through node."""

    def __init__(
        self,
        connection_repository: ConnectionRepository,
        project_service: ProjectService,
        topology_validation_service: GraphTopologyValidationService,
    ):
        self._connection_repository = connection_repository
        self._project_service = project_service
        self._topology = topology_validation_service

    def create(self, project_id: str, payload: ConnectionCreateRequest):
        self._topology.validate_connection_payload(
            project_id=project_id,
            via_node_id=payload.via_node_id,
            from_edge_id=payload.from_edge_id,
            to_edge_id=payload.to_edge_id,
            from_lane_index=payload.from_lane_index,
            to_lane_index=payload.to_lane_index,
        )

        if self._connection_repository.exists_duplicate(
            project_id=project_id,
            from_edge_id=payload.from_edge_id,
            to_edge_id=payload.to_edge_id,
            from_lane_index=payload.from_lane_index,
            to_lane_index=payload.to_lane_index,
        ):
            raise ConflictError("Connection with the same from/to edges and lane indexes already exists")

        try:
            return self._connection_repository.create(
                project_id=project_id,
                via_node_id=payload.via_node_id,
                from_edge_id=payload.from_edge_id,
                to_edge_id=payload.to_edge_id,
                from_lane_index=payload.from_lane_index,
                to_lane_index=payload.to_lane_index,
                uncontrolled=payload.uncontrolled,
            )
        except IntegrityError as exc:
            self._connection_repository.rollback()
            raise ConflictError("Connection create violates constraints") from exc

    def get(self, project_id: str, connection_id: str):
        self._project_service.get(project_id)
        connection = self._connection_repository.get_in_project(project_id, connection_id)
        if connection is None:
            raise NotFoundError(f"Connection '{connection_id}' not found in project '{project_id}'")
        return connection

    def delete(self, project_id: str, connection_id: str) -> None:
        connection = self.get(project_id, connection_id)
        self._connection_repository.delete(connection)

    def patch(self, project_id: str, connection_id: str, payload: ConnectionPatchRequest):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        connection = self.get(project_id, connection_id)
        update_data = payload.model_dump(exclude_unset=True)
        try:
            return self._connection_repository.update(connection, **update_data)
        except IntegrityError as exc:
            self._connection_repository.rollback()
            raise ConflictError("Connection update violates constraints") from exc

    def list_by_node(self, project_id: str, node_id: str) -> dict[str, object]:
        node, incoming_edges, outgoing_edges = self._topology.get_node_directional_edges(project_id, node_id)
        connections = self._connection_repository.list_by_node(project_id, node_id)
        return {
            "node": node,
            "incoming_edges": incoming_edges,
            "outgoing_edges": outgoing_edges,
            "connections": connections,
        }

    def list_for_pair(
        self,
        project_id: str,
        *,
        from_edge_id: str,
        to_edge_id: str,
        via_node_id: str | None = None,
    ):
        self._project_service.get(project_id)
        return self._connection_repository.list_for_pair(
            project_id,
            from_edge_id=from_edge_id,
            to_edge_id=to_edge_id,
            via_node_id=via_node_id,
        )

    def get_candidates(self, project_id: str, node_id: str) -> dict[str, object]:
        return self._topology.build_candidates(project_id, node_id)

    def autogenerate_for_node(
        self,
        project_id: str,
        node_id: str,
        payload: ConnectionAutogenerateRequest,
    ) -> dict[str, object]:
        if not payload.add_missing_only:
            raise ValidationError("MVP supports only add_missing_only=true autogeneration")

        candidates = self._topology.build_candidates(project_id, node_id)
        incoming_edges = {edge.id: edge for edge in candidates["incoming_edges"]}
        outgoing_edges = {edge.id: edge for edge in candidates["outgoing_edges"]}

        create_items: list[dict[str, object]] = []
        skipped_duplicates = 0
        skipped_u_turns = 0

        for pair in candidates["valid_pairs"]:
            from_edge_id = str(pair["from_edge_id"])
            to_edge_id = str(pair["to_edge_id"])
            is_u_turn = bool(pair["is_u_turn"])

            if is_u_turn and not payload.allow_u_turns:
                skipped_u_turns += 1
                continue

            from_edge = incoming_edges[from_edge_id]
            to_edge = outgoing_edges[to_edge_id]
            lane_mapping_count = min(len(from_edge.lanes), len(to_edge.lanes))
            for index in range(lane_mapping_count):
                if self._connection_repository.exists_duplicate(
                    project_id=project_id,
                    from_edge_id=from_edge_id,
                    to_edge_id=to_edge_id,
                    from_lane_index=index,
                    to_lane_index=index,
                ):
                    skipped_duplicates += 1
                    continue

                create_items.append(
                    {
                        "project_id": project_id,
                        "via_node_id": node_id,
                        "from_edge_id": from_edge_id,
                        "to_edge_id": to_edge_id,
                        "from_lane_index": index,
                        "to_lane_index": index,
                        "uncontrolled": payload.uncontrolled,
                    }
                )

        try:
            created_connections = self._connection_repository.bulk_create(create_items) if create_items else []
        except IntegrityError as exc:
            self._connection_repository.rollback()
            raise ConflictError("Connection autogeneration violates constraints") from exc

        diagnostics = list(candidates["diagnostics"])
        diagnostics.append(f"created={len(created_connections)}")
        diagnostics.append(f"skipped_duplicates={skipped_duplicates}")
        diagnostics.append(f"skipped_u_turns={skipped_u_turns}")

        return {
            "node_id": node_id,
            "considered_pairs": len(candidates["valid_pairs"]),
            "created_count": len(created_connections),
            "skipped_duplicates": skipped_duplicates,
            "skipped_u_turns": skipped_u_turns,
            "created_connections": created_connections,
            "diagnostics": diagnostics,
        }
