# JSON Contract (Stage: Network Constructor)

Base URL: `/`
Content-Type: `application/json`

## Error format

```json
{
  "detail": "human-readable error message"
}
```

Типовые коды:
- `400` validation/business rule error
- `404` entity not found in project scope
- `409` unique/dependency conflict
- `422` FastAPI schema validation error

## Data formats

### Point / Shape

```json
{
  "x": 10.0,
  "y": 20.0
}
```

`shape`:

```json
[
  {"x": 10.0, "y": 20.0},
  {"x": 15.0, "y": 25.0}
]
```

### Lane payload

```json
{
  "index": 0,
  "allow": "passenger bus",
  "speed": 13.9,
  "width": 3.5
}
```

---

## Project

### POST `/projects`

Request:

```json
{
  "name": "City center",
  "description": "Network constructor demo"
}
```

Response `201`:

```json
{
  "id": "uuid",
  "name": "City center",
  "description": "Network constructor demo",
  "created_at": "2026-03-10T12:00:00Z",
  "updated_at": "2026-03-10T12:00:00Z"
}
```

### GET `/projects`

Response `200`: список `Project[]`.

### GET `/projects/{project_id}`

Response `200`: `Project` object (как выше).

### GET `/projects/{project_id}/network`

Response `200`:

```json
{
  "project": {"id": "uuid", "name": "City center", "description": null, "created_at": "...", "updated_at": "..."},
  "nodes": [],
  "road_types": [],
  "edges": []
}
```

---

## Nodes

### POST `/projects/{project_id}/nodes`

Request:

```json
{
  "code": "N1",
  "x": 100.0,
  "y": 200.0,
  "type": "priority"
}
```

Response `201`:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "N1",
  "x": 100.0,
  "y": 200.0,
  "type": "priority",
  "created_at": "...",
  "updated_at": "..."
}
```

### GET `/projects/{project_id}/nodes`

Response `200`: `Node[]`.

### PATCH `/projects/{project_id}/nodes/{node_id}`

Request:

```json
{
  "x": 110.0,
  "y": 205.0
}
```

Response `200`: updated `Node`.

Notes:
- при перемещении `Node` backend автоматически корректирует концы связанных `Edge.shape`.

### DELETE `/projects/{project_id}/nodes/{node_id}`

Response `204`.

Conflict `409` example:

```json
{
  "detail": "Node cannot be deleted while it is referenced by edges"
}
```

---

## Road Types

### POST `/projects/{project_id}/road-types`

Request:

```json
{
  "code": "urban_main",
  "name": "Urban main road",
  "num_lanes": 2,
  "speed": 13.9,
  "priority": 3,
  "width": 3.5,
  "sidewalk_width": 1.5
}
```

Response `201`:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "urban_main",
  "name": "Urban main road",
  "num_lanes": 2,
  "speed": 13.9,
  "priority": 3,
  "width": 3.5,
  "sidewalk_width": 1.5,
  "created_at": "...",
  "updated_at": "..."
}
```

### GET `/projects/{project_id}/road-types`

Response `200`: `RoadType[]`.

### PATCH `/projects/{project_id}/road-types/{road_type_id}`

Request:

```json
{
  "speed": 16.7,
  "priority": 4
}
```

Response `200`: updated `RoadType`.

---

## Edges

### POST `/projects/{project_id}/edges`

Create directed edge.

Request:

```json
{
  "code": "E1",
  "from_node_id": "uuid",
  "to_node_id": "uuid",
  "road_type_id": "uuid",
  "name": "Main eastbound",
  "shape": [
    {"x": 100.0, "y": 200.0},
    {"x": 130.0, "y": 210.0}
  ],
  "lanes": [
    {"index": 0, "allow": "passenger", "speed": 13.9, "width": 3.5}
  ]
}
```

Response `201`:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "E1",
  "from_node_id": "uuid",
  "to_node_id": "uuid",
  "road_type_id": "uuid",
  "name": "Main eastbound",
  "speed": 13.9,
  "priority": 3,
  "length": 31.62,
  "width": 3.5,
  "sidewalk_width": 1.5,
  "shape": [
    {"x": 100.0, "y": 200.0},
    {"x": 130.0, "y": 210.0}
  ],
  "lanes": [
    {"id": "uuid", "edge_id": "uuid", "index": 0, "allow": "passenger", "speed": 13.9, "width": 3.5, "created_at": "...", "updated_at": "..."}
  ],
  "num_lanes": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

### POST `/projects/{project_id}/edges/bidirectional`

Create two opposite directed edges.

Request:

```json
{
  "forward_code": "E1_fwd",
  "reverse_code": "E1_rev",
  "from_node_id": "uuid",
  "to_node_id": "uuid",
  "road_type_id": "uuid",
  "shape": [
    {"x": 100.0, "y": 200.0},
    {"x": 130.0, "y": 210.0}
  ],
  "lanes": [
    {"index": 0, "allow": "passenger", "speed": 13.9, "width": 3.5}
  ]
}
```

Response `201`: `Edge[]` (2 элемента).

### GET `/projects/{project_id}/edges`

Response `200`: `Edge[]`.

### GET `/projects/{project_id}/edges/{edge_id}`

Response `200`: `Edge`.

### PATCH `/projects/{project_id}/edges/{edge_id}`

Request:

```json
{
  "name": "Updated name",
  "speed": 12.5
}
```

Response `200`: updated `Edge`.

### PATCH `/projects/{project_id}/edges/{edge_id}/shape`

Request:

```json
{
  "shape": [
    {"x": 100.0, "y": 200.0},
    {"x": 120.0, "y": 205.0},
    {"x": 130.0, "y": 210.0}
  ]
}
```

Response `200`: updated `Edge` (`length` пересчитан).

### PUT `/projects/{project_id}/edges/{edge_id}/lanes`

Полная замена массива полос.

Request:

```json
[
  {"index": 0, "allow": "passenger", "speed": 13.9, "width": 3.5},
  {"index": 1, "allow": "bus", "speed": 13.9, "width": 3.5}
]
```

Response `200`: updated `Edge`.

### PATCH `/projects/{project_id}/edges/{edge_id}/road-type`

Применяет defaults `RoadType` к фактическим полям edge (snapshot semantics).

Request:

```json
{
  "road_type_id": "uuid"
}
```

Response `200`: updated `Edge`.

---

## Typical error scenarios

### `400` (shape invalid)

```json
{
  "detail": "shape must contain at least 2 points"
}
```

### `400` (lane index invalid)

```json
{
  "detail": "Lane index must be >= 0"
}
```

### `404` (entity not in project)

```json
{
  "detail": "Node '...' not found in project '...'"
}
```

### `409` (unique code conflict)

```json
{
  "detail": "Edge with code 'E1' already exists in project"
}
```
