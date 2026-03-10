# JSON Contract (Stage: Network + Road Segment Editor)

Base URL: `/`  
Content-Type: `application/json`

## Error Format

```json
{
  "detail": "human-readable error message"
}
```

Типовые коды:
- `400` бизнес-валидация
- `404` сущность не найдена в скоупе проекта
- `409` конфликт ограничений
- `422` schema-level валидация FastAPI/Pydantic

## Shared DTO Fragments

### Point

```json
{
  "x": 10.0,
  "y": 20.0
}
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

`allow`/`disallow`:
- хранятся строкой в БД (`TEXT`)
- нормализуются в deduplicated space-separated вид
- не могут содержать пересечение одних и тех же классов

## Base Network Endpoints (unchanged)

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

## Road Segment Editor Endpoints

## GET `/projects/{project_id}/edges/{edge_id}/editor`

Карточка редактирования участка.

Response `200`:

```json
{
  "edge": {
    "id": "uuid",
    "project_id": "uuid",
    "code": "E1",
    "from_node_id": "uuid",
    "to_node_id": "uuid",
    "road_type_id": "uuid",
    "name": "Main eastbound",
    "speed": 13.9,
    "priority": 3,
    "length": 120.5,
    "width": 3.5,
    "sidewalk_width": 1.5,
    "shape": [{"x": 10.0, "y": 20.0}, {"x": 15.0, "y": 25.0}],
    "lanes": [
      {
        "id": "uuid",
        "edge_id": "uuid",
        "index": 0,
        "allow": "passenger",
        "disallow": "tram",
        "speed": 13.9,
        "width": 3.5,
        "created_at": "...",
        "updated_at": "..."
      }
    ],
    "num_lanes": 1,
    "created_at": "...",
    "updated_at": "..."
  },
  "road_type": {
    "id": "uuid",
    "project_id": "uuid",
    "code": "urban_main",
    "name": "Urban main",
    "num_lanes": 2,
    "speed": 13.9,
    "priority": 3,
    "width": 3.5,
    "sidewalk_width": 1.5,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## PATCH `/projects/{project_id}/edges/{edge_id}`

Редактирование свойств участка (`EdgePatchRequest`).

Request:

```json
{
  "name": "Updated segment",
  "speed": 12.5,
  "priority": 4,
  "length": 130.0,
  "width": 3.4,
  "sidewalk_width": 1.2,
  "road_type_id": "uuid"
}
```

Response `200`: `Edge`.

`length` semantics:
- если PATCH содержит `shape` и не содержит `length`, длина пересчитывается.
- если PATCH содержит `length`, значение считается явным override.

## PATCH `/projects/{project_id}/edges/{edge_id}/shape`

Request:

```json
{
  "shape": [
    {"x": 10.0, "y": 20.0},
    {"x": 12.0, "y": 21.0},
    {"x": 15.0, "y": 25.0}
  ]
}
```

Response `200`: `Edge` (длина пересчитана автоматически).

## POST `/projects/{project_id}/edges/{edge_id}/recalculate-length`

Явный пересчет длины по текущему `shape` + синхронизация крайних точек по node-coordinates.

Request body: пустой.

Response `200`: `Edge`.

## PUT `/projects/{project_id}/edges/{edge_id}/lanes`

Полная замена списка полос (`LaneReplaceListRequest`).

Request:

```json
{
  "lanes": [
    {"index": 0, "allow": "passenger", "disallow": "tram", "speed": 12.0, "width": 3.0},
    {"index": 1, "allow": "bus", "disallow": "passenger", "speed": 11.0, "width": 3.2}
  ]
}
```

Response `200`: `Edge`.

Правила:
- список не пустой,
- индексы уникальны,
- `index >= 0`.

## PATCH `/projects/{project_id}/edges/{edge_id}/lanes/{lane_id}`

Частичное изменение одной полосы (`LanePatchRequest`).

Request:

```json
{
  "index": 1,
  "allow": "bus taxi",
  "disallow": "passenger",
  "speed": 10.5,
  "width": 3.2
}
```

Response `200`: `Edge`.

Правила:
- нельзя получить конфликт `allow`/`disallow`,
- при изменении `index` проверяется уникальность внутри `edge`.

## POST `/projects/{project_id}/edges/{edge_id}/apply-road-type`

Применяет `RoadType` к edge по snapshot semantics (`ApplyRoadTypeRequest`).

Request:

```json
{
  "road_type_id": "uuid",
  "speed": null,
  "priority": null,
  "width": null,
  "sidewalk_width": null,
  "lane_speed": null,
  "lane_width": 3.3,
  "apply_to_lanes": true
}
```

Response `200`: `Edge`.

Семантика:
- `road_type_id` записывается в edge.
- edge-поля получают defaults road type, если не передан override.
- override-поля из request имеют приоритет.
- `apply_to_lanes=true` обновляет lane-level `speed/width`, сохраняя `allow/disallow`.

## Validation / Error Cases

`400` invalid shape:

```json
{
  "detail": "shape must contain at least 2 points"
}
```

`400` lane conflict:

```json
{
  "detail": "allow/disallow conflict for classes: bus"
}
```

`400` lane index invalid:

```json
{
  "detail": "Lane index must be >= 0"
}
```

`404` edge not in project:

```json
{
  "detail": "Edge '...' not found in project '...'"
}
```

`404` lane not in edge:

```json
{
  "detail": "Lane '...' not found in edge '...'"
}
```

`409` code uniqueness conflict:

```json
{
  "detail": "Edge with code 'E1' already exists in project"
}
```
