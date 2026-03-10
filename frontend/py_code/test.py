import math
from enum import Enum
from typing import Optional


class ParkingType(str, Enum):
    NONE = "нет"
    POCKET = "выделенный карман"
    ON_LANE = "на полосе"


class StopType(str, Enum):
    NONE = "нет"
    POCKET = "выделенный карман"
    ON_LANE = "на полосе"


class ManeuverType(str, Enum):
    NONE = "нет"
    INTERSECTION = "пересечение/перестроение"
    RIGHT_TURN = "правый поворот"
    EXIT = "выезд"
    LEFT_TURN = "левый поворот"


class RoadCoefficientCalculator:
    """Калькулятор для расчета коэффициентов"""

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
            return 0.2  # Значение по умолчанию

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
    def width_coefficient(width):
        """Коэффициент ширины полосы"""
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
    def road_condition_coefficient(condition_type, asphalt_percent=None):
        """Коэффициент состояния дороги"""
        if condition_type == "асфальт" and asphalt_percent is not None:
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
        else:
            # По типу покрытия
            types = {
                "асфальт 80%": 1.0,
                "цементобетон": 0.9,
                "щебень": 0.8,
                "гравий": 0.7,
                "грунт": 0.6
            }
            return types.get(condition_type, 1.0)

    @staticmethod
    def speed_coefficient(speed):
        """Коэффициент ограничения скорости"""
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
    def radius_coefficient(radius):
        """Коэффициент радиуса поворота"""
        if radius >= 450:
            return 1.0
        elif radius >= 250:
            return 0.96
        elif radius >= 100:
            return 0.90
        else:
            return 0.85

    @staticmethod
    def crosswalk_coefficient(pedestrians):
        """Коэффициент пешеходного перехода"""
        if pedestrians == 0:
            return 1.0
        elif pedestrians < 60:
            return 0.86
        elif pedestrians < 120:
            return 0.58
        else:
            return 0.27

    @staticmethod
    def parking_coefficient(parking_type):
        """Коэффициент парковки (упрощенный, без длины)"""
        base = {
            "нет": 1.0,
            "выделенный карман": 0.8,
            "на полосе": 0.64
        }.get(parking_type, 1.0)

        return base

    @staticmethod
    def bus_stop_coefficient(stop_type):
        """Коэффициент автобусной остановки (упрощенный, без длины и интенсивности)"""
        base = {
            "нет": 1.0,
            "выделенный карман": 0.8,
            "на полосе": 0.64
        }.get(stop_type, 1.0)

        return base

    @staticmethod
    def slope_coefficient(slope):
        """Коэффициент уклона (упрощенный, без длины)"""
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
    def maneuver_coefficient(maneuver_type, turn_percentage=None):
        """
        Коэффициент маневра

        Args:
            maneuver_type: Тип маневра
            turn_percentage: Доля поворачивающих ТС (может быть 0.5 или 50)

        Returns:
            float: Коэффициент от 0.3 до 1.0
        """
        # Валидация и нормализация доли поворачивающих
        turn_pct = RoadCoefficientCalculator.validate_turn_percentage(turn_percentage)

        base = {
            "нет": 1.0,
            "пересечение/перестроение": 0.99,
            "правый поворот": 0.9,
            "выезд": 0.88,
            "левый поворот": 0.3
        }.get(maneuver_type, 1.0)

        # Для левого поворота без конфликта
        if maneuver_type == "левый поворот" and turn_pct < 0.05:
            base = 0.9

        # Расчет с защитой от отрицательных значений
        reduction = (1.0 - base) * turn_pct
        result = 1.0 - reduction

        # Дополнительная защита
        result = max(base, min(1.0, result))

        return result

    @staticmethod
    def calculate_all(width=None, speed=None, radius=None, pedestrians=None,
                      slope=None, parking_type=None, stop_type=None,
                      maneuver_type=None, turn_percentage=None,
                      road_condition_type=None, asphalt_percent=None):
        """Расчет всех коэффициентов"""
        results = {}
        values = []

        if width is not None:
            val = RoadCoefficientCalculator.width_coefficient(width)
            results["Ширина полосы"] = val
            values.append(val)

        if speed is not None:
            val = RoadCoefficientCalculator.speed_coefficient(speed)
            results["Ограничение скорости"] = val
            values.append(val)

        if radius is not None:
            val = RoadCoefficientCalculator.radius_coefficient(radius)
            results["Радиус поворота"] = val
            values.append(val)

        if pedestrians is not None:
            val = RoadCoefficientCalculator.crosswalk_coefficient(pedestrians)
            results["Пешеходный переход"] = val
            values.append(val)

        if slope is not None:
            val = RoadCoefficientCalculator.slope_coefficient(slope)
            results["Уклон"] = val
            values.append(val)

        if parking_type is not None and parking_type != "нет":
            val = RoadCoefficientCalculator.parking_coefficient(parking_type)
            results["Парковка"] = val
            values.append(val)

        if stop_type is not None and stop_type != "нет":
            val = RoadCoefficientCalculator.bus_stop_coefficient(stop_type)
            results["Остановка"] = val
            values.append(val)

        if maneuver_type is not None and maneuver_type != "нет":
            val = RoadCoefficientCalculator.maneuver_coefficient(maneuver_type, turn_percentage)
            results["Маневр"] = val
            values.append(val)

        if road_condition_type is not None or asphalt_percent is not None:
            val = RoadCoefficientCalculator.road_condition_coefficient(road_condition_type, asphalt_percent)
            results["Состояние дороги"] = val
            values.append(val)

        # Расчет общего коэффициента
        total_coef = 1.0
        for v in values:
            total_coef *= v
        results["ОБЩИЙ КОЭФФИЦИЕНТ"] = total_coef

        return results


