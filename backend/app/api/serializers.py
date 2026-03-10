"""Response serialization helpers for API DTOs."""

from app.models.connection import ConnectionModel
from app.models.edge import EdgeModel
from app.models.intersection import IntersectionModel
from app.models.intersection_approach import IntersectionApproachModel
from app.models.movement import MovementModel
from app.models.node import NodeModel
from app.models.traffic_sign import TrafficSignModel
from app.schemas.connection import ConnectionResponse, EdgeConnectionSummary, NodeSummary
from app.schemas.edge import EdgeRead
from app.schemas.intersection import (
    IntersectionApproachResponse,
    IntersectionEdgeSummary,
    IntersectionNodeSummary,
    IntersectionResponse,
    MovementResponse,
    TrafficSignResponse,
)


def edge_to_read(edge: EdgeModel) -> EdgeRead:
    return EdgeRead.model_validate(
        {
            "id": edge.id,
            "project_id": edge.project_id,
            "code": edge.code,
            "from_node_id": edge.from_node_id,
            "to_node_id": edge.to_node_id,
            "road_type_id": edge.road_type_id,
            "name": edge.name,
            "speed": edge.speed,
            "priority": edge.priority,
            "length": edge.length,
            "width": edge.width,
            "sidewalk_width": edge.sidewalk_width,
            "shape": edge.shape,
            "lanes": edge.lanes,
            "num_lanes": len(edge.lanes),
            "created_at": edge.created_at,
            "updated_at": edge.updated_at,
        }
    )


def node_to_summary(node: NodeModel) -> NodeSummary:
    return NodeSummary.model_validate(
        {
            "id": node.id,
            "code": node.code,
        }
    )


def edge_to_connection_summary(edge: EdgeModel) -> EdgeConnectionSummary:
    return EdgeConnectionSummary.model_validate(
        {
            "id": edge.id,
            "code": edge.code,
            "name": edge.name,
            "from_node_id": edge.from_node_id,
            "to_node_id": edge.to_node_id,
            "num_lanes": len(edge.lanes),
        }
    )


def connection_to_response(connection: ConnectionModel) -> ConnectionResponse:
    return ConnectionResponse.model_validate(
        {
            "id": connection.id,
            "project_id": connection.project_id,
            "via_node_id": connection.via_node_id,
            "from_edge_id": connection.from_edge_id,
            "to_edge_id": connection.to_edge_id,
            "from_lane_index": connection.from_lane_index,
            "to_lane_index": connection.to_lane_index,
            "uncontrolled": connection.uncontrolled,
            "from_edge_code": connection.from_edge.code if connection.from_edge else "",
            "to_edge_code": connection.to_edge.code if connection.to_edge else "",
            "via_node_code": connection.via_node.code if connection.via_node else "",
            "from_edge_name": connection.from_edge.name if connection.from_edge else None,
            "to_edge_name": connection.to_edge.name if connection.to_edge else None,
            "created_at": connection.created_at,
            "updated_at": connection.updated_at,
        }
    )


def intersection_to_response(intersection: IntersectionModel) -> IntersectionResponse:
    return IntersectionResponse.model_validate(
        {
            "id": intersection.id,
            "project_id": intersection.project_id,
            "node_id": intersection.node_id,
            "kind": intersection.kind,
            "name": intersection.name,
            "created_at": intersection.created_at,
            "updated_at": intersection.updated_at,
        }
    )


def intersection_node_to_summary(node: NodeModel) -> IntersectionNodeSummary:
    return IntersectionNodeSummary.model_validate(
        {
            "id": node.id,
            "code": node.code,
            "x": node.x,
            "y": node.y,
            "type": node.type,
        }
    )


def edge_to_intersection_summary(edge: EdgeModel) -> IntersectionEdgeSummary:
    return IntersectionEdgeSummary.model_validate(
        {
            "id": edge.id,
            "code": edge.code,
            "name": edge.name,
            "from_node_id": edge.from_node_id,
            "to_node_id": edge.to_node_id,
            "num_lanes": len(edge.lanes),
        }
    )


def approach_to_response(approach: IntersectionApproachModel) -> IntersectionApproachResponse:
    return IntersectionApproachResponse.model_validate(
        {
            "id": approach.id,
            "project_id": approach.project_id,
            "intersection_id": approach.intersection_id,
            "incoming_edge_id": approach.incoming_edge_id,
            "incoming_edge_code": approach.incoming_edge.code if approach.incoming_edge else "",
            "incoming_edge_name": approach.incoming_edge.name if approach.incoming_edge else None,
            "order_index": approach.order_index,
            "name": approach.name,
            "role": approach.role,
            "priority_rank": approach.priority_rank,
            "created_at": approach.created_at,
            "updated_at": approach.updated_at,
        }
    )


def movement_to_response(movement: MovementModel) -> MovementResponse:
    return MovementResponse.model_validate(
        {
            "id": movement.id,
            "project_id": movement.project_id,
            "intersection_id": movement.intersection_id,
            "approach_id": movement.approach_id,
            "connection_id": movement.connection_id,
            "from_edge_id": movement.from_edge_id,
            "to_edge_id": movement.to_edge_id,
            "from_lane_index": movement.from_lane_index,
            "to_lane_index": movement.to_lane_index,
            "is_enabled": movement.is_enabled,
            "movement_kind": movement.movement_kind,
            "created_at": movement.created_at,
            "updated_at": movement.updated_at,
        }
    )


def traffic_sign_to_response(sign: TrafficSignModel) -> TrafficSignResponse:
    return TrafficSignResponse.model_validate(
        {
            "id": sign.id,
            "project_id": sign.project_id,
            "intersection_id": sign.intersection_id,
            "approach_id": sign.approach_id,
            "node_id": sign.node_id,
            "edge_id": sign.edge_id,
            "sign_type": sign.sign_type,
            "generated": sign.generated,
            "metadata": sign.payload,
            "created_at": sign.created_at,
            "updated_at": sign.updated_at,
        }
    )
