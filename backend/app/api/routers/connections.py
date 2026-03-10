"""Connection layer routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_connection_service
from app.api.serializers import connection_to_response, edge_to_connection_summary, node_to_summary
from app.schemas.connection import (
    ConnectionAutogenerateRequest,
    ConnectionAutogenerateResponse,
    ConnectionCandidatesResponse,
    ConnectionCreateRequest,
    ConnectionPatchRequest,
    ConnectionResponse,
    NodeConnectionsResponse,
)
from app.services.connection_service import ConnectionService
from app.services.errors import ConflictError, NotFoundError, ValidationError

router = APIRouter(prefix="/projects/{project_id}")


@router.post("/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    project_id: UUID,
    payload: ConnectionCreateRequest,
    service: ConnectionService = Depends(get_connection_service),
) -> ConnectionResponse:
    try:
        connection = service.create(str(project_id), payload)
        return connection_to_response(connection)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/connections/{connection_id}", response_model=ConnectionResponse)
def patch_connection(
    project_id: UUID,
    connection_id: UUID,
    payload: ConnectionPatchRequest,
    service: ConnectionService = Depends(get_connection_service),
) -> ConnectionResponse:
    try:
        connection = service.patch(str(project_id), str(connection_id), payload)
        return connection_to_response(connection)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    project_id: UUID,
    connection_id: UUID,
    service: ConnectionService = Depends(get_connection_service),
) -> Response:
    try:
        service.delete(str(project_id), str(connection_id))
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/nodes/{node_id}/connections", response_model=NodeConnectionsResponse)
def list_node_connections(
    project_id: UUID,
    node_id: UUID,
    service: ConnectionService = Depends(get_connection_service),
) -> NodeConnectionsResponse:
    try:
        data = service.list_by_node(str(project_id), str(node_id))
        return NodeConnectionsResponse(
            node=node_to_summary(data["node"]),
            incoming_edges=[edge_to_connection_summary(edge) for edge in data["incoming_edges"]],
            outgoing_edges=[edge_to_connection_summary(edge) for edge in data["outgoing_edges"]],
            connections=[connection_to_response(connection) for connection in data["connections"]],
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/nodes/{node_id}/connections/autogenerate",
    response_model=ConnectionAutogenerateResponse,
    status_code=status.HTTP_200_OK,
)
def autogenerate_connections(
    project_id: UUID,
    node_id: UUID,
    payload: ConnectionAutogenerateRequest,
    service: ConnectionService = Depends(get_connection_service),
) -> ConnectionAutogenerateResponse:
    try:
        data = service.autogenerate_for_node(str(project_id), str(node_id), payload)
        return ConnectionAutogenerateResponse(
            node_id=data["node_id"],
            considered_pairs=data["considered_pairs"],
            created_count=data["created_count"],
            skipped_duplicates=data["skipped_duplicates"],
            skipped_u_turns=data["skipped_u_turns"],
            created_connections=[connection_to_response(connection) for connection in data["created_connections"]],
            diagnostics=list(data["diagnostics"]),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/nodes/{node_id}/connection-candidates", response_model=ConnectionCandidatesResponse)
def get_connection_candidates(
    project_id: UUID,
    node_id: UUID,
    service: ConnectionService = Depends(get_connection_service),
) -> ConnectionCandidatesResponse:
    try:
        data = service.get_candidates(str(project_id), str(node_id))
        return ConnectionCandidatesResponse(
            node_id=str(node_id),
            incoming_edges=[edge_to_connection_summary(edge) for edge in data["incoming_edges"]],
            outgoing_edges=[edge_to_connection_summary(edge) for edge in data["outgoing_edges"]],
            valid_pairs=list(data["valid_pairs"]),
            invalid_pairs=list(data["invalid_pairs"]),
            diagnostics=list(data["diagnostics"]),
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