def print_menu():
    """Вывод меню"""
    print("\n" + "=" * 70)
    print("КАЛЬКУЛЯТОР ПОНИЖАЮЩИХ КОЭФФИЦИЕНТОВ (УПРОЩЕННАЯ ВЕРСИЯ)")
    print("=" * 70)
    print("\nВыберите тип расчета:")
    print("1 - Рассчитать все коэффициенты")
    print("2 - Ширина полосы")
    print("3 - Ограничение скорости")
    print("4 - Радиус поворота")
    print("5 - Пешеходный переход")
    print("6 - Уклон дороги")
    print("7 - Парковка")
    print("8 - Остановка")
    print("9 - Маневр")
    print("10 - Состояние дороги")
    print("0 - Выход")
    print("-" * 70)


def calculate_all_interactive():
    """Интерактивный расчет всех коэффициентов"""
    print("\n" + "=" * 70)
    print("РАСЧЕТ ВСЕХ КОЭФФИЦИЕНТОВ")
    print("=" * 70)
    print("\nВведите данные (Enter - пропустить):")

    try:
        # Ширина полосы
        width_input = input("Ширина полосы (м): ")
        width = float(width_input) if width_input else None

        # Ограничение скорости
        speed_input = input("Ограничение скорости (км/ч): ")
        speed = float(speed_input) if speed_input else None

        # Радиус поворота
        radius_input = input("Радиус поворота (м): ")
        radius = float(radius_input) if radius_input else None

        # Пешеходный переход
        ped_input = input("Интенсивность пешеходов (чел/час): ")
        pedestrians = int(ped_input) if ped_input else None

        # Уклон
        slope_input = input("Уклон дороги (градусы): ")
        slope = float(slope_input) if slope_input else None

        # Парковка
        print("\nТип парковки:")
        print("  1 - нет")
        print("  2 - выделенный карман")
        print("  3 - на полосе")
        parking_choice = input("Выберите (1-3): ")
        parking_map = {"1": "нет", "2": "выделенный карман", "3": "на полосе"}
        parking_type = parking_map.get(parking_choice)

        # Остановка
        print("\nТип остановки:")
        print("  1 - нет")
        print("  2 - выделенный карман")
        print("  3 - на полосе")
        stop_choice = input("Выберите (1-3): ")
        stop_map = {"1": "нет", "2": "выделенный карман", "3": "на полосе"}
        stop_type = stop_map.get(stop_choice)

        # Маневр
        print("\nТип маневра:")
        print("  1 - нет")
        print("  2 - пересечение/перестроение")
        print("  3 - правый поворот")
        print("  4 - выезд")
        print("  5 - левый поворот")
        maneuver_choice = input("Выберите (1-5): ")
        maneuver_map = {
            "1": "нет",
            "2": "пересечение/перестроение",
            "3": "правый поворот",
            "4": "выезд",
            "5": "левый поворот"
        }
        maneuver_type = maneuver_map.get(maneuver_choice)

        # Процент поворачивающих (теперь с защитой)
        turn_percent = None
        if maneuver_type and maneuver_type != "нет":
            percent_input = input("Доля поворачивающих ТС (можно ввести 0.2 или 20, Enter=20%): ")
            if percent_input:
                turn_percent = float(percent_input)
            # Если ничего не ввели, оставляем None - будет использовано значение по умолчанию

        # Состояние дороги
        print("\nТип дорожного покрытия:")
        print("  1 - асфальт 80% и более")
        print("  2 - цементобетон")
        print("  3 - щебень")
        print("  4 - гравий")
        print("  5 - грунт")
        print("  6 - указать процент асфальта")
        condition_choice = input("Выберите (1-6, Enter=пропустить): ")

        road_condition_type = None
        asphalt_percent = None

        if condition_choice == "6":
            percent_input = input("Процент асфальта: ")
            asphalt_percent = float(percent_input) if percent_input else None
        elif condition_choice in ["1", "2", "3", "4", "5"]:
            condition_map = {
                "1": "асфальт 80%",
                "2": "цементобетон",
                "3": "щебень",
                "4": "гравий",
                "5": "грунт"
            }
            road_condition_type = condition_map.get(condition_choice)

        # Расчет
        results = RoadCoefficientCalculator.calculate_all(
            width=width,
            speed=speed,
            radius=radius,
            pedestrians=pedestrians,
            slope=slope,
            parking_type=parking_type,
            stop_type=stop_type,
            maneuver_type=maneuver_type,
            turn_percentage=turn_percent,
            road_condition_type=road_condition_type,
            asphalt_percent=asphalt_percent
        )

        print("\n" + "-" * 70)
        print("РЕЗУЛЬТАТЫ РАСЧЕТА:")
        print("-" * 70)

        total_coef = 1.0
        for name, value in results.items():
            if name == "ОБЩИЙ КОЭФФИЦИЕНТ":
                total_coef = value
                print(f"\n🏁 {name}: {value:.4f}")
            else:
                print(f"{name:25}: {value:.4f}")

        print("-" * 70)

        # Расчет пропускной способности
        capacity_input = input("\nМаксимальная пропускная способность (прив. ед./час, Enter=1000): ")
        max_capacity = float(capacity_input) if capacity_input else 1000
        final_capacity = max_capacity * total_coef
        print(f"ИТОГОВАЯ ПРОПУСКНАЯ СПОСОБНОСТЬ: {final_capacity:.1f} прив. ед./час")

        # Оценка уровня обслуживания
        if total_coef >= 0.9:
            los = "A (отлично)"
            color = "🟢"
        elif total_coef >= 0.7:
            los = "B (хорошо)"
            color = "🟢"
        elif total_coef >= 0.5:
            los = "C (удовлетворительно)"
            color = "🟡"
        elif total_coef >= 0.3:
            los = "D (плохо)"
            color = "🟠"
        else:
            los = "E/F (критично)"
            color = "🔴"

        print(f"{color} УРОВЕНЬ ОБСЛУЖИВАНИЯ (LOS): {los}")

    except ValueError as e:
        print(f"Ошибка ввода: {e}")
    except Exception as e:
        print(f"Ошибка: {e}")


