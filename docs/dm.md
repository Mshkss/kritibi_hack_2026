# Domain Contract

Документ описывает доменную модель системы: **traffic network digital twin editor**.

## Назначение модели

Модель покрывает пять основных модулей:
1. Конструктор сети (`Node`, `Edge`, `Lane`) поверх карты OSM.
2. Редактор дорожного сегмента (полосы, ширина, покрытие, скорость, модификаторы).
3. Редактор пересечений (тип, приоритеты, разрешенные маневры, переходы).
4. Редактор светофоров (группы сигналов, фазы, длительности, проверка конфликтов).
5. Хранение и обмен в SUMO-совместимом XML (`nodes.xml`, `edges.xml`, `types.xml`, `connections.xml`).

## MVP-позиция (хакатон)

Для быстрой реализации:
- Один источник истины по регулированию: только `Intersection.control_type`.
- Нет отдельной таблицы `MovementConflict`: конфликты считаются динамически при валидации фаз.
- Вместо отдельных таблиц `SpeedLimit`/`BusStop`/`ParkingZone` используется единая сущность `RoadModifier`.
- `TrafficSign` хранит только физические знаки приоритета/режима, без дубля с модификаторами.

## Entities

Основные сущности:

- Project
- Node
- Edge
- Lane
- RoadType
- Connection
- Intersection
- IntersectionApproach
- Movement
- PedestrianCrossing
- TrafficSign
- RoadModifier
- SignalGroup
- Phase
- PhaseSignal

---

## 1. Project

### Назначение

Контейнер всей дорожной сети и всех редакторных данных.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| name | string | название проекта |
| description | string | описание |
| srid | int | пространственная система координат (по умолчанию 3857) |
| created_at | datetime | дата создания |
| updated_at | datetime | дата обновления |

### Ограничения

- Все сущности принадлежат одному `project_id`.

---

## 2. Node

### Назначение

Топологическая вершина графа дорожной сети.

`Node` хранит только геометрию и роль точки в графе.
Тип регулирования узла не хранится здесь.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| code | string | внешний id для XML |
| x | float | координата X |
| y | float | координата Y |
| node_type | string | топологический тип узла |
| name | string | имя |

### node_type

- `junction`
- `shape`
- `dead_end`

### Ограничения

- `x`, `y` обязательны.
- `code` уникален в рамках проекта.
- Нельзя удалить `Node`, если к нему привязаны `Edge`.
- Если для `Node` существует `Intersection`, то `node_type = junction`.

---

## 3. Edge

### Назначение

Однонаправленный участок дороги между двумя узлами.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| code | string | внешний id |
| from_node_id | uuid | начальный узел |
| to_node_id | uuid | конечный узел |
| road_type_id | uuid | тип дороги |
| name | string | имя |
| speed | float | базовая разрешенная скорость |
| priority | int | приоритет |
| length | float | длина |
| surface | string | тип покрытия |
| shape | json | геометрия дороги (polyline) |

### surface

- `asphalt`
- `concrete`
- `cobblestone`
- `gravel`
- `dirt`

### Ограничения

- `from_node_id != to_node_id`.
- `from_node_id` и `to_node_id` должны быть в том же проекте.
- `code` уникален в рамках проекта.
- `length > 0`.
- У `Edge` минимум одна `Lane`.

---

## 4. Lane

### Назначение

Полоса движения внутри `Edge`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| edge_id | uuid | участок |
| lane_index | int | номер полосы (0..N-1) |
| width | float | ширина |
| speed | float | скорость (override для полосы) |
| allow | json | разрешенные типы транспорта |
| disallow | json | запрещенные типы транспорта |

### Ограничения

- `lane_index` уникален внутри `edge_id`.
- `lane_index >= 0`.
- `width > 0`.
- `speed > 0`.

---

## 5. RoadType

### Назначение

Шаблон параметров дороги для создания/редактирования `Edge`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| code | string | код типа |
| name | string | название |
| default_speed | float | скорость |
| default_lanes | int | количество полос |
| default_lane_width | float | ширина полосы |
| default_surface | string | покрытие по умолчанию |
| default_allow | json | типы ТС по умолчанию |
| default_disallow | json | запреты по умолчанию |

### Ограничения

- `code` уникален в рамках проекта.
- `default_lanes >= 1`.
- `default_speed > 0`.
- `default_lane_width > 0`.

---

## 6. Connection

### Назначение

Разрешенный переход между полосами двух `Edge` через общий узел.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| from_edge_id | uuid | входящий edge |
| to_edge_id | uuid | исходящий edge |
| from_lane_index | int | полоса входа |
| to_lane_index | int | полоса выхода |
| via_node_id | uuid | узел соединения |
| uncontrolled | bool | без регулирования |

### Ограничения

