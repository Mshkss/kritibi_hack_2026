# Domain Contract (Stage: Network + Road Segment Editor + Connection Layer)

## Purpose

Документ фиксирует активную доменную модель этапов:
- `Сеть` (граф дорог),
- `Редактор параметров участка` (`Edge`/`Lane`),
- `Connection layer` (направления через узел на lane-level).

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Project` — root aggregate для всей модели.
- Один источник истины для каждого типа данных.
- Геометрическая связность и топологическая проходимость разделены:
  - `Node/Edge/Lane` описывают геометрию и структуру графа,
  - `Connection` описывает разрешенный переход между полосами через узел.
- SUMO-ready структура хранения (`shape`, lane-level поля, `Connection` как аналог `.con.xml`).
- Целостность обеспечивается на двух уровнях:
  - БД (FK/UNIQUE/CHECK),
  - сервисы (project scope, topology validation, lane consistency).

## Active Entities

## Project

Поля:
- `id`
- `name`
- `description`
- `created_at`
- `updated_at`

Связи:
- `Project 1 -> N Node`
- `Project 1 -> N Edge`
- `Project 1 -> N RoadType`
- `Project 1 -> N Connection`

## Node

Геометрическая и топологическая точка сети. Пока это не полноценная конфигурация `Intersection`.

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

Инварианты:
- `code` уникален внутри проекта.
- нельзя удалить `Node`, если есть связанные `Edge`.

## RoadType

Шаблон (defaults) для участка.

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

Инварианты:
- `code` уникален внутри проекта.

## Edge

Направленный участок дороги (`from_node -> to_node`).
Двусторонняя дорога представляется двумя `Edge`.

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

Инварианты:
- `code` уникален внутри проекта.
- `from_node_id != to_node_id`.
- у `Edge` минимум одна `Lane`.

## Lane

Полоса в составе `Edge`.

Поля:
- `id`
- `edge_id`
- `index` (`0` — правая полоса)
- `allow` nullable
- `disallow` nullable
- `speed` nullable (override)
- `width` nullable (override)
- `created_at`
- `updated_at`

Инварианты:
- `index` уникален внутри `edge_id`.
- `index >= 0`.
- `allow` и `disallow` не могут пересекаться по транспортным классам.

## Connection

Lane-level directed transition через конкретный узел.

Поля:
- `id`
- `project_id`
- `via_node_id`
- `from_edge_id` (incoming edge)
- `to_edge_id` (outgoing edge)
- `from_lane_index`
- `to_lane_index`
- `uncontrolled` (default `false`)
- `created_at`
- `updated_at`

Инварианты:
- уникальность: `(project_id, from_edge_id, to_edge_id, from_lane_index, to_lane_index)`.
- `from_lane_index >= 0`, `to_lane_index >= 0`.
- `from_edge_id != to_edge_id`.
- `from_edge.to_node_id == to_edge.from_node_id == via_node_id`.
- `from_lane_index` существует в `from_edge`.
- `to_lane_index` существует в `to_edge`.
- все сущности принадлежат одному `project`.

## Editor/Layer Semantics

## length

- хранится в `edges.length`.
- при создании `Edge`, при `PATCH /shape` и при `POST /recalculate-length` длина считается по геометрии.
- в `PATCH /edges/{edge_id}` длину можно задать вручную.

## apply road type

- snapshot semantics:
  - записывает `edge.road_type_id`,
  - копирует defaults в фактические поля `Edge`,
  - request overrides имеют приоритет.
- `apply_to_lanes=true` массово обновляет lane-level `speed/width`, не трогая `allow/disallow`.

## full replace lanes vs patch lane

- `PUT /edges/{edge_id}/lanes`: атомарная полная замена списка полос.
- `PATCH /edges/{edge_id}/lanes/{lane_id}`: точечное изменение одной полосы.

## connection autogeneration (MVP)

- add-missing only (не удаляет существующие пользовательские записи).
- для каждой пары `incoming -> outgoing` на узле:
  - lane mapping: `0->0`, `1->1`, ... до `min(num_from_lanes, num_to_lanes) - 1`.
- сложные merge/split сценарии автоматически не решаются.
- U-turn connection автоматически не генерируется по умолчанию.

## Geometry Rules

`GeometryService`:
- валидирует координаты и `shape`,
- нормализует крайние точки `shape` под координаты `from_node`/`to_node`,
- считает длину polyline.

При перемещении `Node`:
- крайние точки связанных `Edge.shape` синхронизируются автоматически,
- `Edge.length` пересчитывается.

## Consistency Strategy for Connection

1. `via_node_id` хранится явно (для прозрачности и быстрых node-centric выборок), но всегда валидируется против topology `from_edge/to_edge`.
2. `autogenerate` работает в режиме add-missing only.
3. U-turn:
   - не создается автоматически по умолчанию,
   - может быть создан вручную, если topology и lane-level валидации проходят.
4. Влияние edge/lane изменений:
   - удаление `Edge` каскадно удаляет связанные `Connection` через FK (`ondelete=CASCADE`),
   - destructive lane-index изменение, которое ломает существующие `Connection`, блокируется на уровне сервиса с явной ошибкой.

## SUMO Readiness

- Node: `id`, `x`, `y`, `type`
- Edge: `from`, `to`, `type`, `speed`, `priority`, `length`, `width`, `sidewalkWidth`, `shape`, `name`
- RoadType: `id`, `numLanes`, `speed`, `priority`, `width`, `sidewalkWidth`
- Lane: `index`, `allow`, `disallow`, `speed`, `width`
- Connection: `from`, `to`, `fromLane`, `toLane`, `uncontrolled`

## Explicit Decisions

1. `shape` хранится как JSON-массив точек (`[{x, y}, ...]`) в `edges.shape`.
2. `numLanes` не хранится в `Edge`, вычисляется как `len(edge.lanes)`.
3. `via_node_id` хранится явно и проверяется на консистентность.
4. `RoadType` — snapshot defaults, не динамическая ссылка.
5. Connection autogenerate: add-missing only.
6. U-turn: no auto by default.

## Deferred Next Stages

- `Intersection` editor
- turn classification (left/right/straight/U-turn metadata)
- traffic light plans/phases
- conflict matrix / right-of-way engine
- pedestrian graph
- SUMO import/export pipeline