def calculate_width():
    """Расчет коэффициента ширины"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ ШИРИНЫ ПОЛОСЫ")
    print("=" * 60)
    print("  ≥3.75 м → 1.0")
    print("  ≥3.5 м  → 0.99")
    print("  ≥3.25 м → 0.97")
    print("  ≥3.0 м  → 0.93")
    print("  ≥2.75 м → 0.90")

    try:
        width = float(input("\nВведите ширину полосы (м): "))
        result = RoadCoefficientCalculator.width_coefficient(width)
        print(f"\nКоэффициент ширины: {result:.3f}")
    except ValueError:
        print("Ошибка: введите число")


def calculate_speed():
    """Расчет коэффициента скорости"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ ОГРАНИЧЕНИЯ СКОРОСТИ")
    print("=" * 60)
    print("  60 км/ч → 1.0")
    print("  50 км/ч → 0.98")
    print("  40 км/ч → 0.96")
    print("  30 км/ч → 0.88")
    print("  20 км/ч → 0.76")
    print("  10 км/ч → 0.44")

    try:
        speed = float(input("\nВведите ограничение скорости (км/ч): "))
        result = RoadCoefficientCalculator.speed_coefficient(speed)
        print(f"\nКоэффициент скорости: {result:.3f}")
    except ValueError:
        print("Ошибка: введите число")


