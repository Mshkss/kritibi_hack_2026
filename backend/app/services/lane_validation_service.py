"""Validation and normalization logic for lane payloads."""

from __future__ import annotations

import re
from collections import Counter

from app.services.errors import ValidationError


class LaneValidationService:
    """Validates lane consistency rules for edge editor operations."""

    _split_pattern = re.compile(r"[\s,]+")

    def normalize_transport_flags(self, value: str | None) -> str | None:
        if value is None:
            return None

        tokens = [token.strip() for token in self._split_pattern.split(value) if token.strip()]
        if not tokens:
            return None

        # Preserve input order while de-duplicating.
        seen: set[str] = set()
        ordered: list[str] = []
        for token in tokens:
            if token not in seen:
                seen.add(token)
                ordered.append(token)
        return " ".join(ordered)

    def normalize_lane_payload(self, payload: dict[str, object]) -> dict[str, object]:
        normalized = dict(payload)

        if "index" in normalized:
            raw_index = normalized["index"]
            if raw_index is None:
                raise ValidationError("Lane index cannot be null")
            normalized["index"] = int(raw_index)
            if normalized["index"] < 0:
                raise ValidationError("Lane index must be >= 0")

        if normalized.get("speed") is not None and float(normalized["speed"]) <= 0:
            raise ValidationError("Lane speed must be > 0")

        if normalized.get("width") is not None and float(normalized["width"]) <= 0:
            raise ValidationError("Lane width must be > 0")

        if "allow" in normalized:
            normalized["allow"] = self.normalize_transport_flags(normalized.get("allow"))
        if "disallow" in normalized:
            normalized["disallow"] = self.normalize_transport_flags(normalized.get("disallow"))

        self.validate_allow_disallow(
            normalized.get("allow") if "allow" in normalized else None,
            normalized.get("disallow") if "disallow" in normalized else None,
        )
        return normalized

    def validate_allow_disallow(self, allow: str | None, disallow: str | None) -> None:
        allow_set = set((allow or "").split())
        disallow_set = set((disallow or "").split())
        overlap = allow_set.intersection(disallow_set)
        if overlap:
            joined = ", ".join(sorted(overlap))
            raise ValidationError(f"allow/disallow conflict for classes: {joined}")

    def validate_lane_replace_list(self, lanes: list[dict[str, object]]) -> list[dict[str, object]]:
        if not lanes:
            raise ValidationError("lanes list must not be empty")

        normalized = [self.normalize_lane_payload(lane) for lane in lanes]

        indexes = [int(lane["index"]) for lane in normalized]
        duplicates = [index for index, count in Counter(indexes).items() if count > 1]
        if duplicates:
            dup = ", ".join(str(v) for v in sorted(duplicates))
            raise ValidationError(f"lane indices must be unique, duplicates: {dup}")

        normalized.sort(key=lambda lane: int(lane["index"]))
        return normalized

    def validate_lane_patch(
        self,
        *,
        current_allow: str | None,
        current_disallow: str | None,
        patch: dict[str, object],
    ) -> dict[str, object]:
        normalized = self.normalize_lane_payload(patch)

        effective_allow = normalized.get("allow", current_allow)
        effective_disallow = normalized.get("disallow", current_disallow)
        allow_value = effective_allow if isinstance(effective_allow, str) else None
        disallow_value = effective_disallow if isinstance(effective_disallow, str) else None
        self.validate_allow_disallow(
            allow_value,
            disallow_value,
        )

        if "index" in normalized:
            normalized["index"] = int(normalized["index"])

        return normalized
