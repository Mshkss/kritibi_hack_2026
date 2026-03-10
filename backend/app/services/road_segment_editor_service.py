"""Road segment editor business logic."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.repositories.connection import ConnectionRepository
from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.repositories.road_type import RoadTypeRepository
from app.schemas.edge_editor import (
    ApplyRoadTypeRequest,
    EdgePatchRequest,
    EdgeShapePatchRequest,
    LanePatchRequest,
    LaneReplaceListRequest,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.geometry_service import GeometryService, GeometryValidationError
from app.services.lane_validation_service import LaneValidationService
from app.services.project_service import ProjectService


class RoadSegmentEditorService:
    """Use-cases for edge editor operations."""

    def __init__(
        self,
        edge_repository: EdgeRepository,
        connection_repository: ConnectionRepository,
        node_repository: NodeRepository,
        road_type_repository: RoadTypeRepository,
        project_service: ProjectService,
        geometry_service: GeometryService,
        lane_validation_service: LaneValidationService,
    ):
        self._edge_repository = edge_repository
        self._connection_repository = connection_repository
        self._node_repository = node_repository
        self._road_type_repository = road_type_repository
        self._project_service = project_service
        self._geometry_service = geometry_service
        self._lane_validation = lane_validation_service

    def get_editor_card(self, project_id: str, edge_id: str) -> dict[str, object]:
        edge = self._get_edge_or_404(project_id, edge_id)
        road_type = None
        if edge.road_type_id:
            road_type = self._road_type_repository.get_in_project(project_id, edge.road_type_id)
        return {"edge": edge, "road_type": road_type}

    def patch_edge(self, project_id: str, edge_id: str, payload: EdgePatchRequest):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        edge = self._get_edge_or_404(project_id, edge_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "speed" in update_data and update_data["speed"] is not None and float(update_data["speed"]) <= 0:
            raise ValidationError("speed must be > 0")
        if "width" in update_data and update_data["width"] is not None and float(update_data["width"]) <= 0:
            raise ValidationError("width must be > 0")
        if "length" in update_data and update_data["length"] is not None and float(update_data["length"]) <= 0:
            raise ValidationError("length must be > 0")
        if "sidewalk_width" in update_data and update_data["sidewalk_width"] is not None and float(update_data["sidewalk_width"]) < 0:
            raise ValidationError("sidewalk_width must be >= 0")

        if "road_type_id" in update_data and update_data["road_type_id"] is not None:
            road_type = self._road_type_repository.get_in_project(project_id, str(update_data["road_type_id"]))
            if road_type is None:
                raise NotFoundError(f"RoadType '{update_data['road_type_id']}' not found in project '{project_id}'")

        if "shape" in update_data:
            from_node, to_node = self._get_edge_nodes(project_id, edge)
            try:
                normalized_shape, computed_length = self._geometry_service.normalize_shape(
                    update_data["shape"],
                    from_x=from_node.x,
                    from_y=from_node.y,
                    to_x=to_node.x,
                    to_y=to_node.y,
                )
            except GeometryValidationError as exc:
                raise ValidationError(str(exc)) from exc

            update_data["shape"] = normalized_shape
            if "length" not in update_data or update_data["length"] is None:
                update_data["length"] = computed_length

        try:
            return self._edge_repository.update(edge, **update_data)
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("Edge update violates constraints") from exc

    def patch_shape(self, project_id: str, edge_id: str, payload: EdgeShapePatchRequest):
        edge = self._get_edge_or_404(project_id, edge_id)
        from_node, to_node = self._get_edge_nodes(project_id, edge)

        try:
            normalized_shape, computed_length = self._geometry_service.normalize_shape(
                payload.shape,
                from_x=from_node.x,
                from_y=from_node.y,
                to_x=to_node.x,
                to_y=to_node.y,
            )
        except GeometryValidationError as exc:
            raise ValidationError(str(exc)) from exc

        return self._edge_repository.update(edge, shape=normalized_shape, length=computed_length)

    def recalculate_length(self, project_id: str, edge_id: str):
        edge = self._get_edge_or_404(project_id, edge_id)
        from_node, to_node = self._get_edge_nodes(project_id, edge)

        try:
            normalized_shape, computed_length = self._geometry_service.sync_shape_endpoints(
                edge.shape,
                from_x=from_node.x,
                from_y=from_node.y,
                to_x=to_node.x,
                to_y=to_node.y,
            )
        except GeometryValidationError as exc:
            raise ValidationError(str(exc)) from exc

        return self._edge_repository.update(edge, shape=normalized_shape, length=computed_length)

    def replace_lanes(self, project_id: str, edge_id: str, payload: LaneReplaceListRequest):
        edge = self._get_edge_or_404(project_id, edge_id)

        lane_dicts = [lane.model_dump() for lane in payload.lanes]
        normalized_lanes = self._lane_validation.validate_lane_replace_list(lane_dicts)
        resulting_indexes = {int(item["index"]) for item in normalized_lanes}
        self._assert_lane_change_connection_safe(project_id, edge.id, resulting_indexes=resulting_indexes)

        try:
            return self._edge_repository.replace_lanes(edge, normalized_lanes)
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("Lane replacement violates constraints") from exc

    def patch_lane(self, project_id: str, edge_id: str, lane_id: str, payload: LanePatchRequest):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        edge = self._get_edge_or_404(project_id, edge_id)
        lane = self._edge_repository.get_lane_in_edge(edge.id, lane_id)
        if lane is None:
            raise NotFoundError(f"Lane '{lane_id}' not found in edge '{edge_id}'")

        patch_data = payload.model_dump(exclude_unset=True)
        normalized_patch = self._lane_validation.validate_lane_patch(
            current_allow=lane.allow,
            current_disallow=lane.disallow,
            patch=patch_data,
        )

        if "index" in normalized_patch:
            new_index = int(normalized_patch["index"])
            existing_indexes = {item.index for item in edge.lanes if item.id != lane.id}
            if new_index in existing_indexes:
                raise ValidationError(f"Lane index {new_index} already exists in edge")
            resulting_indexes = set(existing_indexes)
            resulting_indexes.add(new_index)
            self._assert_lane_change_connection_safe(project_id, edge.id, resulting_indexes=resulting_indexes)

        try:
            self._edge_repository.update_lane(lane, commit=False, **normalized_patch)
            self._edge_repository.commit()
            return self._get_edge_or_404(project_id, edge_id)
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("Lane update violates constraints") from exc

    def apply_road_type(self, project_id: str, edge_id: str, payload: ApplyRoadTypeRequest):
        edge = self._get_edge_or_404(project_id, edge_id)
        road_type = self._road_type_repository.get_in_project(project_id, payload.road_type_id)
        if road_type is None:
            raise NotFoundError(f"RoadType '{payload.road_type_id}' not found in project '{project_id}'")

        speed = payload.speed if payload.speed is not None else road_type.speed
        priority = payload.priority if payload.priority is not None else road_type.priority
        width = payload.width if payload.width is not None else road_type.width
        sidewalk_width = payload.sidewalk_width if payload.sidewalk_width is not None else road_type.sidewalk_width

        if speed is not None and speed <= 0:
            raise ValidationError("speed must be > 0")
        if width is not None and width <= 0:
            raise ValidationError("width must be > 0")
        if sidewalk_width is not None and sidewalk_width < 0:
            raise ValidationError("sidewalk_width must be >= 0")
        if payload.lane_speed is not None and payload.lane_speed <= 0:
            raise ValidationError("lane_speed must be > 0")
        if payload.lane_width is not None and payload.lane_width <= 0:
            raise ValidationError("lane_width must be > 0")

        try:
            edge = self._edge_repository.update(
                edge,
                commit=False,
                road_type_id=road_type.id,
                speed=speed,
                priority=priority,
                width=width,
                sidewalk_width=sidewalk_width,
            )

            if payload.apply_to_lanes:
                lane_speed = payload.lane_speed if payload.lane_speed is not None else speed
                lane_width = payload.lane_width if payload.lane_width is not None else width

                lanes = [
                    {
                        "index": lane.index,
                        "allow": lane.allow,
                        "disallow": lane.disallow,
                        "speed": lane_speed if lane_speed is not None else lane.speed,
                        "width": lane_width if lane_width is not None else lane.width,
                    }
                    for lane in edge.lanes
                ]
                normalized_lanes = self._lane_validation.validate_lane_replace_list(lanes)
                edge = self._edge_repository.replace_lanes(edge, normalized_lanes, commit=False)

            self._edge_repository.commit()
            return self._get_edge_or_404(project_id, edge_id)
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("apply-road-type violates constraints") from exc

    def _get_edge_or_404(self, project_id: str, edge_id: str):
        self._project_service.get(project_id)
        edge = self._edge_repository.get_in_project(project_id, edge_id)
        if edge is None:
            raise NotFoundError(f"Edge '{edge_id}' not found in project '{project_id}'")
        return edge

    def _get_edge_nodes(self, project_id: str, edge):
        from_node = self._node_repository.get_in_project(project_id, edge.from_node_id)
        if from_node is None:
            raise NotFoundError(f"from_node '{edge.from_node_id}' not found in project '{project_id}'")

        to_node = self._node_repository.get_in_project(project_id, edge.to_node_id)
        if to_node is None:
            raise NotFoundError(f"to_node '{edge.to_node_id}' not found in project '{project_id}'")

        return from_node, to_node

    def _assert_lane_change_connection_safe(
        self,
        project_id: str,
        edge_id: str,
        *,
        resulting_indexes: set[int],
    ) -> None:
        connections = self._connection_repository.list_for_edge(project_id, edge_id)
        broken: list[str] = []

        for connection in connections:
            if connection.from_edge_id == edge_id and connection.from_lane_index not in resulting_indexes:
                broken.append(connection.id)
            if connection.to_edge_id == edge_id and connection.to_lane_index not in resulting_indexes:
                broken.append(connection.id)

        if broken:
            joined = ", ".join(sorted(set(broken)))
            raise ValidationError(
                "Lane change would invalidate existing connections. "
                f"Update/delete these connections first: {joined}"
            )
