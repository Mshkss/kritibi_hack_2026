from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import json


class ParkingType(str, Enum):
    """Типы парковки"""
    NONE = "нет"
    POCKET = "выделенный карман"
    ON_LANE = "на полосе"


class StopType(str, Enum):
    """Типы остановок"""
    NONE = "нет"
    POCKET = "выделенный карман"
    ON_LANE = "на полосе"


class ManeuverType(str, Enum):
    """Типы маневров"""
    NONE = "нет"
    INTERSECTION = "пересечение/перестроение"
    RIGHT_TURN = "правый поворот"
    EXIT = "выезд"
    LEFT_TURN = "левый поворот"


class RoadConditionType(str, Enum):
    """Типы дорожного покрытия"""
    ASPHALT_80 = "асфальт 80%"
    CEMENT = "цементобетон"
    RUBBLE = "щебень"
    GRAVEL = "гравий"
    SOIL = "грунт"


@dataclass
class RoadCalculationInput:
    """Входные данные для расчета (упрощенные)"""
    # Базовые параметры
    width: Optional[float] = None  # Ширина полосы (м)
    speed_limit: Optional[float] = None  # Ограничение скорости (км/ч)
    radius: Optional[float] = None  # Радиус поворота (м)
    pedestrians: Optional[int] = None  # Интенсивность пешеходов (чел/час)
    slope: Optional[float] = None  # Уклон (градусы)

    # Парковка
    parking_type: Optional[ParkingType] = None

    # Остановка
    stop_type: Optional[StopType] = None

    # Маневр
    maneuver_type: Optional[ManeuverType] = None
    turn_percentage: Optional[float] = None  # Доля поворачивающих (может быть 0.5 или 50)

    # Состояние дороги
    road_condition_type: Optional[RoadConditionType] = None
    asphalt_percent: Optional[float] = None  # Процент асфальта


@dataclass
class CoefficientResult:
    """Результат расчета коэффициента"""
    name: str
    value: float
    description: str
    input_params: Dict[str, Any]


@dataclass
class RoadCalculationResult:
    """Результат расчета"""
    coefficients: List[CoefficientResult]
    total_coefficient: float
    max_capacity: float
    final_capacity: float
    los_level: str
    los_description: str
    los_color: str


