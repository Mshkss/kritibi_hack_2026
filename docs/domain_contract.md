# Domain Contract (Stage: Network + Segment Editor + Connection Layer + Intersection Editor)

## Purpose

Документ фиксирует активную доменную модель, в которой:
- `Node/Edge/Lane/RoadType` задают дорожный граф и параметры сегментов,
- `Connection` задает lane-level topological traversability через узел,
- `Intersection/Approach/Movement` дают editor-layer настройки узла для будущей логики приоритетов/пешеходов/сигналов.

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Node` не заменяется `Intersection`; `Intersection` — надстройка над `Node`.
- `Connection` и `Movement` не дублируют ответственность:
  - `Connection` = топологически допустимый lane-level переход через node.
  - `Movement` = управляемая intersection-editor запись поверх `Connection` (enable/disable, metadata).
- Минимизация неявных массовых эффектов и сохранение предсказуемого поведения sync-операций.
- SUMO-ready структура (включая `.con.xml`-эквивалент).

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

Опорная сущность для каждого incoming edge intersection.

Поля:
- `id`
- `project_id`
- `intersection_id`
- `incoming_edge_id`
- `order_index` nullable
- `name` nullable
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
- `connection_id` — первичный источник истины.
- `from/to edge + lane` в `movements` — editor-friendly денормализация/снимок.

Инварианты:
- unique `(intersection_id, connection_id)`
- `connection` должен проходить через `intersection.node_id`
- `approach` должен принадлежать тому же `intersection`

## Key Semantics

## Intersection over Node

- `Node` остается геометрией/топологией.
- `Intersection` добавляет редакторскую конфигурацию, не дублируя граф.

## Movement vs Connection

- `Connection` хранит допускаемость перехода в графе.
- `Movement` хранит intersection-level состояние (главное: `is_enabled`), опираясь на `Connection`.

## Disable Semantics

- запрет маневра = `movement.is_enabled=false`.
- это не физическое удаление movement.
- удаление movement используется только в технической sync/rebuild логике, если включен `remove_stale`.

## Sync Strategies (MVP)

## Approaches Sync

- по умолчанию `add missing only`.
- stale approaches (edge больше не incoming) не удаляются автоматически без запроса.
- при `remove_stale=true` (или `add_missing_only=false`) stale approaches удаляются технически.

## Movements Sync

- по умолчанию: create missing from current connections + update mappings при необходимости.
- stale movements по умолчанию сохраняются (для диагностики) и не удаляются.
- при `remove_stale=true` (или `add_missing_only=false`) stale movements удаляются технически.

## Underlying Changes Strategy

- если `Connection` удален, связанные `Movement` удаляются каскадно через FK (`ondelete=CASCADE`).
- если `incoming edge` перестал быть incoming (например topology изменилась), approach становится stale до явного sync с удалением stale.
- destructive lane change, ломающий `Connection`, блокируется на уровне segment editor.

## Existing Segment/Connection Decisions (unchanged)

1. `shape` хранится JSON-массивом точек в `edges.shape`.
2. `numLanes` derived: `len(edge.lanes)`.
3. `RoadType` — snapshot defaults.
4. `Connection` autogenerate: add-missing only by default.
5. U-turn: не авто-генерируется по умолчанию.

## SUMO Readiness

- Node: `.nod.xml`
- Edge/Lane: `.edg.xml`
- RoadType: `.typ.xml`
- Connection: `.con.xml` (`from`, `to`, `fromLane`, `toLane`, `uncontrolled`)

## Deferred Next Stages

- priority engine
- pedestrian crossing editor/logic
- signal groups and traffic light phases
- conflict matrix / right-of-way calculation
- roundabout yield logic
- full SUMO import/export pipeline
