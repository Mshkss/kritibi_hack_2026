# API Contract (MVP v1)

Документ синхронизирован с [Domain Contract](./dm.md) и отражает хакатонный MVP.

## 1) API Conventions

- Base URL: `/`
- Content type: `application/json`
- Идентификаторы: `uuid`
- Даты: ISO-8601 (`2026-03-10T12:00:00Z`)

### Ошибка (единый формат)

```json
{
  "detail": "Validation error",
  "errors": [
    {
      "field": "speed",
      "message": "must be > 0"
    }
  ]
}
```

---

## 2) Enums

### `Node.node_type`
- `junction`
- `shape`
- `dead_end`

### `Edge.surface`
- `asphalt`
- `concrete`
- `cobblestone`
- `gravel`
- `dirt`

### `Intersection.kind`
- `crossroad`
- `roundabout`

### `Intersection.control_type`
- `priority_signs`
- `traffic_light`
- `uncontrolled`

### `IntersectionApproach.role`
- `main`
- `secondary`
- `local`

### `Movement.turn_type`
- `left`
- `right`
- `straight`
- `u_turn`

### `PedestrianCrossing.placement_type`
- `intersection`
- `midblock`

### `TrafficSign.sign_type`
- `main_road`
- `yield`
- `stop`
- `no_entry`

### `RoadModifier.modifier_type`
- `speed_limit`
- `bus_stop`
- `parking_zone`
- `custom`

### `SignalGroup.group_type`
- `vehicle`
- `pedestrian`

### `PhaseSignal.state`
- `green`
- `yellow`
- `red`
- `walk`
- `dont_walk`
- `flashing`

---

## 3) DTO Schemas

Ниже canonical `Read`-формат. Для `Create` не передаются `id/created_at/updated_at`.
Для `Update` (`PATCH`) все поля частично-опциональны, кроме бизнес-ограничений.

### 3.1 Project

```json
{
  "id": "uuid",
  "name": "Krasnoyarsk center",
  "description": "Hackathon demo",
  "srid": 3857,
  "created_at": "2026-03-10T12:00:00Z",
  "updated_at": "2026-03-10T12:00:00Z"
}
```

### 3.2 Node

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "N-1001",
  "x": 312345.55,
  "y": 6244555.90,
  "node_type": "junction",
  "name": "Cross A"
}
```

### 3.3 RoadType

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "urban_2l",
  "name": "Urban 2 lanes",
  "default_speed": 50.0,
  "default_lanes": 2,
  "default_lane_width": 3.5,
  "default_surface": "asphalt",
  "default_allow": ["passenger", "bus"],
  "default_disallow": ["tram"]
}
```

### 3.4 Lane

```json
{
  "id": "uuid",
  "edge_id": "uuid",
  "lane_index": 0,
  "width": 3.5,
  "speed": 50.0,
  "allow": ["passenger", "bus"],
  "disallow": []
}
```

### 3.5 Edge

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "code": "E-5001",
  "from_node_id": "uuid",
  "to_node_id": "uuid",
  "road_type_id": "uuid",
  "name": "Main Street Eastbound",
  "speed": 50.0,
  "priority": 3,
  "length": 120.4,
  "surface": "asphalt",
  "shape": [
    { "x": 312345.55, "y": 6244555.90 },
    { "x": 312400.10, "y": 6244580.20 }
  ],
  "lanes": [
    {
      "id": "uuid",
      "edge_id": "uuid",
      "lane_index": 0,
      "width": 3.5,
      "speed": 50.0,
      "allow": ["passenger", "bus"],
      "disallow": []
    }
  ]
}
```

### 3.6 Connection

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "from_edge_id": "uuid",
  "to_edge_id": "uuid",
  "from_lane_index": 0,
  "to_lane_index": 0,
  "via_node_id": "uuid",
  "uncontrolled": false
}
```

