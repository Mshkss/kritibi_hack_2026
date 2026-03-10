"""Edge routes for network constructor."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_edge_service, get_road_segment_editor_service
from app.api.serializers import edge_to_read
from app.schemas.edge import (
    EdgeBidirectionalCreate,
    EdgeCreate,
    EdgeRead,
)
from app.schemas.edge_editor import (
    ApplyRoadTypeRequest,
    EdgeEditorResponse,
    EdgePatchRequest,
    EdgeShapePatchRequest,
    LanePatchRequest,
    LaneReplaceListRequest,
)
from app.services.edge_service import EdgeService
from app.services.road_segment_editor_service import RoadSegmentEditorService
from app.services.errors import ConflictError, NotFoundError, ValidationError

router = APIRouter(prefix="/projects/{project_id}/edges")


@router.post("", response_model=EdgeRead, status_code=status.HTTP_201_CREATED)
def create_edge(
    project_id: UUID,
    payload: EdgeCreate,
    service: EdgeService = Depends(get_edge_service),
) -> EdgeRead:
    try:
        edge = service.create_directed(str(project_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/bidirectional", response_model=list[EdgeRead], status_code=status.HTTP_201_CREATED)
def create_bidirectional_edge(
    project_id: UUID,
    payload: EdgeBidirectionalCreate,
    service: EdgeService = Depends(get_edge_service),
) -> list[EdgeRead]:
    try:
        edges = service.create_bidirectional(str(project_id), payload)
        return [edge_to_read(edge) for edge in edges]
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("", response_model=list[EdgeRead])
def list_edges(project_id: UUID, service: EdgeService = Depends(get_edge_service)) -> list[EdgeRead]:
    try:
        return [edge_to_read(edge) for edge in service.list_by_project(str(project_id))]
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{edge_id}", response_model=EdgeRead)
def get_edge(project_id: UUID, edge_id: UUID, service: EdgeService = Depends(get_edge_service)) -> EdgeRead:
    try:
        edge = service.get(str(project_id), str(edge_id))
        return edge_to_read(edge)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{edge_id}/editor", response_model=EdgeEditorResponse)
def get_edge_editor(
    project_id: UUID,
    edge_id: UUID,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeEditorResponse:
    try:
        card = service.get_editor_card(str(project_id), str(edge_id))
        return EdgeEditorResponse(edge=edge_to_read(card["edge"]), road_type=card["road_type"])
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{edge_id}", response_model=EdgeRead)
def update_edge(
    project_id: UUID,
    edge_id: UUID,
    payload: EdgePatchRequest,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.patch_edge(str(project_id), str(edge_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{edge_id}/shape", response_model=EdgeRead)
def patch_shape(
    project_id: UUID,
    edge_id: UUID,
    payload: EdgeShapePatchRequest,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.patch_shape(str(project_id), str(edge_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{edge_id}/recalculate-length", response_model=EdgeRead)
def recalculate_length(
    project_id: UUID,
    edge_id: UUID,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.recalculate_length(str(project_id), str(edge_id))
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{edge_id}/lanes", response_model=EdgeRead)
def replace_lanes(
    project_id: UUID,
    edge_id: UUID,
    payload: LaneReplaceListRequest,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.replace_lanes(str(project_id), str(edge_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{edge_id}/lanes/{lane_id}", response_model=EdgeRead)
def patch_lane(
    project_id: UUID,
    edge_id: UUID,
    lane_id: UUID,
    payload: LanePatchRequest,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.patch_lane(str(project_id), str(edge_id), str(lane_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{edge_id}/apply-road-type", response_model=EdgeRead)
def apply_road_type(
    project_id: UUID,
    edge_id: UUID,
    payload: ApplyRoadTypeRequest,
    service: RoadSegmentEditorService = Depends(get_road_segment_editor_service),
) -> EdgeRead:
    try:
        edge = service.apply_road_type(str(project_id), str(edge_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
