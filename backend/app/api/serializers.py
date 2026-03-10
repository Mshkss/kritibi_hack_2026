"""Response serialization helpers for API DTOs."""

from app.models.edge import EdgeModel
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
