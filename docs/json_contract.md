# JSON Contract (Stage: Network + Segment Editor + Connection Layer + Intersection Editor)

Base URL: `/`  
Content-Type: `application/json`

## Error Format

```json
{"detail": "human-readable error message"}
```

Типовые коды:
- `400` validation/business rule error
- `404` entity not found in project scope
- `409` uniqueness/constraint conflict
- `422` schema validation error

## Existing Endpoints (already available)

- foundation/project/node/edge/lane/road-type/connection endpoints из предыдущих этапов.

Ключевые уже имеющиеся editor/connection endpoint:
- `GET /projects/{project_id}/edges/{edge_id}/editor`
- `PUT /projects/{project_id}/edges/{edge_id}/lanes`
- `POST /projects/{project_id}/connections`
- `GET /projects/{project_id}/nodes/{node_id}/connections`
- `POST /projects/{project_id}/nodes/{node_id}/connections/autogenerate`

## Intersection Editor Endpoints

## POST `/projects/{project_id}/intersections`

Создает `Intersection` поверх существующего `Node`.

Request (`IntersectionCreateRequest`):

```json
{
  "node_id": "uuid",
  "kind": "crossroad",
  "name": "Main crossing",
  "auto_sync": true
}
```

Response `201` (`IntersectionResponse`):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "node_id": "uuid",
  "kind": "crossroad",
  "name": "Main crossing",
  "created_at": "2026-03-10T00:00:00Z",
  "updated_at": "2026-03-10T00:00:00Z"
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}`

Response `200`: `IntersectionResponse`.

## GET `/projects/{project_id}/nodes/{node_id}/intersection`

Response `200`: `IntersectionResponse`.

## PATCH `/projects/{project_id}/intersections/{intersection_id}`

Изменение `kind/name`.

Request (`IntersectionPatchRequest`):

```json
{
  "kind": "roundabout",
  "name": "Roundabout #1"
}
```

Response `200`: `IntersectionResponse`.

## POST `/projects/{project_id}/intersections/{intersection_id}/approaches/sync`

Синхронизация `IntersectionApproach` с incoming edges.

Request (`ApproachesSyncRequest`):

```json
{
  "add_missing_only": true,
  "remove_stale": false
}
```

Response `200` (`ApproachesSyncResponse`):

```json
{
  "intersection_id": "uuid",
  "created_count": 2,
  "deleted_count": 0,
  "stale_count": 1,
  "approaches": [],
  "diagnostics": [
    "incoming_edges=3",
    "created=2",
    "stale_detected=1",
    "stale_removed=0"
  ]
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/approaches`

Response `200`: `IntersectionApproachResponse[]`.

DTO shape:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "incoming_edge_id": "uuid",
  "incoming_edge_code": "E_in",
  "incoming_edge_name": "Incoming",
  "order_index": 0,
  "name": "North approach",
  "created_at": "...",
  "updated_at": "..."
}
```

## POST `/projects/{project_id}/intersections/{intersection_id}/movements/sync`

Синхронизация `Movement` из текущих `Connection` данного узла.

Request (`MovementsSyncRequest`):

```json
{
  "add_missing_only": true,
  "remove_stale": false,
  "default_is_enabled": true
}
```

Response `200` (`MovementsSyncResponse`):

```json
{
  "intersection_id": "uuid",
  "created_count": 4,
  "updated_count": 1,
  "deleted_count": 0,
  "stale_count": 2,
  "movements": [],
  "diagnostics": [
    "connections=8",
    "movements_existing=6",
    "created=4",
    "updated=1",
    "stale_detected=2",
    "stale_removed=0",
    "skipped_without_approach=0"
  ]
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/movements`

Response `200`: `MovementResponse[]`.

DTO shape:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "approach_id": "uuid",
  "connection_id": "uuid",
  "from_edge_id": "uuid",
  "to_edge_id": "uuid",
  "from_lane_index": 0,
  "to_lane_index": 0,
  "is_enabled": true,
  "movement_kind": null,
  "created_at": "...",
  "updated_at": "..."
}
```

## PATCH `/projects/{project_id}/intersections/{intersection_id}/movements/{movement_id}`

Включить/выключить movement и/или обновить `movement_kind`.

Request (`MovementPatchRequest`):

```json
{
  "is_enabled": false,
  "movement_kind": "left"
}
```

Response `200`: `MovementResponse`.

## GET `/projects/{project_id}/intersections/{intersection_id}/editor`

Полная editor-карточка.

Response `200` (`IntersectionEditorResponse`):

```json
{
  "intersection": {
    "id": "uuid",
    "project_id": "uuid",
    "node_id": "uuid",
    "kind": "crossroad",
    "name": "Main crossing",
    "created_at": "...",
    "updated_at": "..."
  },
  "node": {
    "id": "uuid",
    "code": "N1",
    "x": 100.0,
    "y": 200.0,
    "type": null
  },
  "incoming_edges": [],
  "outgoing_edges": [],
  "approaches": [],
  "movements": [],
  "diagnostics": {
    "intersection_id": "uuid",
    "is_valid": true,
    "empty_approaches": [],
    "missing_movements": [],
    "stale_movements": [],
    "warnings": [],
    "errors": []
  }
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/validation`

Response `200` (`IntersectionValidationResponse`):

```json
{
  "intersection_id": "uuid",
  "is_valid": false,
  "empty_approaches": ["approach_uuid"],
  "missing_movements": ["connection_uuid"],
  "stale_movements": [],
  "warnings": [],
  "errors": [
    "Some approaches have no enabled movements",
    "Some node connections are not wrapped into movements"
  ]
}
```

## Important Semantics (Intersection Layer)

1. `Intersection` — отдельная конфигурация поверх `Node`, не замена `Node`.
2. `Movement` source of truth:
   - `connection_id` первичен,
   - `from/to edge + lane` в movement хранятся как editor-friendly snapshot.
3. `Approaches sync`:
   - default: add missing only,
   - stale approaches удаляются только при `remove_stale=true` или full sync (`add_missing_only=false`).
4. `Movements sync`:
   - default: create missing + update mapping,
   - stale movements по умолчанию сохраняются и видны в diagnostics/validation,
   - stale удаляются только при `remove_stale=true` или full sync.
5. Disable semantics:
   - запрет маневра делается через `is_enabled=false`, movement не удаляется.
6. Underlying deletion behavior:
   - при удалении `Connection` связанный `Movement` удаляется каскадно FK.

## Typical Error Cases

`400` invalid node for intersection:

```json
{"detail": "Intersection node must have at least one incoming and one outgoing edge"}
```

`400` invalid movement patch:

```json
{"detail": "PATCH payload must include at least one field"}
```

`404` not found in project scope:

```json
{"detail": "Intersection '...' not found in project '...'"}
```

`409` duplicates:

```json
{"detail": "Intersection already exists for node '...'"}
```
