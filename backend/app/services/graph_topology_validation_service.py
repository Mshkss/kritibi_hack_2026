"""Topology validation utilities for node connection layer."""

from app.models.edge import EdgeModel
from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.services.errors import NotFoundError, ValidationError
from app.services.project_service import ProjectService


class GraphTopologyValidationService:
    """Validates edge/lane/node topology rules for connections."""

    def __init__(
        self,
        project_service: ProjectService,
        node_repository: NodeRepository,
        edge_repository: EdgeRepository,
    ):
        self._project_service = project_service
        self._node_repository = node_repository
        self._edge_repository = edge_repository

    def validate_connection_payload(
        self,
        *,
        project_id: str,
        via_node_id: str,
        from_edge_id: str,
        to_edge_id: str,
        from_lane_index: int,
        to_lane_index: int,
    ) -> dict[str, object]:
        node = self._get_node_or_404(project_id, via_node_id)
        from_edge = self._get_edge_or_404(project_id, from_edge_id, role="from_edge")
        to_edge = self._get_edge_or_404(project_id, to_edge_id, role="to_edge")

        shared_node_id = from_edge.to_node_id
        if shared_node_id != to_edge.from_node_id:
            raise ValidationError("from_edge and to_edge are not connected through a single node")
        if shared_node_id != via_node_id:
            raise ValidationError("via_node_id must match shared node of from_edge/to_edge")

        self.validate_lane_index_exists(from_edge, from_lane_index, role="from_lane_index")
        self.validate_lane_index_exists(to_edge, to_lane_index, role="to_lane_index")

        return {
            "node": node,
            "from_edge": from_edge,
            "to_edge": to_edge,
            "is_u_turn": self.is_u_turn(from_edge, to_edge),
        }

    def get_node_directional_edges(self, project_id: str, node_id: str):
        node = self._get_node_or_404(project_id, node_id)
        incoming = self._edge_repository.list_incoming_for_node(project_id, node_id)
        outgoing = self._edge_repository.list_outgoing_for_node(project_id, node_id)
        return node, incoming, outgoing

    def build_candidates(
        self,
        project_id: str,
        node_id: str,
    ) -> dict[str, object]:
        node, incoming, outgoing = self.get_node_directional_edges(project_id, node_id)

        valid_pairs: list[dict[str, object]] = []
        invalid_pairs: list[dict[str, object]] = []
        diagnostics: list[str] = []
        u_turn_pairs = 0

        for from_edge in incoming:
            for to_edge in outgoing:
                if from_edge.id == to_edge.id:
                    invalid_pairs.append(
                        {
                            "from_edge_id": from_edge.id,
                            "from_edge_code": from_edge.code,
                            "to_edge_id": to_edge.id,
                            "to_edge_code": to_edge.code,
                            "reason": "same edge pair is not allowed",
                        }
                    )
                    continue

                lane_mapping_count = min(len(from_edge.lanes), len(to_edge.lanes))
                if lane_mapping_count <= 0:
                    invalid_pairs.append(
                        {
                            "from_edge_id": from_edge.id,
                            "from_edge_code": from_edge.code,
                            "to_edge_id": to_edge.id,
                            "to_edge_code": to_edge.code,
                            "reason": "lane mapping impossible because one edge has no lanes",
                        }
                    )
                    continue

                is_u_turn = self.is_u_turn(from_edge, to_edge)
                if is_u_turn:
                    u_turn_pairs += 1

                valid_pairs.append(
                    {
                        "from_edge_id": from_edge.id,
                        "from_edge_code": from_edge.code,
                        "to_edge_id": to_edge.id,
                        "to_edge_code": to_edge.code,
                        "is_u_turn": is_u_turn,
                        "lane_mapping_count": lane_mapping_count,
                    }
                )

        diagnostics.append(
            f"incoming={len(incoming)}, outgoing={len(outgoing)}, candidate_pairs={len(incoming) * len(outgoing)}"
        )
        diagnostics.append(f"valid_pairs={len(valid_pairs)}, invalid_pairs={len(invalid_pairs)}")
        diagnostics.append(f"u_turn_pairs={u_turn_pairs}")

        return {
            "node": node,
            "incoming_edges": incoming,
            "outgoing_edges": outgoing,
            "valid_pairs": valid_pairs,
            "invalid_pairs": invalid_pairs,
            "diagnostics": diagnostics,
        }

    def validate_lane_index_exists(self, edge: EdgeModel, lane_index: int, *, role: str) -> None:
        lane_indexes = {lane.index for lane in edge.lanes}
        if lane_index not in lane_indexes:
            joined = ", ".join(str(idx) for idx in sorted(lane_indexes))
            raise ValidationError(
                f"{role}={lane_index} does not exist on edge '{edge.id}', available indexes: [{joined}]"
            )

    def is_u_turn(self, from_edge: EdgeModel, to_edge: EdgeModel) -> bool:
        return from_edge.from_node_id == to_edge.to_node_id

    def _get_node_or_404(self, project_id: str, node_id: str):
        self._project_service.get(project_id)
        node = self._node_repository.get_in_project(project_id, node_id)
        if node is None:
            raise NotFoundError(f"Node '{node_id}' not found in project '{project_id}'")
        return node

    def _get_edge_or_404(self, project_id: str, edge_id: str, *, role: str):
        edge = self._edge_repository.get_in_project(project_id, edge_id)
        if edge is None:
            raise NotFoundError(f"{role} '{edge_id}' not found in project '{project_id}'")
        return edge
