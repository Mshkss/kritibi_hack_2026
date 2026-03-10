Domain Contract

Документ описывает доменную модель системы моделирования дорожно-транспортной сети.

Сеть представляется ориентированным графом:

Node — вершина
Edge — направленное ребро
Lane — подструктура ребра

Пересечения и регулирование описываются отдельным слоем.

⸻

Entities

Основные сущности системы:

Project
Node
Edge
Lane
RoadType
Connection
Intersection
IntersectionApproach
Movement
PedestrianCrossing
TrafficSign
SignalGroup
Phase
PhaseSignal


⸻

1. Project

Назначение

Контейнер всей дорожной сети.

Все сущности принадлежат одному проекту.

Позволяет:
	•	создавать
	•	сохранять
	•	загружать
	•	экспортировать дорожные модели.

Поля

поле	тип	описание
id	uuid	идентификатор
name	string	название проекта
description	string	описание
created_at	datetime	дата создания
updated_at	datetime	дата обновления


⸻

2. Node

Назначение

Узел дорожной сети.

Node — это:
	•	начало участка дороги
	•	конец участка дороги
	•	центр пересечения
	•	точка соединения нескольких дорог

Node является вершиной графа дорожной сети.

Ограничения
	•	координаты обязательны
	•	node принадлежит проекту
	•	node нельзя удалить если к нему привязаны Edge
	•	один node может иметь несколько Edge

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
code	string	внешний id (для XML)
x	float	координата X
y	float	координата Y
node_type	string	тип узла
name	string	имя

node_type

priority
traffic_light
uncontrolled


⸻

3. Edge

Назначение

Участок дороги между двумя узлами.

Edge всегда однонаправленный.

Двусторонняя дорога моделируется двумя Edge.

Ограничения
	•	from_node ≠ to_node
	•	edge принадлежит проекту
	•	edge должен иметь минимум одну Lane

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
code	string	внешний id
from_node_id	uuid	начальный узел
to_node_id	uuid	конечный узел
road_type_id	uuid	тип дороги
name	string	имя
speed	float	разрешённая скорость
priority	int	приоритет
length	float	длина
shape	json	геометрия дороги

shape

[
 {x,y},
 {x,y},
 {x,y}
]


⸻

4. Lane

Назначение

Полоса движения внутри участка дороги.

Edge содержит одну или более полос.

Ограничения
	•	lane принадлежит одному edge
	•	lane_index уникален внутри edge
	•	индекс ≥ 0

Поля

поле	тип	описание
id	uuid	идентификатор
edge_id	uuid	участок
lane_index	int	номер полосы
width	float	ширина
speed	float	скорость
allow	json	разрешённые типы транспорта
disallow	json	запрещённые типы транспорта


⸻

5. RoadType

Назначение

Тип дороги.

Используется как шаблон параметров Edge.

Примеры

городская
магистраль
двухполосная

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
code	string	код типа
name	string	название
default_speed	float	скорость
default_lanes	int	количество полос
default_lane_width	float	ширина полосы


⸻

6. Connection

Назначение

Разрешённый переход между полосами двух Edge.

Connection используется для моделирования движения через узел.

Ограничения
	•	from_edge и to_edge должны соединяться через общий Node
	•	lane_index должен существовать в edge

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
from_edge_id	uuid	входящая дорога
to_edge_id	uuid	исходящая дорога
from_lane_index	int	полоса входа
to_lane_index	int	полоса выхода
uncontrolled	bool	без регулирования


⸻

7. Intersection

Назначение

Логическая модель пересечения дорог.

Intersection создаётся поверх Node.

Типы пересечений

crossroad
roundabout

Тип регулирования

priority_signs
traffic_light
uncontrolled

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
node_id	uuid	узел
kind	string	тип пересечения
control_type	string	тип регулирования
name	string	имя


⸻

8. IntersectionApproach

Назначение

Подход к пересечению.

Каждый incoming Edge формирует один подход.

Используется для:
	•	приоритетов
	•	знаков
	•	пешеходных переходов

Поля

поле	тип	описание
id	uuid	идентификатор
intersection_id	uuid	пересечение
incoming_edge_id	uuid	входящая дорога
role	string	роль дороги
has_crosswalk	bool	наличие перехода

role

main
secondary


⸻

9. Movement

Назначение

Манёвр движения через пересечение.

Movement строится на основе Connection.

Типы

left
right
straight
u_turn

Поля

поле	тип	описание
id	uuid	идентификатор
intersection_id	uuid	пересечение
connection_id	uuid	связь
turn_type	string	тип манёвра
is_allowed	bool	разрешён ли манёвр


⸻

10. PedestrianCrossing

Назначение

Пешеходный переход.

Привязан к подходу пересечения.

Поля

поле	тип	описание
id	uuid	идентификатор
intersection_id	uuid	пересечение
approach_id	uuid	подход
width	float	ширина
has_signal	bool	есть светофор


⸻

11. TrafficSign

Назначение

Дорожный знак.

Обычно генерируется автоматически на основе роли подхода.

Типы знаков

main_road
yield
stop

Поля

поле	тип	описание
id	uuid	идентификатор
project_id	uuid	проект
intersection_id	uuid	пересечение
edge_id	uuid	дорога
sign_type	string	тип знака
position_offset	float	расстояние от узла


⸻

12. SignalGroup

Назначение

Группа сигналов светофора.

Может управлять:
	•	движением транспорта
	•	пешеходным переходом

Поля

поле	тип	описание
id	uuid	идентификатор
intersection_id	uuid	пересечение
group_type	string	тип группы
movement_id	uuid	движение
crossing_id	uuid	переход

group_type

vehicle
pedestrian


⸻

13. Phase

Назначение

Фаза работы светофора.

Определяет какие сигналы активны.

Поля

поле	тип	описание
id	uuid	идентификатор
intersection_id	uuid	пересечение
name	string	имя фазы
duration	int	длительность
order_index	int	порядок


⸻

14. PhaseSignal

Назначение

Состояние сигнала внутри фазы.

Поля

поле	тип	описание
id	uuid	идентификатор
phase_id	uuid	фаза
signal_group_id	uuid	группа сигналов
state	string	состояние

state

green
yellow
red
walk
dont_walk


⸻

Итоговая структура домена

Project
 ├─ Node
 │
 ├─ Edge
 │   └─ Lane
 │
 ├─ RoadType
 │
 ├─ Connection
 │
 └─ Intersection
      ├─ IntersectionApproach
      ├─ Movement
      ├─ PedestrianCrossing
      ├─ TrafficSign
      ├─ SignalGroup
      └─ Phase
           └─ PhaseSignal