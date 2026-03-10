"""RoadType routes for network constructor."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_road_type_service
from app.schemas.road_type import RoadTypeCreate, RoadTypeRead, RoadTypeUpdate
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.road_type_service import RoadTypeService

router = APIRouter(prefix="/projects/{project_id}/road-types")


@router.post("", response_model=RoadTypeRead, status_code=status.HTTP_201_CREATED)
def create_road_type(
    project_id: UUID,
    payload: RoadTypeCreate,
    service: RoadTypeService = Depends(get_road_type_service),
) -> RoadTypeRead:
    try:
        return service.create(str(project_id), payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("", response_model=list[RoadTypeRead])
def list_road_types(
    project_id: UUID,
    service: RoadTypeService = Depends(get_road_type_service),
) -> list[RoadTypeRead]:
    try:
        return service.list_by_project(str(project_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{road_type_id}", response_model=RoadTypeRead)
def update_road_type(
    project_id: UUID,
    road_type_id: UUID,
    payload: RoadTypeUpdate,
    service: RoadTypeService = Depends(get_road_type_service),
) -> RoadTypeRead:
    try:
        return service.update(str(project_id), str(road_type_id), payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
