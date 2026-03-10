# Domain Contract (Stage: Network + Road Segment Editor)

## Purpose

Документ фиксирует активную доменную модель этапов:
- `Сеть` (граф дорог),
- `Редактор параметров участка` (редактирование `Edge`/`Lane`).

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Project` — root aggregate для всей модели.
- Один источник истины для каждого типа данных.
- Минимизация дублирования между шаблоном (`RoadType`) и фактом (`Edge`).
- SUMO-ready структура хранения (`shape`, lane-level поля, типы дорог).
- Целостность обеспечивается на двух уровнях:
  - БД (FK/UNIQUE/CHECK),
  - сервисы (project scope, geometry, lane-rules, road-type semantics).

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

## Editor Semantics

## length

- хранится в `edges.length`.
- при создании `Edge`, при `PATCH /shape` и при `POST /recalculate-length` длина считается по геометрии.
- при `PATCH /edges/{edge_id}` длину можно задать вручную полем `length`.
- если в одном PATCH меняется `shape`, а `length` не передан, длина пересчитывается автоматически.

## apply road type

- `RoadType` применяется по snapshot semantics.
- операция записывает `edge.road_type_id` и копирует defaults в фактические поля `Edge`.
- request override-поля (`speed`, `priority`, `width`, `sidewalk_width`, `lane_speed`, `lane_width`) имеют приоритет над defaults.
- опция `apply_to_lanes=true` массово обновляет lane-level `speed/width` (без потери `allow/disallow`).
- изменение `RoadType` в будущем не меняет существующие `Edge` автоматически.

## full replace lanes vs patch lane

- `PUT /edges/{edge_id}/lanes`:
  - полная замена списка полос,
  - атомарный replace,
  - список обязан быть непустым,
  - индексы уникальны и `>= 0`.
- `PATCH /edges/{edge_id}/lanes/{lane_id}`:
  - точечное изменение одной полосы,
  - можно менять `index`, `allow/disallow`, `speed`, `width`,
  - при изменении `index` проверяется уникальность внутри edge.

## allow / disallow storage

- хранение: `lanes.allow` и `lanes.disallow` (`TEXT`).
- формат: нормализованная строка транспортных классов, разделитель пробел.
- на входе допускаются пробелы/запятые; backend нормализует в deduplicated space-separated строку.
- запрещен конфликт: один и тот же класс одновременно в `allow` и `disallow`.

## Geometry Rules

`GeometryService`:
- валидирует координаты и `shape`,
- нормализует крайние точки `shape` под координаты `from_node`/`to_node`,
- считает длину polyline,
- используется и в конструкторе сети, и в редакторе сегмента.

При перемещении `Node`:
- крайние точки связанных `Edge.shape` синхронизируются автоматически,
- `Edge.length` пересчитывается.

## SUMO Readiness

- Node: `id`, `x`, `y`, `type`
- Edge: `from`, `to`, `type`, `speed`, `priority`, `length`, `width`, `sidewalkWidth`, `shape`, `name`
- RoadType: `id`, `numLanes`, `speed`, `priority`, `width`, `sidewalkWidth`
- Lane: `index`, `allow`, `disallow`, `speed`, `width`

## Explicit Decisions

1. `shape` хранится как JSON-массив точек (`[{x, y}, ...]`) в `edges.shape`.
2. `numLanes` в `Edge` не хранится отдельно, вычисляется как `len(edge.lanes)`.
3. Перемещение `Node` автоматически синхронизирует крайние точки связанных `Edge.shape`.
4. `RoadType` применяет defaults как snapshot, а не динамическую ссылку.

## Deferred Next Stages

- `Intersection` editor и turn-level связи (`Connection`)
- traffic light plans/phases
- conflict matrix
- pedestrian logic
- SUMO import/export pipeline