### 3.7 Intersection

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "node_id": "uuid",
  "kind": "crossroad",
  "control_type": "traffic_light",
  "name": "Cross A"
}
```

### 3.8 IntersectionApproach

```json
{
  "id": "uuid",
  "intersection_id": "uuid",
  "incoming_edge_id": "uuid",
  "role": "main",
  "has_crosswalk": true,
  "priority_rank": 1
}
```

### 3.9 Movement

```json
{
  "id": "uuid",
  "intersection_id": "uuid",
  "connection_id": "uuid",
  "turn_type": "left",
  "is_allowed": true
}
```

### 3.10 PedestrianCrossing

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "placement_type": "intersection",
  "intersection_id": "uuid",
  "approach_id": "uuid",
  "edge_id": null,
  "offset": null,
  "width": 4.0,
  "has_signal": true,
  "name": "Crosswalk A"
}
```

`midblock` пример:

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "placement_type": "midblock",
  "intersection_id": null,
  "approach_id": null,
  "edge_id": "uuid",
  "offset": 43.5,
  "width": 3.0,
  "has_signal": false,
  "name": "Midblock 1"
}
```

### 3.11 TrafficSign

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "intersection_id": "uuid",
  "edge_id": "uuid",
  "sign_type": "yield",
  "position_offset": 12.0,
  "applies_to_lane_index": null
}
```

### 3.12 RoadModifier

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "edge_id": "uuid",
  "lane_index": null,
  "modifier_type": "speed_limit",
  "start_offset": 0.0,
  "end_offset": 45.0,
  "payload": {
    "speed": 40,
    "source": "sign"
  },
  "name": "School zone"
}
```

### 3.13 SignalGroup

```json
{
  "id": "uuid",
  "intersection_id": "uuid",
  "group_type": "vehicle",
  "movement_id": "uuid",
  "crossing_id": null,
  "name": "North straight+right"
}
```

### 3.14 Phase

```json
{
  "id": "uuid",
  "intersection_id": "uuid",
  "name": "P1",
  "duration": 25,
  "min_duration": 20,
  "max_duration": 35,
  "order_index": 0
}
```

### 3.15 PhaseSignal

```json
{
  "id": "uuid",
  "phase_id": "uuid",
  "signal_group_id": "uuid",
  "state": "green"
}
```

### 3.16 Project Snapshot

Агрегированный ответ для загрузки конструктора.

```json
{
  "project": { "id": "uuid", "name": "demo", "srid": 3857 },
  "nodes": [],
  "road_types": [],
  "edges": [],
  "connections": [],
  "intersections": [],
  "approaches": [],
  "movements": [],
  "pedestrian_crossings": [],
  "traffic_signs": [],
  "road_modifiers": [],
  "signal_groups": [],
  "phases": [],
  "phase_signals": []
}
```

---

## 4) Endpoints (MVP)

### 4.1 Health

- `GET /health`
  - `200 OK`: `{ "status": "ok" }`

### 4.2 Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}`
- `DELETE /projects/{project_id}`
- `GET /projects/{project_id}/snapshot`

### 4.3 Nodes

- `GET /nodes?project_id={uuid}`
- `POST /nodes`
- `GET /nodes/{node_id}`
- `PATCH /nodes/{node_id}`
- `DELETE /nodes/{node_id}`

### 4.4 Road Types

- `GET /road-types?project_id={uuid}`
- `POST /road-types`
- `GET /road-types/{road_type_id}`
- `PATCH /road-types/{road_type_id}`
- `DELETE /road-types/{road_type_id}`

### 4.5 Edges & Lanes

- `GET /edges?project_id={uuid}`
- `POST /edges`
- `GET /edges/{edge_id}`
- `PATCH /edges/{edge_id}`
- `DELETE /edges/{edge_id}`
- `PUT /edges/{edge_id}/lanes` (полная замена массива полос)

### 4.6 Connections