class RoadCoefficientBackend:
    """
    Бэкенд для расчета понижающих коэффициентов дорожной инфраструктуры
    Упрощенная версия без параметров длины
    """

    # Константы для расчета LOS
    LOS_LEVELS = [
        (0.9, "A", "Отлично", "🟢"),
        (0.7, "B", "Хорошо", "🟢"),
        (0.5, "C", "Удовлетворительно", "🟡"),
        (0.3, "D", "Плохо", "🟠"),
        (0.0, "E/F", "Критично", "🔴")
    ]

    @staticmethod
    def validate_turn_percentage(value: Optional[float]) -> float:
        """
        Валидация и нормализация доли поворачивающих

        Args:
            value: Входное значение (может быть 0.5 или 50)

        Returns:
            float: Нормализованное значение от 0 до 1
        """
        if value is None:
            return 0.2  # Значение по умолчанию 20%

        try:
            v = float(value)
        except (TypeError, ValueError):
            return 0.2

        # Если значение больше 1, предполагаем что это проценты (50 -> 0.5)
        if v > 1:
            v = v / 100.0

        # Ограничиваем значение от 0 до 1
        v = max(0.0, min(1.0, v))

        return v

    @staticmethod
    def calculate_width_coefficient(width: float) -> float:
        """
        Коэффициент ширины полосы

        Args:
            width: Ширина полосы в метрах

        Returns:
            float: Коэффициент от 0.9 до 1.0
        """
        if width >= 3.75:
            return 1.0
        elif width >= 3.5:
            return 0.99
        elif width >= 3.25:
            return 0.97
        elif width >= 3.0:
            return 0.93
        elif width >= 2.75:
            return 0.90
        else:
            return 0.90

    @staticmethod
    def calculate_speed_coefficient(speed: float) -> float:
        """
        Коэффициент ограничения скорости

        Args:
            speed: Ограничение скорости в км/ч

        Returns:
            float: Коэффициент от 0.44 до 1.0
        """
        if speed >= 60:
            return 1.0
        elif speed >= 50:
            return 0.98
        elif speed >= 40:
            return 0.96
        elif speed >= 30:
            return 0.88
        elif speed >= 20:
            return 0.76
        elif speed >= 10:
            return 0.44
        else:
            return 0.44

    @staticmethod
    def calculate_radius_coefficient(radius: float) -> float:
        """
        Коэффициент радиуса поворота

        Args:
            radius: Радиус поворота в метрах

        Returns:
            float: Коэффициент от 0.85 до 1.0
        """
        if radius >= 450:
            return 1.0
        elif radius >= 250:
            return 0.96
        elif radius >= 100:
            return 0.90
        else:
            return 0.85

    @staticmethod
    def calculate_crosswalk_coefficient(pedestrians: int) -> float:
        """
        Коэффициент пешеходного перехода

        Args:
            pedestrians: Интенсивность пешеходов (чел/час)

        Returns:
            float: Коэффициент от 0.27 до 1.0
        """
        if pedestrians == 0:
            return 1.0
        elif pedestrians < 60:
            return 0.86
        elif pedestrians < 120:
            return 0.58
        else:
            return 0.27

    @staticmethod
    def calculate_parking_coefficient(parking_type: ParkingType) -> float:
        """
        Коэффициент парковки (упрощенный, без длины)

        Args:
            parking_type: Тип парковки

        Returns:
            float: Коэффициент от 0.64 до 1.0
        """
        base_map = {
            ParkingType.NONE: 1.0,
            ParkingType.POCKET: 0.8,
            ParkingType.ON_LANE: 0.64
        }
        return base_map.get(parking_type, 1.0)

    @staticmethod
    def calculate_bus_stop_coefficient(stop_type: StopType) -> float:
        """
        Коэффициент автобусной остановки (упрощенный, без длины и интенсивности)

        Args:
            stop_type: Тип остановки

        Returns:
            float: Коэффициент от 0.64 до 1.0
        """
        base_map = {
            StopType.NONE: 1.0,
            StopType.POCKET: 0.8,
            StopType.ON_LANE: 0.64
        }
        return base_map.get(stop_type, 1.0)

    @staticmethod
    def calculate_slope_coefficient(slope: float) -> float:
        """
        Коэффициент уклона дороги (упрощенный, без длины)

        Args:
            slope: Уклон в градусах

        Returns:
            float: Коэффициент от 0.05 до 1.0
        """
        if slope <= 5:
            return 1.0
        elif slope <= 10:
            return 0.9
        elif slope <= 16:
            return 0.8
        elif slope <= 21:
            return 0.7
        elif slope <= 26:
            return 0.6
        elif slope <= 30:
            return 0.5
        elif slope <= 34:
            return 0.4
        elif slope <= 38:
            return 0.3
        elif slope <= 41:
            return 0.2
        elif slope <= 44:
            return 0.1
        else:
            return 0.05

    @staticmethod
    def calculate_maneuver_coefficient(
            maneuver_type: ManeuverType,
            turn_percentage: Optional[float] = None
    ) -> float:
        """
        Коэффициент маневра

        Args:
            maneuver_type: Тип маневра
            turn_percentage: Доля поворачивающих ТС (может быть 0.5 или 50)

        Returns:
            float: Коэффициент от 0.3 до 1.0
        """
        # Валидация и нормализация доли поворачивающих
        turn_pct = RoadCoefficientBackend.validate_turn_percentage(turn_percentage)

        base_map = {
            ManeuverType.NONE: 1.0,
            ManeuverType.INTERSECTION: 0.99,
            ManeuverType.RIGHT_TURN: 0.9,
            ManeuverType.EXIT: 0.88,
            ManeuverType.LEFT_TURN: 0.3
        }
        base = base_map.get(maneuver_type, 1.0)

        # Для левого поворота без конфликта
        if maneuver_type == ManeuverType.LEFT_TURN and turn_pct < 0.05:
            base = 0.9

        # Расчет с защитой от отрицательных значений
        reduction = (1.0 - base) * turn_pct
        result = 1.0 - reduction

        # Дополнительная защита: результат не может быть меньше базового значения
        result = max(base, min(1.0, result))

        return result

    @staticmethod
    def calculate_road_condition_coefficient(
            condition_type: Optional[RoadConditionType] = None,
            asphalt_percent: Optional[float] = None
    ) -> float:
        """
        Коэффициент состояния дороги

        Args:
            condition_type: Тип покрытия
            asphalt_percent: Процент асфальта

        Returns:
            float: Коэффициент от 0.6 до 1.0
        """
        if asphalt_percent is not None:
            if asphalt_percent >= 80:
                return 1.0
            elif asphalt_percent >= 60:
                return 0.9
            elif asphalt_percent >= 40:
                return 0.8
            elif asphalt_percent >= 20:
                return 0.7
            else:
                return 0.6
        elif condition_type:
            type_map = {
                RoadConditionType.ASPHALT_80: 1.0,
                RoadConditionType.CEMENT: 0.9,
                RoadConditionType.RUBBLE: 0.8,
                RoadConditionType.GRAVEL: 0.7,
                RoadConditionType.SOIL: 0.6
            }
            return type_map.get(condition_type, 1.0)
        else:
            return 1.0

    def calculate_all(self, data: RoadCalculationInput, max_capacity: float = 1000) -> RoadCalculationResult:
        """
        Расчет всех коэффициентов и итогового результата

        Args:
            data: Входные данные
            max_capacity: Максимальная пропускная способность

        Returns:
            RoadCalculationResult: Результаты расчета
        """
        coefficients = []
        values = []

        # Ширина полосы
        if data.width is not None:
            value = self.calculate_width_coefficient(data.width)
            coefficients.append(CoefficientResult(
                name="Ширина полосы",
                value=value,
                description=f"Ширина {data.width} м",
                input_params={"width": data.width}
            ))
            values.append(value)

        # Ограничение скорости
        if data.speed_limit is not None:
            value = self.calculate_speed_coefficient(data.speed_limit)
            coefficients.append(CoefficientResult(
                name="Ограничение скорости",
                value=value,
                description=f"Скорость {data.speed_limit} км/ч",
                input_params={"speed": data.speed_limit}
            ))
            values.append(value)

        # Радиус поворота
        if data.radius is not None:
            value = self.calculate_radius_coefficient(data.radius)
            coefficients.append(CoefficientResult(
                name="Радиус поворота",
                value=value,
                description=f"Радиус {data.radius} м",
                input_params={"radius": data.radius}
            ))
            values.append(value)

        # Пешеходный переход
        if data.pedestrians is not None:
            value = self.calculate_crosswalk_coefficient(data.pedestrians)
            coefficients.append(CoefficientResult(
                name="Пешеходный переход",
                value=value,
                description=f"Пешеходов {data.pedestrians} чел/ч",
                input_params={"pedestrians": data.pedestrians}
            ))
            values.append(value)

        # Уклон
        if data.slope is not None:
            value = self.calculate_slope_coefficient(data.slope)
            coefficients.append(CoefficientResult(
                name="Уклон дороги",
                value=value,
                description=f"Уклон {data.slope}°",
                input_params={"slope": data.slope}
            ))
            values.append(value)

        # Парковка
        if data.parking_type is not None and data.parking_type != ParkingType.NONE:
            value = self.calculate_parking_coefficient(data.parking_type)
            coefficients.append(CoefficientResult(
                name="Парковка",
                value=value,
                description=f"Тип: {data.parking_type.value}",
                input_params={"parking_type": data.parking_type.value}
            ))
            values.append(value)

        # Остановка
        if data.stop_type is not None and data.stop_type != StopType.NONE:
            value = self.calculate_bus_stop_coefficient(data.stop_type)
            coefficients.append(CoefficientResult(
                name="Автобусная остановка",
                value=value,
                description=f"Тип: {data.stop_type.value}",
                input_params={"stop_type": data.stop_type.value}
            ))
            values.append(value)

        # Маневр
        if data.maneuver_type is not None and data.maneuver_type != ManeuverType.NONE:
            # Нормализуем процент для описания
            turn_pct = self.validate_turn_percentage(data.turn_percentage)
            value = self.calculate_maneuver_coefficient(
                data.maneuver_type,
                data.turn_percentage
            )
            coefficients.append(CoefficientResult(
                name="Маневр",
                value=value,
                description=f"Тип: {data.maneuver_type.value}, доля: {turn_pct * 100:.0f}%",
                input_params={
                    "maneuver_type": data.maneuver_type.value,
                    "turn_percentage": data.turn_percentage
                }
            ))
            values.append(value)

        # Состояние дороги
        if data.road_condition_type is not None or data.asphalt_percent is not None:
            value = self.calculate_road_condition_coefficient(
                data.road_condition_type,
                data.asphalt_percent
            )
            desc = f"Тип: {data.road_condition_type.value if data.road_condition_type else 'асфальт'}"
            if data.asphalt_percent:
                desc += f", процент: {data.asphalt_percent}%"
            coefficients.append(CoefficientResult(
                name="Состояние дороги",
                value=value,
                description=desc,
                input_params={
                    "road_condition_type": data.road_condition_type.value if data.road_condition_type else None,
                    "asphalt_percent": data.asphalt_percent
                }
            ))
            values.append(value)

        # Расчет итогового коэффициента (перемножение)
        total_coefficient = 1.0
        for v in values:
            total_coefficient *= v

        # Расчет пропускной способности
        final_capacity = max_capacity * total_coefficient

        # Определение LOS
        los_level, los_desc, los_color = self._get_los_level(total_coefficient)

        return RoadCalculationResult(
            coefficients=coefficients,
            total_coefficient=total_coefficient,
            max_capacity=max_capacity,
            final_capacity=final_capacity,
            los_level=los_level,
            los_description=los_desc,
            los_color=los_color
        )

    def _get_los_level(self, coefficient: float) -> Tuple[str, str, str]:
        """
        Определение уровня обслуживания (LOS)

        Args:
            coefficient: Итоговый коэффициент

        Returns:
            Tuple[level, description, color]
        """
        for threshold, level, desc, color in self.LOS_LEVELS:
            if coefficient >= threshold:
                return level, desc, color
        return "F", "Критично", "🔴"

    def to_dict(self, result: RoadCalculationResult) -> Dict[str, Any]:
        """
        Преобразование результата в словарь для API

        Args:
            result: Результат расчета

        Returns:
            Dict: Словарь для JSON-сериализации
        """
        return {
            "success": True,
            "data": {
                "coefficients": [
                    {
                        "name": c.name,
                        "value": round(c.value, 4),
                        "description": c.description,
                        "input_params": c.input_params
                    }
                    for c in result.coefficients
                ],
                "total_coefficient": round(result.total_coefficient, 4),
                "max_capacity": result.max_capacity,
                "final_capacity": round(result.final_capacity, 1),
                "los": {
                    "level": result.los_level,
                    "description": result.los_description,
                    "color": result.los_color
                }
            }
        }

    def from_dict(self, data: Dict[str, Any]) -> RoadCalculationInput:
        """
        Создание входных данных из словаря

        Args:
            data: Словарь с данными

        Returns:
            RoadCalculationInput: Объект с входными данными
        """
        input_data = RoadCalculationInput()

        # Базовые параметры
        if "width" in data and data["width"] is not None:
            input_data.width = float(data["width"])

        if "speed_limit" in data and data["speed_limit"] is not None:
            input_data.speed_limit = float(data["speed_limit"])

        if "radius" in data and data["radius"] is not None:
            input_data.radius = float(data["radius"])

        if "pedestrians" in data and data["pedestrians"] is not None:
            input_data.pedestrians = int(data["pedestrians"])

        if "slope" in data and data["slope"] is not None:
            input_data.slope = float(data["slope"])

        # Парковка
        if "parking_type" in data and data["parking_type"]:
            try:
                input_data.parking_type = ParkingType(data["parking_type"])
            except ValueError:
                pass

        # Остановка
        if "stop_type" in data and data["stop_type"]:
            try:
                input_data.stop_type = StopType(data["stop_type"])
            except ValueError:
                pass

        # Маневр
        if "maneuver_type" in data and data["maneuver_type"]:
            try:
                input_data.maneuver_type = ManeuverType(data["maneuver_type"])
            except ValueError:
                pass

        if "turn_percentage" in data:
            input_data.turn_percentage = data["turn_percentage"]  # Может быть 5, 50 или 0.5

        # Состояние дороги
        if "road_condition_type" in data and data["road_condition_type"]:
            try:
                input_data.road_condition_type = RoadConditionType(data["road_condition_type"])
            except ValueError:
                pass

        if "asphalt_percent" in data and data["asphalt_percent"] is not None:
            input_data.asphalt_percent = float(data["asphalt_percent"])

        return input_data


