"""Business operations for edges and lanes."""

from __future__ import annotations

from copy import deepcopy

from sqlalchemy.exc import IntegrityError

from app.repositories.edge import EdgeRepository
from app.repositories.node import NodeRepository
from app.repositories.road_type import RoadTypeRepository
from app.schemas.edge import (
    EdgeBidirectionalCreate,
    EdgeCreate,
    EdgeRoadTypePatch,
    EdgeShapePatch,
    EdgeUpdate,
    LaneUpsert,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.geometry_service import GeometryService, GeometryValidationError
from app.services.lane_validation_service import LaneValidationService
from app.services.project_service import ProjectService


class EdgeService:
    """Application service for road graph edge operations."""

    def __init__(
        self,
        edge_repository: EdgeRepository,
        node_repository: NodeRepository,
        road_type_repository: RoadTypeRepository,
        project_service: ProjectService,
        geometry_service: GeometryService,
        lane_validation_service: LaneValidationService,
    ):
        self._edge_repository = edge_repository
        self._node_repository = node_repository
        self._road_type_repository = road_type_repository
        self._project_service = project_service
        self._geometry_service = geometry_service
        self._lane_validation = lane_validation_service

    def create_directed(self, project_id: str, payload: EdgeCreate):
        self._project_service.get(project_id)
        from_node, to_node = self._validate_nodes(project_id, payload.from_node_id, payload.to_node_id)
        road_type = self._get_road_type_or_none(project_id, payload.road_type_id)

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

        edge_values = self._compose_edge_values(
            road_type=road_type,
            speed=payload.speed,
            priority=payload.priority,
            width=payload.width,
            sidewalk_width=payload.sidewalk_width,
            length=payload.length,
            computed_length=computed_length,
            name=payload.name,
        )
        lanes_payload = self._resolve_lanes(payload.lanes, road_type=road_type, edge_speed=edge_values["speed"], edge_width=edge_values["width"])

        try:
            return self._edge_repository.create(
                project_id=project_id,
                code=payload.code,
                from_node_id=from_node.id,
                to_node_id=to_node.id,
                road_type_id=road_type.id if road_type else None,
                name=edge_values["name"],
                speed=edge_values["speed"],
                priority=edge_values["priority"],
                length=edge_values["length"],
                width=edge_values["width"],
                sidewalk_width=edge_values["sidewalk_width"],
                shape=normalized_shape,
                lanes=lanes_payload,
            )
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError(f"Edge with code '{payload.code}' already exists in project") from exc

    def create_bidirectional(self, project_id: str, payload: EdgeBidirectionalCreate) -> list:
        if payload.forward_code == payload.reverse_code:
            raise ValidationError("forward_code and reverse_code must be different")

        self._project_service.get(project_id)
        from_node, to_node = self._validate_nodes(project_id, payload.from_node_id, payload.to_node_id)
        road_type = self._get_road_type_or_none(project_id, payload.road_type_id)

        try:
            forward_shape, computed_length = self._geometry_service.normalize_shape(
                payload.shape,
                from_x=from_node.x,
                from_y=from_node.y,
                to_x=to_node.x,
                to_y=to_node.y,
            )
        except GeometryValidationError as exc:
            raise ValidationError(str(exc)) from exc

        reverse_shape = list(reversed(deepcopy(forward_shape)))
        edge_values = self._compose_edge_values(
            road_type=road_type,
            speed=payload.speed,
            priority=payload.priority,
            width=payload.width,
            sidewalk_width=payload.sidewalk_width,
            length=payload.length,
            computed_length=computed_length,
            name=None,
        )
        lanes_payload = self._resolve_lanes(payload.lanes, road_type=road_type, edge_speed=edge_values["speed"], edge_width=edge_values["width"])

        try:
            forward_edge = self._edge_repository.create(
                project_id=project_id,
                code=payload.forward_code,
                from_node_id=from_node.id,
                to_node_id=to_node.id,
                road_type_id=road_type.id if road_type else None,
                name=payload.forward_name,
                speed=edge_values["speed"],
                priority=edge_values["priority"],
                length=edge_values["length"],
                width=edge_values["width"],
                sidewalk_width=edge_values["sidewalk_width"],
                shape=forward_shape,
                lanes=lanes_payload,
                commit=False,
            )
            reverse_edge = self._edge_repository.create(
                project_id=project_id,
                code=payload.reverse_code,
                from_node_id=to_node.id,
                to_node_id=from_node.id,
                road_type_id=road_type.id if road_type else None,
                name=payload.reverse_name,
                speed=edge_values["speed"],
                priority=edge_values["priority"],
                length=edge_values["length"],
                width=edge_values["width"],
                sidewalk_width=edge_values["sidewalk_width"],
                shape=reverse_shape,
                lanes=lanes_payload,
                commit=False,
            )
            self._edge_repository.commit()
            self._edge_repository.session.refresh(forward_edge)
            self._edge_repository.session.refresh(reverse_edge)
            return [forward_edge, reverse_edge]
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("Bidirectional edge creation violates unique constraints") from exc

    def list_by_project(self, project_id: str):
        self._project_service.get(project_id)
        return self._edge_repository.list_by_project(project_id)

    def get(self, project_id: str, edge_id: str):
        edge = self._edge_repository.get_in_project(project_id, edge_id)
        if edge is None:
            raise NotFoundError(f"Edge '{edge_id}' not found in project '{project_id}'")
        return edge

    def patch(self, project_id: str, edge_id: str, payload: EdgeUpdate):
        if not payload.model_fields_set:
            raise ValidationError("PATCH payload must include at least one field")

        edge = self.get(project_id, edge_id)
        update_data = payload.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"] is None:
            raise ValidationError("code cannot be null")

        from_node_id = update_data.get("from_node_id", edge.from_node_id)
        to_node_id = update_data.get("to_node_id", edge.to_node_id)
        from_node, to_node = self._validate_nodes(project_id, from_node_id, to_node_id)

        road_type_id = update_data.get("road_type_id", edge.road_type_id)
        road_type = self._get_road_type_or_none(project_id, road_type_id)

        if any(k in update_data for k in ("speed", "priority", "width", "sidewalk_width", "length")):
            composed = self._compose_edge_values(
                road_type=road_type,
                speed=update_data.get("speed", edge.speed),
                priority=update_data.get("priority", edge.priority),
                width=update_data.get("width", edge.width),
                sidewalk_width=update_data.get("sidewalk_width", edge.sidewalk_width),
                length=update_data.get("length", edge.length),
                computed_length=edge.length or 0.0,
                name=update_data.get("name", edge.name),
            )
            update_data.update(composed)

        if "shape" in update_data or "from_node_id" in update_data or "to_node_id" in update_data:
            shape_source = update_data.get("shape", edge.shape)
            try:
                normalized_shape, computed_length = self._geometry_service.normalize_shape(
                    shape_source,
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
            raise ConflictError("Edge update violates unique constraints") from exc

    def patch_shape(self, project_id: str, edge_id: str, payload: EdgeShapePatch):
        edge = self.get(project_id, edge_id)
        from_node, to_node = self._validate_nodes(project_id, edge.from_node_id, edge.to_node_id)

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

    def replace_lanes(self, project_id: str, edge_id: str, lanes: list[LaneUpsert]):
        edge = self.get(project_id, edge_id)
        lanes_payload = self._resolve_lanes(
            lanes,
            road_type=edge.road_type,
            edge_speed=edge.speed,
            edge_width=edge.width,
        )

        try:
            return self._edge_repository.replace_lanes(edge, lanes_payload)
        except IntegrityError as exc:
            self._edge_repository.rollback()
            raise ConflictError("Lanes update violates unique constraints") from exc

    def apply_road_type(self, project_id: str, edge_id: str, payload: EdgeRoadTypePatch):
        edge = self.get(project_id, edge_id)
        road_type = self._get_road_type_or_none(project_id, payload.road_type_id)

        update_data: dict[str, object] = {"road_type_id": road_type.id if road_type else None}
        if road_type is not None:
            if road_type.speed is not None:
                update_data["speed"] = road_type.speed
            if road_type.priority is not None:
                update_data["priority"] = road_type.priority
            if road_type.width is not None:
                update_data["width"] = road_type.width
            if road_type.sidewalk_width is not None:
                update_data["sidewalk_width"] = road_type.sidewalk_width

        updated = self._edge_repository.update(edge, **update_data)

        if road_type is not None:
            lanes = [
                {
                    "index": lane.index,
                    "allow": lane.allow,
                    "disallow": lane.disallow,
                    "speed": road_type.speed if road_type.speed is not None else lane.speed,
                    "width": road_type.width if road_type.width is not None else lane.width,
                }
                for lane in updated.lanes
            ]
            updated = self._edge_repository.replace_lanes(updated, lanes)

        return updated

    def _validate_nodes(self, project_id: str, from_node_id: str, to_node_id: str):
        if from_node_id == to_node_id:
            raise ValidationError("from_node_id and to_node_id must be different")

        from_node = self._node_repository.get_in_project(project_id, from_node_id)
        if from_node is None:
            raise NotFoundError(f"from_node '{from_node_id}' not found in project '{project_id}'")

        to_node = self._node_repository.get_in_project(project_id, to_node_id)
        if to_node is None:
            raise NotFoundError(f"to_node '{to_node_id}' not found in project '{project_id}'")

        return from_node, to_node

    def _get_road_type_or_none(self, project_id: str, road_type_id: str | None):
        if road_type_id is None:
            return None
        road_type = self._road_type_repository.get_in_project(project_id, road_type_id)
        if road_type is None:
            raise NotFoundError(f"RoadType '{road_type_id}' not found in project '{project_id}'")
        return road_type

    def _resolve_lanes(
        self,
        lanes: list[LaneUpsert] | None,
        *,
        road_type,
        edge_speed: float | None,
        edge_width: float | None,
    ) -> list[dict[str, object]]:
        if lanes:
            lane_dicts = [lane.model_dump() for lane in lanes]
        else:
            default_num_lanes = road_type.num_lanes if road_type and road_type.num_lanes else 1
            lane_dicts = [
                {
                    "index": index,
                    "allow": None,
                    "disallow": None,
                    "speed": edge_speed,
                    "width": edge_width,
                }
                for index in range(default_num_lanes)
            ]
        return self._lane_validation.validate_lane_replace_list(lane_dicts)

    def _compose_edge_values(
        self,
        *,
        road_type,
        speed: float | None,
        priority: int | None,
        width: float | None,
        sidewalk_width: float | None,
        length: float | None,
        computed_length: float,
        name: str | None,
    ) -> dict[str, object]:
        if speed is None and road_type is not None:
            speed = road_type.speed
        if priority is None and road_type is not None:
            priority = road_type.priority
        if width is None and road_type is not None:
            width = road_type.width
        if sidewalk_width is None and road_type is not None:
            sidewalk_width = road_type.sidewalk_width

        if speed is not None and speed <= 0:
            raise ValidationError("speed must be > 0")
        if width is not None and width <= 0:
            raise ValidationError("width must be > 0")
        if sidewalk_width is not None and sidewalk_width < 0:
            raise ValidationError("sidewalk_width must be >= 0")

        if length is None:
            length = computed_length
        elif length <= 0:
            raise ValidationError("length must be > 0")

        return {
            "name": name,
            "speed": speed,
            "priority": priority,
            "length": length,
            "width": width,
            "sidewalk_width": sidewalk_width,
        }
