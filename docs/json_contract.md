# JSON Contract (Stage: Priority & Signs over Intersection Editor)

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

- Foundation + Project + Network + Segment editor endpoints.
- Connection layer endpoints.
- Intersection editor endpoints:
  - create/get/patch intersection
  - sync/list approaches
  - sync/list/patch movements
  - editor card + validation

## Priority & Signs Endpoints

## PATCH `/projects/{project_id}/intersections/{intersection_id}/approaches/{approach_id}`

Обновляет `role`/`priority_rank` у одного подхода.

Request (`IntersectionApproachPriorityPatchRequest`):

```json
{
  "role": "main",
  "priority_rank": 0
}
```

Response `200` (`IntersectionApproachResponse`):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "incoming_edge_id": "uuid",
  "incoming_edge_code": "E_in_north",
  "incoming_edge_name": "North In",
  "order_index": 0,
  "name": "North",
  "role": "main",
  "priority_rank": 0,
  "created_at": "2026-03-11T00:00:00Z",
  "updated_at": "2026-03-11T00:01:00Z"
}
```

## PUT `/projects/{project_id}/intersections/{intersection_id}/priority-scheme`

Массово обновляет схему по approaches.

Request (`PrioritySchemePutRequest`):

```json
{
  "items": [
    {"approach_id": "a1", "role": "main", "priority_rank": 0},
    {"approach_id": "a2", "role": "main", "priority_rank": 1},
    {"approach_id": "a3", "role": "secondary", "priority_rank": 0},
    {"approach_id": "a4", "role": "secondary", "priority_rank": 1}
  ],
  "reset_missing": false
}
```

Response `200` (`PrioritySchemeResponse`):

```json
{
  "intersection_id": "uuid",
  "approaches": [],
  "summary": {
    "main_count": 2,
    "secondary_count": 2,
    "unassigned_count": 0,
    "is_complete": true,
    "has_conflicts": false
  }
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/priority-scheme`

Возвращает текущую схему (`PrioritySchemeResponse`).

## GET `/projects/{project_id}/intersections/{intersection_id}/priority-validation`

Валидация схемы (`PrioritySchemeValidationResponse`).

Response `200`:

```json
{
  "intersection_id": "uuid",
  "is_valid": true,
  "is_complete": true,
  "missing_roles": [],
  "warnings": [],
  "errors": [],
  "exportable_as_priority_controlled": true
}
```

## POST `/projects/{project_id}/intersections/{intersection_id}/signs/generate`

Генерирует/обновляет persisted generated signs.

Request (`SignGenerationRequest`):

```json
{
  "secondary_sign_type": "yield"
}
```

Допустимые значения `secondary_sign_type`:
- `yield` (default)
- `stop`

Response `200` (`SignGenerationResponse`):

```json
{
  "intersection_id": "uuid",
  "secondary_sign_type": "yield",
  "created_count": 4,
  "updated_count": 0,
  "deleted_count": 1,
  "signs": [],
  "diagnostics": [
    "approaches=4",
    "desired_generated=4",
    "created=4",
    "updated=0",
    "deleted_stale_generated=1",
    "secondary_sign_type=yield"
  ]
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/signs`

Список знаков пересечения (`TrafficSignResponse[]`).

TrafficSign DTO:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "approach_id": "uuid",
  "node_id": "uuid",
  "edge_id": "uuid",
  "sign_type": "yield",
  "generated": true,
  "metadata": {
    "source": "priority_scheme",
    "role": "secondary",
    "priority_rank": 0
  },
  "created_at": "2026-03-11T00:00:00Z",
  "updated_at": "2026-03-11T00:00:00Z"
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/export-hints`

Derived hints для экспортера (`IntersectionExportHintsResponse`).

Response `200`:

```json
{
  "intersection_id": "uuid",
  "node_type": "priority_stop",
  "priority_controlled": true,
  "requires_stop_signs": true,
  "requires_yield_signs": false,
  "notes": []
}
```

## Updated Intersection Editor Card

`GET /projects/{project_id}/intersections/{intersection_id}/editor` дополнен:
- `priority_scheme`
- `generated_signs`
- `export_hints`

## Validation/Business Rules

1. `role`:
- `main | secondary | null`

2. `priority_rank`:
- nullable
- если задан: `>= 0`

3. Draft policy:
- неполная схема разрешена к сохранению
- `priority-validation` возвращает `is_valid=false` до завершения схемы

4. Схема считается export-ready когда:
- все approaches имеют роль
- есть минимум один `main`
- нет conflict-ов rank/role

5. Sign generation:
- работает только при валидной схеме
- upsert only generated signs
- stale generated signs удаляются
- manual signs (`generated=false`) не трогаются

6. Secondary sign policy:
- default `secondary -> yield`
- `stop` только через явный `secondary_sign_type=stop`

## Typical Error Cases

`400` empty PATCH:

```json
{"detail": "PATCH payload must include at least one field"}
```

`400` invalid generation on incomplete scheme:

```json
{"detail": "Cannot generate signs: Some approaches have no assigned role; Priority scheme requires at least one main approach"}
```

`404` approach not in intersection:

```json
{"detail": "Approach '...' not found in intersection '...'"}
```

`409` DB-level conflicts:

```json
{"detail": "Priority scheme update violates constraints"}
```
