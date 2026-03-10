# Domain Contract (Stage: Network Constructor)

## Purpose

Документ фиксирует доменную модель этапа "Конструктор / Сеть".
На этом этапе backend реализует ядро дорожного графа проекта:
- узлы (`Node`),
- направленные участки (`Edge`),
- полосы (`Lane`),
- типы дорог (`RoadType`).

`Project` остается корневой агрегирующей сущностью.

## Core Principles

- `Project` — root aggregate для всей сетевой модели.
- Один источник истины для каждого типа данных.
- Минимизация дублирования между шаблонами (`RoadType`) и фактическими значениями (`Edge`).
- Подготовка к SUMO PlainXML без перелома модели (`.nod.xml`, `.edg.xml`, `.typ.xml`).
- Ограничения целостности на двух уровнях:
  - БД (FK/UNIQUE/CHECK),
  - сервисы (проектная принадлежность, геометрия, бизнес-правила).

## Aggregate Boundaries

## Project (already active)

Root aggregate.

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

## Node (active now)

Геометрическая и топологическая точка дорожного графа.
На этом этапе `Node` еще не является полноценной конфигурацией `Intersection`.

Поля:
- `id`
- `project_id`
- `code`
- `x`, `y`
- `type` nullable
- `created_at`
- `updated_at`

Инварианты:
- `code` уникален в рамках проекта.
- Удаление узла запрещено при наличии связанных `Edge`.

## RoadType (active now)

Шаблон параметров дорожного участка.

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
- `code` уникален в рамках проекта.

## Edge (active now)

Направленный участок дороги (`from_node -> to_node`).
Двусторонняя дорога моделируется двумя `Edge` в противоположных направлениях.

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
- `shape` (polyline)
- `created_at`
- `updated_at`

Инварианты:
- `code` уникален в рамках проекта.
- `from_node_id != to_node_id`.
- `Edge` должен иметь минимум одну `Lane`.

## Lane (active now)

Полоса внутри `Edge`.

Поля:
- `id`
- `edge_id`
- `index` (`0` — самая правая)
- `allow` nullable
- `speed` nullable
- `width` nullable
- `created_at`
- `updated_at`

Инварианты:
- `index` уникален в рамках `edge_id`.
- `index >= 0`.

## Geometry Rules (active now)

`GeometryService` отвечает за MVP-геометрию:
- валидация координат узлов,
- валидация/нормализация `shape`,
- расчет `length` по polyline,
- синхронизация крайних точек `shape` с координатами `from/to` узлов.

Принятое поведение при перемещении `Node`:
- крайние точки всех связанных `Edge.shape` обновляются автоматически,
- `Edge.length` пересчитывается.

## SUMO Readiness

Модель уже хранит обязательные поля для PlainXML:
- Node (`id`, `x`, `y`, `type`) -> `.nod.xml`
- Edge (`from`, `to`, `type`, `speed`, `priority`, `length`, `width`, `sidewalkWidth`, `shape`, `name`) -> `.edg.xml`
- RoadType (`id`, `numLanes`, `speed`, `priority`, `width`, `sidewalkWidth`) -> `.typ.xml`
- Lane (`index`, `allow`, `speed`, `width`) -> `.edg.xml` lane-level

## Explicit Architectural Decisions

1. `shape` хранится как JSON-массив точек (`[{x, y}, ...]`) в поле `edges.shape`.
2. `numLanes` не хранится отдельно в `Edge`, вычисляется как `len(lanes)`.
3. При перемещении `Node` связанные `Edge.shape` корректируются автоматически по концам.
4. `RoadType` применяется как defaults-снимок: значения копируются в `Edge` при создании/применении.
   Дальнейшие изменения `RoadType` не вызывают неявных массовых изменений существующих `Edge`.

## Next Stages (deferred intentionally)

- `Intersection` editor
- `Connection` matrix/turn connectivity
- `TrafficLightPlan` и `Phase`
- модификаторы дорожных сегментов
- полноценный SUMO import/export