- `via_node_id = from_edge.to_node_id = to_edge.from_node_id`.
- `from_lane_index` должен существовать в `from_edge`.
- `to_lane_index` должен существовать в `to_edge`.
- Уникальность: (`project_id`, `from_edge_id`, `to_edge_id`, `from_lane_index`, `to_lane_index`).

---

## 7. Intersection

### Назначение

Логическая модель пересечения поверх `Node`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| node_id | uuid | узел |
| kind | string | тип пересечения |
| control_type | string | тип регулирования (source of truth) |
| name | string | имя |

### kind

- `crossroad`
- `roundabout`

### control_type

- `priority_signs`
- `traffic_light`
- `uncontrolled`

### Ограничения

- Один `Intersection` на один `Node` в рамках проекта.
- Тип регулирования берется только из `Intersection.control_type`.

---

## 8. IntersectionApproach

### Назначение

Подход к пересечению для каждого incoming `Edge`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| intersection_id | uuid | пересечение |
| incoming_edge_id | uuid | входящая дорога |
| role | string | роль дороги |
| has_crosswalk | bool | наличие перехода |
| priority_rank | int | относительный приоритет подхода |

### role

- `main`
- `secondary`
- `local`

### Ограничения

- Уникальность: (`intersection_id`, `incoming_edge_id`).

---

## 9. Movement

### Назначение

Маневр через пересечение, построенный на основе `Connection`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| intersection_id | uuid | пересечение |
| connection_id | uuid | связь |
| turn_type | string | тип маневра |
| is_allowed | bool | разрешен ли маневр |

### turn_type

- `left`
- `right`
- `straight`
- `u_turn`

### Ограничения

- Уникальность: (`intersection_id`, `connection_id`).

---

## 10. PedestrianCrossing

### Назначение

Пешеходный переход.

Поддерживаются 2 типа размещения:
- на подходе к пересечению,
- на дорожном сегменте вне пересечения (midblock).

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| placement_type | string | тип размещения |
| intersection_id | uuid/null | пересечение |
| approach_id | uuid/null | подход |
| edge_id | uuid/null | сегмент дороги |
| offset | float/null | смещение вдоль edge |
| width | float | ширина |
| has_signal | bool | есть светофор |
| name | string | имя |

### placement_type

- `intersection`
- `midblock`

### Ограничения

- Для `intersection`: обязательны `intersection_id`, `approach_id`, а `edge_id` пустой.
- Для `midblock`: обязательны `edge_id`, `offset`.
- `width > 0`.
- Для `midblock`: `0 <= offset <= edge.length`.

---

## 11. TrafficSign

### Назначение

Физический дорожный знак на подходе или сегменте.

Эта сущность не дублирует смысл `RoadModifier`.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| intersection_id | uuid/null | пересечение |
| edge_id | uuid | дорога |
| sign_type | string | тип знака |
| position_offset | float | расстояние от начала edge |
| applies_to_lane_index | int/null | полоса, если знак полосный |

### sign_type

- `main_road`
- `yield`
- `stop`
- `no_entry`

### Ограничения

- `0 <= position_offset <= edge.length`.

---

## 12. RoadModifier

### Назначение

Единая сущность локальных модификаторов дорожного сегмента для MVP.

Покрывает:
- локальные ограничения скорости,
- автобусные остановки,
- парковочные зоны,
- прочие сегментные ограничения.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| project_id | uuid | проект |
| edge_id | uuid | дорога |
| lane_index | int/null | полоса (если модификатор полосный) |
| modifier_type | string | тип модификатора |
| start_offset | float | начало зоны |
| end_offset | float | конец зоны |
| payload | json | параметры модификатора |
| name | string | имя/комментарий |

### modifier_type

- `speed_limit`
- `bus_stop`
- `parking_zone`
- `custom`

### payload examples

- `speed_limit`: `{ "speed": 40, "source": "sign" }`
- `bus_stop`: `{ "stop_name": "Central", "capacity": 2 }`
- `parking_zone`: `{ "side": "right", "capacity": 20, "parking_type": "parallel" }`

### Ограничения

- `0 <= start_offset < end_offset <= edge.length`.
- Для полосных модификаторов `lane_index` должен существовать в `Edge`.
- Схема `payload` валидируется по `modifier_type` на уровне приложения.

---

## 13. SignalGroup

### Назначение

Группа сигналов светофора. Управляет либо транспортным маневром, либо пешеходным переходом.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| intersection_id | uuid | пересечение |
| group_type | string | тип группы |
| movement_id | uuid/null | движение |
| crossing_id | uuid/null | переход |
| name | string | имя группы |

### group_type

- `vehicle`
- `pedestrian`

### Ограничения

- Для `vehicle` обязателен `movement_id`, `crossing_id = null`.
- Для `pedestrian` обязателен `crossing_id`, `movement_id = null`.

