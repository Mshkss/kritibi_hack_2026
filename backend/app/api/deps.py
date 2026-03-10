"""Shared API dependencies."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.connection import ConnectionRepository
from app.repositories.edge import EdgeRepository
from app.repositories.intersection import IntersectionRepository
from app.repositories.intersection_approach import IntersectionApproachRepository
from app.repositories.movement import MovementRepository
from app.repositories.node import NodeRepository
from app.repositories.pedestrian_crossing import PedestrianCrossingRepository
from app.repositories.project import ProjectRepository
from app.repositories.road_type import RoadTypeRepository
from app.repositories.traffic_sign import TrafficSignRepository
from app.services.approach_builder_service import ApproachBuilderService
from app.services.connection_service import ConnectionService
from app.services.edge_service import EdgeService
from app.services.geometry_service import GeometryService
from app.services.graph_topology_validation_service import GraphTopologyValidationService
from app.services.graph_service import GraphService
from app.services.intersection_service import IntersectionService
from app.services.lane_validation_service import LaneValidationService
from app.services.movement_builder_service import MovementBuilderService
from app.services.node_service import NodeService
from app.services.pedestrian_crossing_service import PedestrianCrossingService
from app.services.priority_scheme_service import PrioritySchemeService
from app.services.project_service import ProjectService
from app.services.road_segment_editor_service import RoadSegmentEditorService
from app.services.road_type_service import RoadTypeService
from app.services.sign_generation_service import SignGenerationService


def get_project_service(db: Session = Depends(get_db)) -> ProjectService:
    """Build ProjectService for request scope."""
    repository = ProjectRepository(db)
    return ProjectService(repository)


def get_geometry_service() -> GeometryService:
    return GeometryService()


def get_lane_validation_service() -> LaneValidationService:
    return LaneValidationService()


def get_graph_topology_validation_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> GraphTopologyValidationService:
    return GraphTopologyValidationService(
        project_service=project_service,
        node_repository=NodeRepository(db),
        edge_repository=EdgeRepository(db),
    )


def get_node_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    geometry_service: GeometryService = Depends(get_geometry_service),
) -> NodeService:
    node_repository = NodeRepository(db)
    edge_repository = EdgeRepository(db)
    return NodeService(
        node_repository=node_repository,
        edge_repository=edge_repository,
        project_service=project_service,
        geometry_service=geometry_service,
    )


def get_road_type_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> RoadTypeService:
    repository = RoadTypeRepository(db)
    return RoadTypeService(repository=repository, project_service=project_service)


def get_edge_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    geometry_service: GeometryService = Depends(get_geometry_service),
    lane_validation_service: LaneValidationService = Depends(get_lane_validation_service),
) -> EdgeService:
    return EdgeService(
        edge_repository=EdgeRepository(db),
        node_repository=NodeRepository(db),
        road_type_repository=RoadTypeRepository(db),
        project_service=project_service,
        geometry_service=geometry_service,
        lane_validation_service=lane_validation_service,
    )


def get_graph_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> GraphService:
    return GraphService(
        project_service=project_service,
        node_repository=NodeRepository(db),
        edge_repository=EdgeRepository(db),
        road_type_repository=RoadTypeRepository(db),
    )


def get_road_segment_editor_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    geometry_service: GeometryService = Depends(get_geometry_service),
    lane_validation_service: LaneValidationService = Depends(get_lane_validation_service),
) -> RoadSegmentEditorService:
    return RoadSegmentEditorService(
        edge_repository=EdgeRepository(db),
        connection_repository=ConnectionRepository(db),
        node_repository=NodeRepository(db),
        road_type_repository=RoadTypeRepository(db),
        project_service=project_service,
        geometry_service=geometry_service,
        lane_validation_service=lane_validation_service,
    )


def get_connection_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    topology_validation_service: GraphTopologyValidationService = Depends(get_graph_topology_validation_service),
) -> ConnectionService:
    return ConnectionService(
        connection_repository=ConnectionRepository(db),
        project_service=project_service,
        topology_validation_service=topology_validation_service,
    )


def get_approach_builder_service(
    db: Session = Depends(get_db),
) -> ApproachBuilderService:
    return ApproachBuilderService(
        edge_repository=EdgeRepository(db),
        approach_repository=IntersectionApproachRepository(db),
    )


def get_movement_builder_service(
    db: Session = Depends(get_db),
) -> MovementBuilderService:
    return MovementBuilderService(
        movement_repository=MovementRepository(db),
        approach_repository=IntersectionApproachRepository(db),
        connection_repository=ConnectionRepository(db),
    )


def get_priority_scheme_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> PrioritySchemeService:
    return PrioritySchemeService(
        intersection_repository=IntersectionRepository(db),
        approach_repository=IntersectionApproachRepository(db),
        project_service=project_service,
    )


def get_sign_generation_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    priority_scheme_service: PrioritySchemeService = Depends(get_priority_scheme_service),
) -> SignGenerationService:
    return SignGenerationService(
        intersection_repository=IntersectionRepository(db),
        approach_repository=IntersectionApproachRepository(db),
        traffic_sign_repository=TrafficSignRepository(db),
        priority_scheme_service=priority_scheme_service,
        project_service=project_service,
    )


def get_pedestrian_crossing_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
) -> PedestrianCrossingService:
    return PedestrianCrossingService(
        intersection_repository=IntersectionRepository(db),
        approach_repository=IntersectionApproachRepository(db),
        pedestrian_crossing_repository=PedestrianCrossingRepository(db),
        project_service=project_service,
    )


def get_intersection_service(
    db: Session = Depends(get_db),
    project_service: ProjectService = Depends(get_project_service),
    approach_builder_service: ApproachBuilderService = Depends(get_approach_builder_service),
    movement_builder_service: MovementBuilderService = Depends(get_movement_builder_service),
    priority_scheme_service: PrioritySchemeService = Depends(get_priority_scheme_service),
    sign_generation_service: SignGenerationService = Depends(get_sign_generation_service),
    pedestrian_crossing_service: PedestrianCrossingService = Depends(get_pedestrian_crossing_service),
) -> IntersectionService:
    return IntersectionService(
        intersection_repository=IntersectionRepository(db),
        approach_repository=IntersectionApproachRepository(db),
        movement_repository=MovementRepository(db),
        node_repository=NodeRepository(db),
        edge_repository=EdgeRepository(db),
        project_service=project_service,
        approach_builder_service=approach_builder_service,
        movement_builder_service=movement_builder_service,
        priority_scheme_service=priority_scheme_service,
        sign_generation_service=sign_generation_service,
        pedestrian_crossing_service=pedestrian_crossing_service,
    )


__all__ = [
    "get_db",
    "get_edge_service",
    "get_geometry_service",
    "get_graph_topology_validation_service",
    "get_graph_service",
    "get_connection_service",
    "get_approach_builder_service",
    "get_movement_builder_service",
    "get_intersection_service",
    "get_pedestrian_crossing_service",
    "get_priority_scheme_service",
    "get_sign_generation_service",
    "get_lane_validation_service",
    "get_node_service",
    "get_project_service",
    "get_road_segment_editor_service",
    "get_road_type_service",
]
