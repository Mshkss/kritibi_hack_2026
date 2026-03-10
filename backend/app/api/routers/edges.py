"""Edge routes for network constructor."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_edge_service
from app.api.serializers import edge_to_read
from app.schemas.edge import (
    EdgeBidirectionalCreate,
    EdgeCreate,
    EdgeRead,
    EdgeRoadTypePatch,
    EdgeShapePatch,
    EdgeUpdate,
)
from app.schemas.lane import LaneUpsert
from app.services.edge_service import EdgeService
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


@router.patch("/{edge_id}", response_model=EdgeRead)
def update_edge(
    project_id: UUID,
    edge_id: UUID,
    payload: EdgeUpdate,
    service: EdgeService = Depends(get_edge_service),
) -> EdgeRead:
    try:
        edge = service.patch(str(project_id), str(edge_id), payload)
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
    payload: EdgeShapePatch,
    service: EdgeService = Depends(get_edge_service),
) -> EdgeRead:
    try:
        edge = service.patch_shape(str(project_id), str(edge_id), payload)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{edge_id}/lanes", response_model=EdgeRead)
def replace_lanes(
    project_id: UUID,
    edge_id: UUID,
    lanes: list[LaneUpsert],
    service: EdgeService = Depends(get_edge_service),
) -> EdgeRead:
    try:
        edge = service.replace_lanes(str(project_id), str(edge_id), lanes)
        return edge_to_read(edge)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{edge_id}/road-type", response_model=EdgeRead)
def apply_road_type(
    project_id: UUID,
    edge_id: UUID,
    payload: EdgeRoadTypePatch,
    service: EdgeService = Depends(get_edge_service),
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