def calculate_radius():
    """Расчет коэффициента радиуса"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ РАДИУСА ПОВОРОТА")
    print("=" * 60)
    print("  ≥450 м → 1.0")
    print("  250-449 м → 0.96")
    print("  100-249 м → 0.90")
    print("  <100 м → 0.85")

    try:
        radius = float(input("\nВведите радиус поворота (м): "))
        result = RoadCoefficientCalculator.radius_coefficient(radius)
        print(f"\nКоэффициент радиуса: {result:.3f}")
    except ValueError:
        print("Ошибка: введите число")


def calculate_crosswalk():
    """Расчет коэффициента пешеходного перехода"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ ПЕШЕХОДНОГО ПЕРЕХОДА")
    print("=" * 60)
    print("  0 чел/ч → 1.0")
    print("  1-59 чел/ч → 0.86")
    print("  60-119 чел/ч → 0.58")
    print("  ≥120 чел/ч → 0.27")

    try:
        pedestrians = int(input("\nВведите интенсивность пешеходов (чел/час): "))
        result = RoadCoefficientCalculator.crosswalk_coefficient(pedestrians)
        print(f"\nКоэффициент пешеходного перехода: {result:.3f}")
    except ValueError:
        print("Ошибка: введите целое число")


def calculate_slope():
    """Расчет коэффициента уклона"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ УКЛОНА ДОРОГИ")
    print("=" * 60)
    print("  0-5°   → 1.0")
    print("  6-10°  → 0.9")
    print("  11-16° → 0.8")
    print("  17-21° → 0.7")
    print("  22-26° → 0.6")
    print("  27-30° → 0.5")
    print("  31-34° → 0.4")
    print("  35-38° → 0.3")
    print("  39-41° → 0.2")
    print("  42-44° → 0.1")
    print("  45°    → 0.05")

    try:
        slope = float(input("\nВведите уклон (градусы): "))
        result = RoadCoefficientCalculator.slope_coefficient(slope)
        print(f"\nКоэффициент уклона: {result:.3f}")
    except ValueError:
        print("Ошибка: введите число")


def calculate_parking():
    """Расчет коэффициента парковки (упрощенный)"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ ПАРКОВКИ")
    print("=" * 60)
    print("Типы парковки:")
    print("  1 - нет (1.0)")
    print("  2 - выделенный карман (0.8)")
    print("  3 - на полосе (0.64)")

    try:
        choice = input("\nВыберите тип (1-3): ")
        parking_map = {"1": "нет", "2": "выделенный карман", "3": "на полосе"}
        parking_type = parking_map.get(choice)

        if not parking_type:
            print("Неверный выбор")
            return

        result = RoadCoefficientCalculator.parking_coefficient(parking_type)
        print(f"\nКоэффициент парковки: {result:.2f}")

    except ValueError:
        print("Ошибка ввода")


def calculate_bus_stop():
    """Расчет коэффициента остановки (упрощенный)"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ АВТОБУСНОЙ ОСТАНОВКИ")
    print("=" * 60)
    print("Типы остановок:")
    print("  1 - нет (1.0)")
    print("  2 - выделенный карман (0.8)")
    print("  3 - на полосе (0.64)")

    try:
        choice = input("\nВыберите тип (1-3): ")
        stop_map = {"1": "нет", "2": "выделенный карман", "3": "на полосе"}
        stop_type = stop_map.get(choice)

        if not stop_type:
            print("Неверный выбор")
            return

        result = RoadCoefficientCalculator.bus_stop_coefficient(stop_type)
        print(f"\nКоэффициент остановки: {result:.2f}")

    except ValueError:
        print("Ошибка ввода")


def calculate_maneuver():
    """Расчет коэффициента маневра"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ МАНЕВРА")
    print("=" * 60)
    print("Типы маневров:")
    print("  1 - нет (1.0)")
    print("  2 - пересечение/перестроение (0.99)")
    print("  3 - правый поворот (0.9)")
    print("  4 - выезд (0.88)")
    print("  5 - левый поворот (0.3)")
    print("\n⚠️  Долю поворачивающих можно вводить как:")
    print("   - десятичную дробь (0.2 для 20%)")
    print("   - проценты (20 для 20%)")
    print("   - оставить пустым (будет 20%)")

    try:
        choice = input("\nВыберите тип (1-5): ")
        maneuver_map = {
            "1": "нет",
            "2": "пересечение/перестроение",
            "3": "правый поворот",
            "4": "выезд",
            "5": "левый поворот"
        }
        maneuver_type = maneuver_map.get(choice)

        if not maneuver_type:
            print("Неверный выбор")
            return

        if maneuver_type == "нет":
            result = RoadCoefficientCalculator.maneuver_coefficient(maneuver_type, None)
            print(f"\nКоэффициент маневра: {result:.3f}")
            return

        percent_input = input("Доля поворачивающих ТС (Enter=20%): ")
        turn_percent = float(percent_input) if percent_input else None

        # Показываем как интерпретировалось значение
        normalized = RoadCoefficientCalculator.validate_turn_percentage(turn_percent)
        if turn_percent is not None and turn_percent > 1:
            print(f"   → Интерпретировано как {turn_percent}% = {normalized:.2f}")

        result = RoadCoefficientCalculator.maneuver_coefficient(maneuver_type, turn_percent)
        print(f"\nКоэффициент маневра: {result:.3f}")

    except ValueError:
        print("Ошибка ввода")


