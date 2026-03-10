# Domain Contract (Stage: Network + Segment Editor + Connection + Intersection + Priority/Signs + Pedestrian Crossings)

## Purpose

Документ фиксирует активную доменную модель backend:
- topology layer: `Node/Edge/Lane/RoadType`,
- traversability layer: `Connection`,
- intersection editor layer: `Intersection/IntersectionApproach/Movement`,
- priority/sign layer: `IntersectionApproach.role/priority_rank` + `TrafficSign`,
- pedestrian layer: `PedestrianCrossing`.

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Node` и `Intersection` разделены по ответственности.
- `Connection` хранит lane-level топологию; `Movement` — editor-level управление маневром.
- Priority layer живет на `IntersectionApproach`, без отдельной схемной таблицы.
- Pedestrian crossings — отдельная сущность, а не boolean-флаг на approach.
- `side_key` — source of truth для идентификации стороны crossing в intersection.

## Active Entities

## Project

Root aggregate.

Поля:
- `id`
- `name`
- `description`
- `created_at`
- `updated_at`

## Node

Топологическая точка сети.

Поля:
- `id`
- `project_id`
- `code`
- `x`, `y`
- `type` nullable
- `created_at`
- `updated_at`

Семантика:
- incoming edges: `to_node_id == node.id`
- outgoing edges: `from_node_id == node.id`

## Edge

Directed road segment.

Поля:
- `id`
- `project_id`
- `code`
- `from_node_id`
- `to_node_id`
- `road_type_id` nullable
- `name` nullable
- `speed` nullable
- `priority` nullable
- `length` nullable
- `width` nullable
- `sidewalk_width` nullable
- `shape` (JSON polyline)
- `created_at`
- `updated_at`

## Lane

Lane in edge.

Поля:
- `id`
- `edge_id`
- `index`
- `allow` nullable
- `disallow` nullable
- `speed` nullable
- `width` nullable
- `created_at`
- `updated_at`

## RoadType

Defaults-шаблон параметров edge.

Поля:
- `id`
- `project_id`
- `code`
- `name` nullable
- `num_lanes` nullable
- `speed` nullable
- `priority` nullable
- `width` nullable
- `sidewalk_width` nullable
- `created_at`
- `updated_at`

Семантика:
- snapshot defaults (применение в edge копирует значения в edge).

## Connection

Lane-level directed transition через `via_node`.

Поля:
- `id`
- `project_id`
- `via_node_id`
- `from_edge_id`
- `to_edge_id`
- `from_lane_index`
- `to_lane_index`
- `uncontrolled`
- `created_at`
- `updated_at`

Инварианты:
- `from_edge.to_node_id == to_edge.from_node_id == via_node_id`
- lane-index существует на соответствующем edge
- unique `(project_id, from_edge_id, to_edge_id, from_lane_index, to_lane_index)`

## Intersection

Editor-конфигурация поверх `Node`.

Поля:
- `id`
- `project_id`
- `node_id`
- `kind` (`crossroad` | `roundabout`)
- `name` nullable
- `created_at`
- `updated_at`

Инварианты:
- один `Node` -> максимум один `Intersection`.

## IntersectionApproach

Опорная сущность incoming edge в intersection.

Поля:
- `id`
- `project_id`
- `intersection_id`
- `incoming_edge_id`
- `order_index` nullable
- `name` nullable
- `role` nullable (`main` | `secondary`)
- `priority_rank` nullable (`>= 0`)
- `created_at`
- `updated_at`

Инварианты:
- unique `(intersection_id, incoming_edge_id)`
- `incoming_edge_id` должен быть incoming для `intersection.node_id`

## Movement

Разрешенный маневр editor-layer поверх `Connection`.

Поля:
- `id`
- `project_id`
- `intersection_id`
- `approach_id`
- `connection_id`
- `from_edge_id`
- `to_edge_id`
- `from_lane_index`
- `to_lane_index`
- `is_enabled`
- `movement_kind` nullable
- `created_at`
- `updated_at`

Source of truth:
- `connection_id`.
- `from/to edge + lane` — denormalized snapshot для editor.

## TrafficSign

Persisted знак для editor/export.

Поля:
- `id`
- `project_id`
- `intersection_id` nullable
- `approach_id` nullable
- `node_id` nullable
- `edge_id` nullable
- `sign_type` (`main_road` | `yield` | `stop`)
- `generated`
- `metadata` JSON nullable
- `created_at`
- `updated_at`

## PedestrianCrossing

Persisted pedestrian crossing на стороне intersection.

Поля:
- `id`
- `project_id`
- `intersection_id`
- `approach_id` nullable
- `side_key`
- `is_enabled`
- `name` nullable
- `crossing_kind` nullable (`zebra` | `signalized` | `uncontrolled`)
- `created_at`
- `updated_at`

Инварианты:
- unique `(intersection_id, side_key)` — один crossing на сторону.
- `side_key` = source of truth идентификатора стороны.
- `approach_id` — optional link на `IntersectionApproach`.

## Priority/Sign Decisions (MVP)

1. Source of truth priority scheme:
- `IntersectionApproach.role` + `IntersectionApproach.priority_rank`.

2. Draft policy:
- неполная схема разрешена.
- validation показывает `is_valid/is_complete`.

3. Sign persistence:
- generated signs persisted, manual signs не затираются.

4. Secondary sign policy:
- default secondary -> `yield`, `stop` только явным параметром.

5. Export hints:
- `priority_stop` если схема валидна и есть `stop`,
- `priority` если валидна без `stop`,
- иначе `node_type = null`.

## Pedestrian Crossing Decisions (MVP)

1. Side semantics:
- `side_key` технический стабильный ключ стороны.
- текущий формат candidate sides: `approach:{approach_id}`.

2. Source of truth:
- `side_key` определяет сторону и уникальность.
- `approach_id` вторичен, для editor/topology связи.

3. Uniqueness policy:
- один crossing на сторону (`unique(intersection_id, side_key)`).

4. Disable semantics:
- `is_enabled=false` отключает crossing без удаления.
- физическое удаление — отдельная delete-операция.

5. Candidate sides derivation:
- строится из текущих `IntersectionApproach`.
- если approaches есть, `side_key` обязан соответствовать candidate side.

## Existing Stage Decisions (unchanged)

1. `shape` хранится JSON-массивом точек в `edges.shape`.
2. `numLanes` derived: `len(edge.lanes)`.
3. `RoadType` — snapshot defaults.
4. `Connection` autogenerate: add-missing only.
5. U-turn: не авто-генерируется по умолчанию.

## Deferred Next Stages

- pedestrian conflict matrix
- pedestrian priorities/right-of-way engine
- traffic light phases/signal groups
- conflict matrix для vehicle movements
- detailed crossing geometry/markup
- full SUMO XML pipeline (import/export orchestration)
