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
    traffic_sign_to_response,
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
    IntersectionApproachPriorityPatchRequest,
    IntersectionExportHintsResponse,
    MovementPatchRequest,
    MovementResponse,
    MovementsSyncRequest,
    MovementsSyncResponse,
    PrioritySchemePutRequest,
    PrioritySchemeResponse,
    PrioritySchemeValidationResponse,
    SignGenerationRequest,
    SignGenerationResponse,
    TrafficSignResponse,
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


@router.patch(
    "/intersections/{intersection_id}/approaches/{approach_id}",
    response_model=IntersectionApproachResponse,
)
def patch_approach_priority(
    project_id: UUID,
    intersection_id: UUID,
    approach_id: UUID,
    payload: IntersectionApproachPriorityPatchRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionApproachResponse:
    try:
        approach = service.patch_approach_priority(
            str(project_id),
            str(intersection_id),
            str(approach_id),
            payload,
        )
        return approach_to_response(approach)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/intersections/{intersection_id}/priority-scheme", response_model=PrioritySchemeResponse)
def put_priority_scheme(
    project_id: UUID,
    intersection_id: UUID,
    payload: PrioritySchemePutRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> PrioritySchemeResponse:
    try:
        data = service.put_priority_scheme(str(project_id), str(intersection_id), payload)
        return PrioritySchemeResponse(
            intersection_id=data["intersection_id"],
            approaches=[approach_to_response(item) for item in data["approaches"]],
            summary=data["summary"],
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/priority-scheme", response_model=PrioritySchemeResponse)
def get_priority_scheme(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> PrioritySchemeResponse:
    try:
        data = service.get_priority_scheme(str(project_id), str(intersection_id))
        return PrioritySchemeResponse(
            intersection_id=data["intersection_id"],
            approaches=[approach_to_response(item) for item in data["approaches"]],
            summary=data["summary"],
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/priority-validation", response_model=PrioritySchemeValidationResponse)
def validate_priority_scheme(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> PrioritySchemeValidationResponse:
    try:
        data = service.priority_validation(str(project_id), str(intersection_id))
        return PrioritySchemeValidationResponse.model_validate(data)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/intersections/{intersection_id}/signs/generate", response_model=SignGenerationResponse)
def generate_signs(
    project_id: UUID,
    intersection_id: UUID,
    payload: SignGenerationRequest,
    service: IntersectionService = Depends(get_intersection_service),
) -> SignGenerationResponse:
    try:
        data = service.generate_signs(str(project_id), str(intersection_id), payload)
        return SignGenerationResponse(
            intersection_id=data["intersection_id"],
            secondary_sign_type=data["secondary_sign_type"],
            created_count=data["created_count"],
            updated_count=data["updated_count"],
            deleted_count=data["deleted_count"],
            signs=[traffic_sign_to_response(item) for item in data["signs"]],
            diagnostics=list(data["diagnostics"]),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/signs", response_model=list[TrafficSignResponse])
def list_signs(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> list[TrafficSignResponse]:
    try:
        signs = service.list_signs(str(project_id), str(intersection_id))
        return [traffic_sign_to_response(item) for item in signs]
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/intersections/{intersection_id}/export-hints", response_model=IntersectionExportHintsResponse)
def get_export_hints(
    project_id: UUID,
    intersection_id: UUID,
    service: IntersectionService = Depends(get_intersection_service),
) -> IntersectionExportHintsResponse:
    try:
        data = service.export_hints(str(project_id), str(intersection_id))
        return IntersectionExportHintsResponse.model_validate(data)
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
            priority_scheme=PrioritySchemeResponse(
                intersection_id=data["priority_scheme"]["intersection_id"],
                approaches=[approach_to_response(item) for item in data["priority_scheme"]["approaches"]],
                summary=data["priority_scheme"]["summary"],
            ),
            generated_signs=[traffic_sign_to_response(item) for item in data["generated_signs"]],
            export_hints=IntersectionExportHintsResponse.model_validate(data["export_hints"]),
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