def calculate_road_condition():
    """Расчет коэффициента состояния дороги"""
    print("\n" + "=" * 60)
    print("КОЭФФИЦИЕНТ СОСТОЯНИЯ ДОРОГИ")
    print("=" * 60)
    print("Типы покрытия:")
    print("  1 - асфальт 80% и более (1.0)")
    print("  2 - цементобетон (0.9)")
    print("  3 - щебень (0.8)")
    print("  4 - гравий (0.7)")
    print("  5 - грунт (0.6)")
    print("  6 - указать процент асфальта")

    try:
        choice = input("\nВыберите тип (1-6): ")

        if choice == "6":
            percent = float(input("Введите процент асфальта: "))
            result = RoadCoefficientCalculator.road_condition_coefficient("асфальт", percent)
            print(f"\nКоэффициент состояния дороги: {result:.2f}")
        elif choice in ["1", "2", "3", "4", "5"]:
            condition_map = {
                "1": "асфальт 80%",
                "2": "цементобетон",
                "3": "щебень",
                "4": "гравий",
                "5": "грунт"
            }
            condition_type = condition_map.get(choice)
            result = RoadCoefficientCalculator.road_condition_coefficient(condition_type)
            print(f"\nКоэффициент состояния дороги: {result:.2f}")
        else:
            print("Неверный выбор")

    except ValueError:
        print("Ошибка ввода")


def test_maneuver_examples():
    """Тестирование разных вариантов ввода для маневра"""
    print("\n" + "=" * 70)
    print("ТЕСТИРОВАНИЕ РАЗНЫХ ВАРИАНТОВ ВВОДА ДЛЯ МАНЕВРА")
    print("=" * 70)

    test_cases = [
        ("правый поворот", 0.2, "0.2 (20% как дробь)"),
        ("правый поворот", 20, "20 (20% как проценты)"),
        ("правый поворот", 50, "50 (50% как проценты)"),
        ("правый поворот", 5, "5 (5% как проценты)"),
        ("правый поворот", 100, "100 (100% как проценты)"),
        ("правый поворот", None, "None (по умолчанию 20%)"),
        ("левый поворот", 0.2, "0.2 (20% как дробь)"),
        ("левый поворот", 20, "20 (20% как проценты)"),
        ("левый поворот", 5, "5 (5% как проценты)"),
        ("левый поворот", 50, "50 (50% как проценты)"),
    ]

    print("\n{:<20} {:<20} {:<15} {:<10}".format("Маневр", "Входные данные", "Нормализовано", "Результат"))
    print("-" * 70)

    for maneuver, value, desc in test_cases:
        normalized = RoadCoefficientCalculator.validate_turn_percentage(value)
        result = RoadCoefficientCalculator.maneuver_coefficient(maneuver, value)
        print(f"{maneuver:20} {desc:20} {normalized:.2f}          {result:.3f}")


def main():
    """Главная функция"""
    while True:
        print_menu()
        choice = input("Ваш выбор: ")

        if choice == "0":
            print("\nДо свидания!")
            break
        elif choice == "1":
            calculate_all_interactive()
        elif choice == "2":
            calculate_width()
        elif choice == "3":
            calculate_speed()
        elif choice == "4":
            calculate_radius()
        elif choice == "5":
            calculate_crosswalk()
        elif choice == "6":
            calculate_slope()
        elif choice == "7":
            calculate_parking()
        elif choice == "8":
            calculate_bus_stop()
        elif choice == "9":
            calculate_maneuver()
        elif choice == "10":
            calculate_road_condition()
        elif choice == "test":
            test_maneuver_examples()
        else:
            print("Неверный выбор. Попробуйте снова.")

        input("\nНажмите Enter для продолжения...")


if __name__ == "__main__":
    main()