"""Domain enums."""

from enum import Enum


class NodeType(str, Enum):
    PRIORITY = "priority"
    TRAFFIC_LIGHT = "traffic_light"
    DEAD_END = "dead_end"


class IntersectionKind(str, Enum):
    CROSSROAD = "crossroad"
    ROUNDABOUT = "roundabout"


class TurnType(str, Enum):
    LEFT = "left"
    RIGHT = "right"
    STRAIGHT = "straight"
    UTURN = "uturn"
