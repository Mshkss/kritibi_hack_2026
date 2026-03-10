"""Project CRUD routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_graph_service, get_project_service
from app.api.serializers import edge_to_read
from app.schemas.network import ProjectNetworkRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.errors import NotFoundError
from app.services.graph_service import GraphService
from app.services.project_service import EmptyPatchError, ProjectNotFoundError, ProjectService

router = APIRouter(prefix="/projects")


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    service: ProjectService = Depends(get_project_service),
) -> ProjectRead:
    return service.create(payload)


@router.get("", response_model=list[ProjectRead])
def list_projects(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    service: ProjectService = Depends(get_project_service),
) -> list[ProjectRead]:
    return service.list(limit=limit, offset=offset)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: UUID, service: ProjectService = Depends(get_project_service)) -> ProjectRead:
    try:
        return service.get(str(project_id))
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{project_id}/network", response_model=ProjectNetworkRead)
def get_project_network(
    project_id: UUID,
    service: GraphService = Depends(get_graph_service),
) -> ProjectNetworkRead:
    try:
        network = service.get_project_network(str(project_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return ProjectNetworkRead(
        project=network["project"],
        nodes=network["nodes"],
        road_types=network["road_types"],
        edges=[edge_to_read(edge) for edge in network["edges"]],
    )


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    service: ProjectService = Depends(get_project_service),
) -> ProjectRead:
    try:
        return service.update(str(project_id), payload)
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except EmptyPatchError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    service: ProjectService = Depends(get_project_service),
) -> Response:
    try:
        service.delete(str(project_id))
    except ProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