- `GET /connections?project_id={uuid}`
- `POST /connections`
- `GET /connections/{connection_id}`
- `PATCH /connections/{connection_id}`
- `DELETE /connections/{connection_id}`

### 4.7 Intersections

- `GET /intersections?project_id={uuid}`
- `POST /intersections`
- `GET /intersections/{intersection_id}`
- `PATCH /intersections/{intersection_id}`
- `DELETE /intersections/{intersection_id}`

### 4.8 Approaches

- `GET /intersections/{intersection_id}/approaches`
- `POST /intersections/{intersection_id}/approaches`
- `PATCH /approaches/{approach_id}`
- `DELETE /approaches/{approach_id}`

### 4.9 Movements

- `GET /intersections/{intersection_id}/movements`
- `POST /intersections/{intersection_id}/movements`
- `PATCH /movements/{movement_id}`
- `DELETE /movements/{movement_id}`

### 4.10 Pedestrian Crossings

- `GET /crossings?project_id={uuid}`
- `POST /crossings`
- `GET /crossings/{crossing_id}`
- `PATCH /crossings/{crossing_id}`
- `DELETE /crossings/{crossing_id}`

### 4.11 Traffic Signs

- `GET /signs?project_id={uuid}`
- `POST /signs`
- `GET /signs/{sign_id}`
- `PATCH /signs/{sign_id}`
- `DELETE /signs/{sign_id}`

### 4.12 Road Modifiers

- `GET /modifiers?project_id={uuid}`
- `POST /modifiers`
- `GET /modifiers/{modifier_id}`
- `PATCH /modifiers/{modifier_id}`
- `DELETE /modifiers/{modifier_id}`

### 4.13 Traffic Lights

- `GET /traffic-lights/intersections/{intersection_id}/signal-groups`
- `POST /traffic-lights/intersections/{intersection_id}/signal-groups`
- `PATCH /traffic-lights/signal-groups/{group_id}`
- `DELETE /traffic-lights/signal-groups/{group_id}`

- `GET /traffic-lights/intersections/{intersection_id}/phases`
- `POST /traffic-lights/intersections/{intersection_id}/phases`
- `PATCH /traffic-lights/phases/{phase_id}`
- `DELETE /traffic-lights/phases/{phase_id}`

- `PUT /traffic-lights/phases/{phase_id}/signals` (полная замена `PhaseSignal[]`)
- `POST /traffic-lights/intersections/{intersection_id}/validate`

Пример ответа валидации:

```json
{
  "valid": false,
  "errors": [
    {
      "code": "CONFLICTING_GREENS",
      "message": "Phase P2 has conflicting green movements",
      "phase_id": "uuid"
    }
  ]
}
```

---

## 5) Import / Export (SUMO)

### Export

- `POST /import-export/projects/{project_id}/sumo/export`

Ответ:

```json
{
  "project_id": "uuid",
  "files": {
    "nodes": "nodes.xml",
    "edges": "edges.xml",
    "types": "types.xml",
    "connections": "connections.xml"
  }
}
```

### Import

- `POST /import-export/sumo/import`
  - body: multipart (`nodes.xml`, `edges.xml`, `types.xml`, `connections.xml`) + `project_name`

Ответ:

```json
{
  "project_id": "uuid",
  "imported": {
    "nodes": 120,
    "edges": 210,
    "connections": 500
  }
}
```

---

## 6) Business Validation Rules (API level)

- `Intersection.control_type` — единственный источник истины по типу регулирования узла.
- Для `Node`, на который ссылается `Intersection`, `node_type` должен быть `junction`.
- `TrafficSign` не должен дублировать `RoadModifier` (`speed_limit`, `bus_stop`, `parking_zone` невалидны для `sign_type`).
- Для `RoadModifier` проверяются диапазоны `start_offset/end_offset` и схема `payload` в зависимости от `modifier_type`.
- Валидация фаз светофора выполняется динамически (без отдельной сущности `MovementConflict`).
