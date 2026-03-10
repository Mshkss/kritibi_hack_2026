"""Geometry helpers for graph entities."""

from __future__ import annotations

import math
from typing import Any

from pydantic import BaseModel, Field


class Point(BaseModel):
    """2D point."""

    x: float = Field()
    y: float = Field()


class GeometryValidationError(ValueError):
    """Raised when shape or coordinates are invalid."""


class GeometryService:
    """Validation and basic operations for edge geometry."""

    def validate_coordinate(self, value: float, *, field_name: str) -> float:
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise GeometryValidationError(f"{field_name} must be a finite number")
        return float(value)

    def validate_point(self, x: float, y: float) -> dict[str, float]:
        return {
            "x": self.validate_coordinate(x, field_name="x"),
            "y": self.validate_coordinate(y, field_name="y"),
        }

    def normalize_shape(
        self,
        shape: list[dict[str, Any]] | list[Point],
        *,
        from_x: float,
        from_y: float,
        to_x: float,
        to_y: float,
    ) -> tuple[list[dict[str, float]], float]:
        if len(shape) < 2:
            raise GeometryValidationError("shape must contain at least 2 points")

        points: list[dict[str, float]] = []
        for raw in shape:
            if isinstance(raw, Point):
                x = raw.x
                y = raw.y
            elif hasattr(raw, "x") and hasattr(raw, "y"):
                x = getattr(raw, "x")
                y = getattr(raw, "y")
            else:
                x = raw.get("x") if isinstance(raw, dict) else None
                y = raw.get("y") if isinstance(raw, dict) else None
            points.append(self.validate_point(x, y))

        # Ensure shape is consistent with graph topology.
        points[0] = self.validate_point(from_x, from_y)
        points[-1] = self.validate_point(to_x, to_y)

        # Drop consecutive duplicates after snapping endpoints.
        normalized: list[dict[str, float]] = [points[0]]
        for point in points[1:]:
            if point["x"] == normalized[-1]["x"] and point["y"] == normalized[-1]["y"]:
                continue
            normalized.append(point)

        if len(normalized) < 2:
            raise GeometryValidationError("shape collapses to a single point")

        length = self.calculate_length(normalized)
        if length <= 0.0:
            raise GeometryValidationError("shape length must be greater than 0")

        return normalized, length

    def calculate_length(self, points: list[dict[str, float]]) -> float:
        length = 0.0
        for i in range(1, len(points)):
            dx = points[i]["x"] - points[i - 1]["x"]
            dy = points[i]["y"] - points[i - 1]["y"]
            length += math.hypot(dx, dy)
        return float(length)

    def sync_shape_endpoints(
        self,
        shape: list[dict[str, Any]],
        *,
        from_x: float,
        from_y: float,
        to_x: float,
        to_y: float,
    ) -> tuple[list[dict[str, float]], float]:
        """Re-snap first/last point to node coords and re-calc edge length."""
        return self.normalize_shape(shape, from_x=from_x, from_y=from_y, to_x=to_x, to_y=to_y)
