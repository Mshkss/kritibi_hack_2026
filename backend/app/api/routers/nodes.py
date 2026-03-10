"""Node routes for network constructor."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_node_service
from app.schemas.node import NodeCreate, NodeRead, NodeUpdate
from app.services.errors import ConflictError, DependencyError, NotFoundError, ValidationError
from app.services.node_service import NodeService

router = APIRouter(prefix="/projects/{project_id}/nodes")


@router.post("", response_model=NodeRead, status_code=status.HTTP_201_CREATED)
def create_node(
    project_id: UUID,
    payload: NodeCreate,
    service: NodeService = Depends(get_node_service),
) -> NodeRead:
    try:
        return service.create(str(project_id), payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("", response_model=list[NodeRead])
def list_nodes(project_id: UUID, service: NodeService = Depends(get_node_service)) -> list[NodeRead]:
    try:
        return service.list_by_project(str(project_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{node_id}", response_model=NodeRead)
def update_node(
    project_id: UUID,
    node_id: UUID,
    payload: NodeUpdate,
    service: NodeService = Depends(get_node_service),
) -> NodeRead:
    try:
        return service.update(str(project_id), str(node_id), payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(
    project_id: UUID,
    node_id: UUID,
    service: NodeService = Depends(get_node_service),
) -> Response:
    try:
        service.delete(str(project_id), str(node_id))
    except DependencyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