---

## 14. Phase

### Назначение

Фаза работы светофора.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| intersection_id | uuid | пересечение |
| name | string | имя фазы |
| duration | int | длительность (сек) |
| min_duration | int/null | минимальная длительность |
| max_duration | int/null | максимальная длительность |
| order_index | int | порядок в цикле |

### Ограничения

- `duration > 0`.
- Уникальность `order_index` в рамках `intersection_id`.

---

## 15. PhaseSignal

### Назначение

Состояние сигнала конкретной группы внутри фазы.

### Поля

| поле | тип | описание |
|---|---|---|
| id | uuid | идентификатор |
| phase_id | uuid | фаза |
| signal_group_id | uuid | группа сигналов |
| state | string | состояние |

### state

- `green`
- `yellow`
- `red`
- `walk`
- `dont_walk`
- `flashing`

### Ограничения

- Уникальность: (`phase_id`, `signal_group_id`).
- Для `vehicle`-группы допустимы: `green/yellow/red`.
- Для `pedestrian`-группы допустимы: `walk/dont_walk/flashing`.

---

## Глобальные правила валидации

### 1. Целостность графа

- Все ссылки между сущностями должны оставаться в границах одного `project_id`.
- Любой `Connection` должен проходить через общий узел входящего и исходящего `Edge`.
- Для каждого `Edge` обязателен хотя бы один `Lane`.

### 2. Валидация модификаторов сегмента

- `RoadModifier` и `PedestrianCrossing(midblock)` должны попадать в диапазон длины `Edge`.
- Для полосных модификаторов `lane_index` должен существовать в целевом `Edge`.

### 3. Валидация пересечений

- `IntersectionApproach` создается только для входящих `Edge` соответствующего узла.
- `Movement` строится только на `Connection`, который относится к этому `Intersection`.

### 4. Валидация светофоров и фаз (без отдельной таблицы конфликтов)

- В каждой `Phase` должен быть задан сигнал для всех `SignalGroup` пересечения.
- Конфликтующие маневры вычисляются динамически по геометрии и `turn_type`.
- Нельзя одновременно включать `green` для динамически определенных конфликтующих маневров.
- Нельзя включать `walk`, если переход конфликтует с активным `green` транспортного маневра.
- Цикл фаз должен иметь непрерывный `order_index` (0..N-1).

---

## SUMO XML mapping

Экспорт выполняется в четыре обязательных файла.

### `nodes.xml`

- `Node.code -> node/@id`
- `Node.x -> node/@x`, `Node.y -> node/@y`
- Если `Node` связан с `Intersection`: `node/@type` определяется только `Intersection.control_type`.
- Если `Intersection` отсутствует: `node/@type` выводится из `Node.node_type` (`dead_end`/прочие).
- Для узлов с `traffic_light` сохраняются параметры фаз и ссылок в `<param>`.

### `types.xml`

- `RoadType.code -> type/@id`
- `RoadType.default_speed -> type/@speed`
- `RoadType.default_lanes -> type/@numLanes`
- `RoadType.default_lane_width -> type/@width`
- `RoadType.default_surface -> <param key="surface" ...>`

### `edges.xml`

- `Edge.code -> edge/@id`
- `Edge.from_node_id(code) -> edge/@from`
- `Edge.to_node_id(code) -> edge/@to`
- `Edge.road_type_id(code) -> edge/@type`
- `Edge.priority/speed/shape -> edge/@priority/@speed/@shape`
- `Lane` экспортируются как lane-атрибуты/override внутри `edge`
- `RoadModifier` сериализуется в `<param>` у `edge`/`lane` (SUMO-compatible extension)

### `connections.xml`

- `Connection` экспортируется в `<connection from="..." to="..." fromLane="..." toLane="...">`
- `Movement.is_allowed=false` сериализуется как запрет соединения
- Для светофорных узлов добавляются `tl`/`linkIndex`, совместимые с фазовым управлением

### Инварианты экспорта/импорта

- `code` в `Node`, `Edge`, `RoadType` обязателен и уникален в рамках проекта.
- Экспорт детерминированный: одинаковый домен -> одинаковые XML-id.
- Импорт восстанавливает все доменные сущности, включая `RoadModifier` из `<param>`.

---

## Итоговая структура домена

Project
 ├─ Node
 ├─ Edge
 │   ├─ Lane
 │   ├─ RoadModifier
 │   └─ PedestrianCrossing (midblock)
 ├─ RoadType
 ├─ Connection
 └─ Intersection
      ├─ IntersectionApproach
      ├─ Movement
      ├─ PedestrianCrossing (intersection)
      ├─ TrafficSign
      ├─ SignalGroup
      └─ Phase
           └─ PhaseSignal
