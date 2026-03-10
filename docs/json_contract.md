# JSON Contract (Stage: Network + Road Segment Editor + Connection Layer)

Base URL: `/`  
Content-Type: `application/json`

## Error Format

```json
{
  "detail": "human-readable error message"
}
```

Коды:
- `400` бизнес-валидация
- `404` сущность не найдена в project scope
- `409` конфликт ограничений/дубликаты
- `422` schema validation error

## Shared DTO Fragments

### Point

```json
{"x": 10.0, "y": 20.0}
```

### Shape

```json
[
  {"x": 10.0, "y": 20.0},
  {"x": 15.0, "y": 25.0}
]
```

### Lane item

```json
{
  "index": 0,
  "allow": "passenger bus",
  "disallow": "tram",
  "speed": 13.9,
  "width": 3.5
}
```

`allow/disallow`:
- хранение в БД: `TEXT`
- формат: deduplicated space-separated
- пересечения значений между `allow` и `disallow` запрещены

## Existing Endpoints (foundation/network/road-segment-editor)

- `GET /health`

- `POST /projects`
- `GET /projects`
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}`
- `DELETE /projects/{project_id}`
- `GET /projects/{project_id}/network`

- `POST /projects/{project_id}/nodes`
- `GET /projects/{project_id}/nodes`
- `PATCH /projects/{project_id}/nodes/{node_id}`
- `DELETE /projects/{project_id}/nodes/{node_id}`

- `POST /projects/{project_id}/road-types`
- `GET /projects/{project_id}/road-types`
- `PATCH /projects/{project_id}/road-types/{road_type_id}`

- `POST /projects/{project_id}/edges`
- `POST /projects/{project_id}/edges/bidirectional`
- `GET /projects/{project_id}/edges`
- `GET /projects/{project_id}/edges/{edge_id}`
- `GET /projects/{project_id}/edges/{edge_id}/editor`
- `PATCH /projects/{project_id}/edges/{edge_id}`
- `PATCH /projects/{project_id}/edges/{edge_id}/shape`
- `POST /projects/{project_id}/edges/{edge_id}/recalculate-length`
- `PUT /projects/{project_id}/edges/{edge_id}/lanes`
- `PATCH /projects/{project_id}/edges/{edge_id}/lanes/{lane_id}`
- `POST /projects/{project_id}/edges/{edge_id}/apply-road-type`

## Connection Layer Endpoints

## POST `/projects/{project_id}/connections`

Создать lane-level transition через узел.

Request (`ConnectionCreateRequest`):

```json
{
  "via_node_id": "uuid",
  "from_edge_id": "uuid",
  "to_edge_id": "uuid",
  "from_lane_index": 0,
  "to_lane_index": 0,
  "uncontrolled": false
}
```

Response `201` (`ConnectionResponse`):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "via_node_id": "uuid",
  "from_edge_id": "uuid",
  "to_edge_id": "uuid",
  "from_lane_index": 0,
  "to_lane_index": 0,
  "uncontrolled": false,
  "from_edge_code": "E_in",
  "to_edge_code": "E_out",
  "via_node_code": "N1",
  "from_edge_name": "Incoming",
  "to_edge_name": "Outgoing",
  "created_at": "2026-03-10T00:00:00Z",
  "updated_at": "2026-03-10T00:00:00Z"
}
```

Валидация:
- topology: `from_edge.to_node_id == to_edge.from_node_id == via_node_id`
- lane indexes существуют на соответствующих edge
- сущности принадлежат одному проекту
- уникальность `(project_id, from_edge_id, to_edge_id, from_lane_index, to_lane_index)`

## PATCH `/projects/{project_id}/connections/{connection_id}`

Изменить mutable-поля (`ConnectionPatchRequest`).

Request:

```json
{
  "uncontrolled": true
}
```

Response `200`: `ConnectionResponse`.

## DELETE `/projects/{project_id}/connections/{connection_id}`

Удаление connection в пределах project scope.

Response `204`.

## GET `/projects/{project_id}/nodes/{node_id}/connections`

Editor-friendly payload для узла.