# API для интеграции
class RoadCoefficientAPI:
    """
    API для интеграции в бэкенд
    """

    def __init__(self):
        self.calculator = RoadCoefficientBackend()

    def calculate(self, request_data: Dict[str, Any], max_capacity: float = 1000) -> Dict[str, Any]:
        """
        Основной метод расчета

        Args:
            request_data: Данные запроса
            max_capacity: Максимальная пропускная способность

        Returns:
            Dict: Результат в формате JSON
        """
        try:
            # Валидация входных данных
            if not isinstance(request_data, dict):
                return {
                    "success": False,
                    "error": "Неверный формат данных"
                }

            # Преобразование данных
            input_data = self.calculator.from_dict(request_data)

            # Расчет
            result = self.calculator.calculate_all(input_data, max_capacity)

            # Возврат результата
            return self.calculator.to_dict(result)

        except ValueError as e:
            return {
                "success": False,
                "error": f"Ошибка валидации: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Внутренняя ошибка: {str(e)}"
            }

    def get_available_types(self) -> Dict[str, Any]:
        """
        Получение доступных типов для фронтенда

        Returns:
            Dict: Словарь с доступными типами
        """
        return {
            "success": True,
            "data": {
                "parking_types": [
                    {"value": t.value, "label": t.value}
                    for t in ParkingType
                ],
                "stop_types": [
                    {"value": t.value, "label": t.value}
                    for t in StopType
                ],
                "maneuver_types": [
                    {"value": t.value, "label": t.value}
                    for t in ManeuverType
                ],
                "road_condition_types": [
                    {"value": t.value, "label": t.value}
                    for t in RoadConditionType
                ]
            }
        }

    def validate_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Валидация входных данных

        Args:
            data: Данные для валидации

        Returns:
            Dict: Результат валидации
        """
        errors = []

        # Проверка ширины полосы
        if "width" in data and data["width"] is not None:
            try:
                w = float(data["width"])
                if w < 2.75:
                    errors.append("Ширина полосы не может быть меньше 2.75 м")
                elif w > 3.75:
                    errors.append("Ширина полосы не может быть больше 3.75 м")
            except ValueError:
                errors.append("Неверный формат ширины полосы")

        # Проверка скорости
        if "speed_limit" in data and data["speed_limit"] is not None:
            try:
                s = float(data["speed_limit"])
                if s < 10:
                    errors.append("Скорость не может быть меньше 10 км/ч")
                elif s > 60:
                    errors.append("Скорость не может быть больше 60 км/ч")
            except ValueError:
                errors.append("Неверный формат скорости")

        # Проверка радиуса
        if "radius" in data and data["radius"] is not None:
            try:
                r = float(data["radius"])
                if r < 0:
                    errors.append("Радиус не может быть отрицательным")
            except ValueError:
                errors.append("Неверный формат радиуса")

        # Проверка пешеходов
        if "pedestrians" in data and data["pedestrians"] is not None:
            try:
                p = int(data["pedestrians"])
                if p < 0:
                    errors.append("Количество пешеходов не может быть отрицательным")
            except ValueError:
                errors.append("Неверный формат количества пешеходов")

        # Проверка уклона
        if "slope" in data and data["slope"] is not None:
            try:
                sl = float(data["slope"])
                if sl < 0:
                    errors.append("Уклон не может быть отрицательным")
                elif sl > 45:
                    errors.append("Уклон не может быть больше 45°")
            except ValueError:
                errors.append("Неверный формат уклона")

        return {
            "success": len(errors) == 0,
            "errors": errors
        }


# Пример использования в бэкенде
def example_usage():
    """Пример использования бэкенда"""
    api = RoadCoefficientAPI()

    # Пример запроса (упрощенный, без длины)
    request = {
        "width": 3.2,
        "speed_limit": 40,
        "radius": 200,
        "pedestrians": 50,
        "slope": 8,
        "parking_type": "выделенный карман",
        "stop_type": "на полосе",
        "maneuver_type": "правый поворот",
        "turn_percentage": 20,  # Можно ввести 20 как проценты
        "road_condition_type": "асфальт 80%"
    }

    print("=" * 70)
    print("ПРИМЕР РАСЧЕТА")
    print("=" * 70)
    print(f"Входные данные: {json.dumps(request, indent=2, ensure_ascii=False)}")

    # Валидация
    validation = api.validate_input(request)
    print(f"\nВалидация: {validation}")

    if validation["success"]:
        # Расчет
        result = api.calculate(request, max_capacity=1000)
        print("\nРезультат расчета:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    # Получение доступных типов
    types = api.get_available_types()
    print("\nДоступные типы:")
    print(json.dumps(types, indent=2, ensure_ascii=False))


def test_maneuver_examples():
    """Тестирование разных вариантов ввода для маневра"""
    api = RoadCoefficientAPI()

    print("\n" + "=" * 70)
    print("ТЕСТИРОВАНИЕ КОЭФФИЦИЕНТА МАНЕВРА")
    print("=" * 70)

    test_cases = [
        ("правый поворот", 0.2),
        ("правый поворот", 20),
        ("правый поворот", 50),
        ("правый поворот", 5),
        ("правый поворот", 100),
        ("правый поворот", None),
        ("левый поворот", 0.2),
        ("левый поворот", 20),
        ("левый поворот", 5),
        ("левый поворот", 50),
    ]

    print("\n{:<20} {:<15} {:<15} {:<10}".format("Маневр", "Вход", "Нормализовано", "Результат"))
    print("-" * 70)

    for maneuver, value in test_cases:
        # Создаем запрос только с маневром
        request = {
            "maneuver_type": maneuver,
            "turn_percentage": value
        }

        input_data = api.calculator.from_dict(request)

        if input_data.maneuver_type and input_data.maneuver_type != ManeuverType.NONE:
            normalized = api.calculator.validate_turn_percentage(value)
            result = api.calculator.calculate_maneuver_coefficient(
                input_data.maneuver_type,
                input_data.turn_percentage
            )

            value_str = str(value) if value is not None else "None"
            print(f"{maneuver:20} {value_str:15} {normalized:.2f}              {result:.3f}")


# наверное тут дохера лишнего, но главное чтоб работало
