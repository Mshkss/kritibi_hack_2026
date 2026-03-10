# JSON Contract (Stage: Pedestrian Crossings over Intersection Editor)

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
- Intersection editor endpoints.
- Priority/sign endpoints.

## Pedestrian Crossing Endpoints

## POST `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossings`

Создает pedestrian crossing на стороне intersection.

Request (`PedestrianCrossingCreateRequest`):

```json
{
  "approach_id": "uuid",
  "side_key": "approach:uuid",
  "is_enabled": true,
  "name": "North crosswalk",
  "crossing_kind": "zebra"
}
```

Response `201` (`PedestrianCrossingResponse`):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "approach_id": "uuid",
  "side_key": "approach:uuid",
  "is_enabled": true,
  "name": "North crosswalk",
  "crossing_kind": "zebra",
  "incoming_edge_id": "uuid",
  "incoming_edge_code": "E_IN_N",
  "created_at": "2026-03-11T00:00:00Z",
  "updated_at": "2026-03-11T00:00:00Z"
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossings`

Возвращает crossings intersection.

Response `200` (`PedestrianCrossingListResponse`):

```json
{
  "intersection_id": "uuid",
  "crossings": []
}
```

## GET `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossings/{crossing_id}`

Response `200`: `PedestrianCrossingResponse`.

## PATCH `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossings/{crossing_id}`

Обновляет crossing.

Request (`PedestrianCrossingPatchRequest`):

```json
{
  "is_enabled": false,
  "name": "North crossing disabled",
  "crossing_kind": "signalized"
}
```

Response `200`: `PedestrianCrossingResponse`.

## DELETE `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossings/{crossing_id}`

Удаляет crossing.  
Response `204` (no body).

## GET `/projects/{project_id}/intersections/{intersection_id}/pedestrian-crossing-sides`

Возвращает candidate sides, построенные из approaches.

Response `200` (`PedestrianCrossingSidesResponse`):

```json
{
  "intersection_id": "uuid",
  "candidate_sides": [
    {
      "side_key": "approach:uuid",
      "approach_id": "uuid",
      "incoming_edge_id": "uuid",
      "incoming_edge_code": "E_IN_N",
      "already_has_crossing": true,
      "crossing_id": "uuid",
      "crossing_is_enabled": true
    }
  ],
  "warnings": [],
  "errors": []
}
```

## Side Key Semantics

1. `side_key` — source of truth стороны crossing.
2. В текущем MVP candidate side имеет формат `approach:{approach_id}`.
3. Если intersection имеет approaches, `side_key` должен совпадать с одним из candidate sides.
4. Если задан `approach_id`, `side_key` обязан совпадать с `approach:{approach_id}`.

## Uniqueness & Lifecycle

1. На одну сторону допускается только один crossing:
- `unique(intersection_id, side_key)`.

2. Disable vs delete:
- `is_enabled=false` сохраняет crossing, но отключает.
- физическое удаление — `DELETE`.

## Updated Intersection Editor Card

`GET /projects/{project_id}/intersections/{intersection_id}/editor` дополнен:
- `pedestrian_crossings[]`
- `pedestrian_crossing_sides`

## Validation / Error Cases

`400` invalid side_key:

```json
{"detail": "side_key '...' is invalid for intersection '...'"}
```

`400` approach mismatch:

```json
{"detail": "side_key '...' must match approach side 'approach:...'"}
```

`404` crossing not found:

```json
{"detail": "PedestrianCrossing '...' not found in intersection '...'"}
```

`409` duplicate side:

```json
{"detail": "PedestrianCrossing for side 'approach:...' already exists in intersection '...'"}
```