Response `200` (`NodeConnectionsResponse`):

```json
{
  "node": {"id": "uuid", "code": "N1"},
  "incoming_edges": [
    {"id": "uuid", "code": "E_in", "name": "Incoming", "from_node_id": "uuid", "to_node_id": "uuid", "num_lanes": 2}
  ],
  "outgoing_edges": [
    {"id": "uuid", "code": "E_out", "name": "Outgoing", "from_node_id": "uuid", "to_node_id": "uuid", "num_lanes": 2}
  ],
  "connections": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "via_node_id": "uuid",
      "from_edge_id": "uuid",
      "to_edge_id": "uuid",
      "from_lane_index": 0,
      "to_lane_index": 0,
      "uncontrolled": false,
      "from_edge_code": "E_in",
      "to_edge_code": "E_out",
      "via_node_code": "N1",
      "from_edge_name": "Incoming",
      "to_edge_name": "Outgoing",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

## GET `/projects/{project_id}/nodes/{node_id}/connection-candidates`

Диагностика входящих/исходящих пар для узла.

Response `200` (`ConnectionCandidatesResponse`):

```json
{
  "node_id": "uuid",
  "incoming_edges": [],
  "outgoing_edges": [],
  "valid_pairs": [
    {
      "from_edge_id": "uuid",
      "from_edge_code": "E_in",
      "to_edge_id": "uuid",
      "to_edge_code": "E_out",
      "is_u_turn": false,
      "lane_mapping_count": 2
    }
  ],
  "invalid_pairs": [],
  "diagnostics": [
    "incoming=1, outgoing=1, candidate_pairs=1",
    "valid_pairs=1, invalid_pairs=0",
    "u_turn_pairs=0"
  ]
}
```

## POST `/projects/{project_id}/nodes/{node_id}/connections/autogenerate`

Автогенерация базовых connections.

Request (`ConnectionAutogenerateRequest`):

```json
{
  "add_missing_only": true,
  "allow_u_turns": false,
  "uncontrolled": false
}
```

MVP semantics:
- создаются только отсутствующие связи (`add-missing only`)
- mapping: `0->0`, `1->1`, ... до `min(num_from_lanes, num_to_lanes)-1`
- U-turn автоматически не генерируются, если `allow_u_turns=false`

Response `200` (`ConnectionAutogenerateResponse`):

```json
{
  "node_id": "uuid",
  "considered_pairs": 6,
  "created_count": 4,
  "skipped_duplicates": 2,
  "skipped_u_turns": 1,
  "created_connections": [],
  "diagnostics": [
    "incoming=2, outgoing=3, candidate_pairs=6",
    "valid_pairs=6, invalid_pairs=0",
    "u_turn_pairs=1",
    "created=4",
    "skipped_duplicates=2",
    "skipped_u_turns=1"
  ]
}
```

## Important Behavioral Rules

1. `via_node_id` хранится явно и валидируется сервисом против `from_edge/to_edge` topology.
2. `autogenerate` не удаляет существующие connection.
3. U-turn:
   - auto: только если `allow_u_turns=true`,
   - manual create: разрешен при валидной topology/lane existence.
4. Lane destructive change:
   - если после `PUT /lanes` или `PATCH lane index` существующие connection становятся невалидными, операция отклоняется `400`.
5. Edge delete (когда будет endpoint):
   - связанные connection удаляются каскадно через FK (`ondelete=CASCADE`).

## Typical Error Scenarios

`400` topology mismatch:

```json
{
  "detail": "via_node_id must match shared node of from_edge/to_edge"
}
```

`400` lane index missing:

```json
{
  "detail": "from_lane_index=3 does not exist on edge '...', available indexes: [0, 1]"
}
```

`400` lane change would break connections:

```json
{
  "detail": "Lane change would invalidate existing connections. Update/delete these connections first: ..."
}
```

`404` project scope miss:

```json
{
  "detail": "Connection '...' not found in project '...'"
}
```

`409` duplicate:

```json
{
  "detail": "Connection with the same from/to edges and lane indexes already exists"
}
```
