# Domain Contract (Stage: Network + Segment Editor + Connection + Intersection + Priority & Signs)

## Purpose

Документ фиксирует активную доменную модель backend:
- topology layer: `Node/Edge/Lane/RoadType`,
- traversability layer: `Connection`,
- intersection editor layer: `Intersection/IntersectionApproach/Movement`,
- priority/sign layer: `approach.role/priority_rank` + `TrafficSign`.

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Node` и `Intersection` разделены по ответственности:
  - `Node` = геометрия и топология графа.
  - `Intersection` = редакторская настройка узла.
- `Connection` и `Movement` не дублируют источник истины:
  - `Connection` хранит lane-level переход через node.
  - `Movement` — intersection-wrapper поверх connection (`is_enabled`, metadata).
- Priority layer строится поверх `IntersectionApproach`, не создает второй граф.
- Модель остается SUMO-ready без преждевременного усложнения.

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
- `from_edge_id` (incoming edge)
- `to_edge_id` (outgoing edge)
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
- один `Node` -> максимум один `Intersection` (`unique(node_id)`).

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
- `role` check: `main|secondary|null`

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
- `connection_id` — первичный источник истины.
- `from/to edge + lane` — denormalized editor snapshot.

## TrafficSign

Persisted знак для editor/export подготовки.

Поля:
- `id`
- `project_id`
- `intersection_id` nullable
- `approach_id` nullable
- `node_id` nullable
- `edge_id` nullable
- `sign_type` (`main_road` | `yield` | `stop`)
- `generated` bool
- `metadata` JSON nullable
- `created_at`
- `updated_at`

Инварианты:
- должна быть хотя бы одна scope-привязка (`intersection_id` или `node_id` или `edge_id`)
- generated signs по intersection+approach+type не дублируются.

## Priority/Sign Decisions (MVP)

1. Source of truth priority scheme:
- `IntersectionApproach.role` + `IntersectionApproach.priority_rank`.
- отдельная `priority_scheme` таблица не вводится.

2. Draft policy:
- неполная схема разрешена к сохранению (draft режим).
- отдельная validation-операция возвращает `is_valid/is_complete`.
- экспорт/генерация знаков требуют валидной схемы.

3. Sign persistence policy:
- `TrafficSign` хранится в БД.
- generated signs создаются/обновляются сервисом.
- ручные (`generated=false`) не затираются генератором.

4. Yield/stop policy:
- default secondary -> `yield`.
- `stop` включается явно через policy параметр генерации.

5. Export hints:
- derived helper возвращает `node_type`.
- если приоритетная схема валидна и есть `stop` signs -> `priority_stop`.
- если валидна без `stop` -> `priority`.
- иначе `node_type = null`.

6. Regeneration semantics:
- strategy: upsert generated signs + remove stale generated signs для intersection.
- manual signs не удаляются.

## Existing Stage Decisions (unchanged)

1. `shape` хранится JSON-массивом точек в `edges.shape`.
2. `numLanes` derived: `len(edge.lanes)`.
3. `RoadType` — snapshot defaults.
4. `Connection` autogenerate: add-missing only.
5. U-turn: не авто-генерируется по умолчанию.

## Deferred Next Stages

- traffic light phases/signal groups
- conflict matrix / right-of-way engine
- pedestrian crossing layer
- roundabout-specific yield logic
- full SUMO XML pipeline (import/export orchestration)
