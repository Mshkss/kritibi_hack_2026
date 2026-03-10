"""Intersection editor routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_intersection_service
from app.api.serializers import (
    approach_to_response,
    edge_to_intersection_summary,
    intersection_node_to_summary,
    intersection_to_response,
    movement_to_response,
)
from app.schemas.intersection import (
    ApproachesSyncRequest,
    ApproachesSyncResponse,
    IntersectionCreateRequest,
    IntersectionEditorResponse,
    IntersectionPatchRequest,
    IntersectionResponse,
    IntersectionValidationResponse,
    IntersectionApproachResponse,
    MovementPatchRequest,
    MovementResponse,
    MovementsSyncRequest,
    MovementsSyncResponse,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.intersection_service import IntersectionService

router = APIRouter(prefix="/projects/{project_id}")


@router.post("/intersections", response_model=IntersectionResponse, status_code=status.HTTP_201_CREATED)
def create_intersection(
    project_id: UUID,
    payload: IntersectionCreateRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionResponse:
    try:
        intersection = service.create(str(project_id), payload)
        return intersection_to_response(intersection)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}", response_model=IntersectionResponse)
def get_intersection(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionResponse:
    try:
        intersection = service.get(str(project_id), str(intersection_id))
        return intersection_to_response(intersection)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/nodes/{node_id}/intersection", response_model=IntersectionResponse)
def get_intersection_by_node(
    project_id: UUID,
    node_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionResponse:
    try:
        intersection = service.get_by_node(str(project_id), str(node_id))
        return intersection_to_response(intersection)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/intersections/{intersection_id}", response_model=IntersectionResponse)
def patch_intersection(
    project_id: UUID,
    intersection_id: UUID,
    payload: IntersectionPatchRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionResponse:
    try:
        intersection = service.patch(str(project_id), str(intersection_id), payload)
        return intersection_to_response(intersection)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/intersections/{intersection_id}/approaches/sync", response_model=ApproachesSyncResponse)
def sync_approaches(
    project_id: UUID,
    intersection_id: UUID,
    payload: ApproachesSyncRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> ApproachesSyncResponse:
    try:
        data = service.sync_approaches(str(project_id), str(intersection_id), payload)
        return ApproachesSyncResponse(
            intersection_id=data["intersection_id"],
            created_count=data["created_count"],
            deleted_count=data["deleted_count"],
            stale_count=data["stale_count"],
            approaches=[approach_to_response(item) for item in data["approaches"]],
            diagnostics=list(data["diagnostics"]),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/approaches", response_model=list[IntersectionApproachResponse])
def list_approaches(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> list[IntersectionApproachResponse]:
    try:
        approaches = service.list_approaches(str(project_id), str(intersection_id))
        return [approach_to_response(item) for item in approaches]
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/intersections/{intersection_id}/movements/sync", response_model=MovementsSyncResponse)
def sync_movements(
    project_id: UUID,
    intersection_id: UUID,
    payload: MovementsSyncRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> MovementsSyncResponse:
    try:
        data = service.sync_movements(str(project_id), str(intersection_id), payload)
        return MovementsSyncResponse(
            intersection_id=data["intersection_id"],
            created_count=data["created_count"],
            updated_count=data["updated_count"],
            deleted_count=data["deleted_count"],
            stale_count=data["stale_count"],
            movements=[movement_to_response(item) for item in data["movements"]],
            diagnostics=list(data["diagnostics"]),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/movements", response_model=list[MovementResponse])
def list_movements(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> list[MovementResponse]:
    try:
        movements = service.list_movements(str(project_id), str(intersection_id))
        return [movement_to_response(item) for item in movements]
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/intersections/{intersection_id}/movements/{movement_id}", response_model=MovementResponse)
def patch_movement(
    project_id: UUID,
    intersection_id: UUID,
    movement_id: UUID,
    payload: MovementPatchRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> MovementResponse:
    try:
        movement = service.patch_movement(str(project_id), str(intersection_id), str(movement_id), payload)
        return movement_to_response(movement)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/editor", response_model=IntersectionEditorResponse)
def get_editor_card(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionEditorResponse:
    try:
        data = service.editor_card(str(project_id), str(intersection_id))
        diagnostics = IntersectionValidationResponse.model_validate(data["diagnostics"])
        return IntersectionEditorResponse(
            intersection=intersection_to_response(data["intersection"]),
            node=intersection_node_to_summary(data["node"]),
            incoming_edges=[edge_to_intersection_summary(edge) for edge in data["incoming_edges"]],
            outgoing_edges=[edge_to_intersection_summary(edge) for edge in data["outgoing_edges"]],
            approaches=[approach_to_response(item) for item in data["approaches"]],
            movements=[movement_to_response(item) for item in data["movements"]],
            diagnostics=diagnostics,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/validation", response_model=IntersectionValidationResponse)
def validate_intersection(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionValidationResponse:
    try:
        data = service.validation(str(project_id), str(intersection_id))
        return IntersectionValidationResponse.model_validate(data)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
