"""Response serialization helpers for API DTOs."""

from app.models.connection import ConnectionModel
from app.models.edge import EdgeModel
from app.models.node import NodeModel
from app.schemas.connection import ConnectionResponse, EdgeConnectionSummary, NodeSummary
from app.schemas.edge import EdgeRead


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
