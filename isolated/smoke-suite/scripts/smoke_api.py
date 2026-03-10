#!/usr/bin/env python3
"""Smoke runner for notes-app backend API."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class Step:
    name: str
    method: str
    path: Callable[[dict[str, Any]], str]
    expected_statuses: tuple[int, ...]
    body: Callable[[dict[str, Any]], dict[str, Any]] | None = None
    capture: Callable[[dict[str, Any], Any], None] | None = None


def http_request(base_url: str, method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
    url = f"{base_url.rstrip('/')}{path}"
    data = None
    headers: dict[str, str] = {}

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            parsed: Any = None
            if raw:
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw
            return response.status, parsed
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        parsed: Any = raw
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            pass
        return exc.code, parsed


def build_steps(suffix: str) -> list[Step]:
    def create_edge_body(ctx: dict[str, Any]) -> dict[str, Any]:
        return {
            "code": f"E-{suffix}",
            "from_node_id": ctx["node_a_id"],
            "to_node_id": ctx["node_b_id"],
            "road_type_id": ctx["road_type_id"],
            "name": "Smoke edge",
            "speed": 13.9,
            "width": 3.5,
            "shape": [{"x": 12.0, "y": 9.0}, {"x": 40.0, "y": 20.0}],
            "lanes": [
                {"index": 0, "allow": "passenger bus", "speed": 13.9, "width": 3.5},
                {"index": 1, "allow": "passenger", "speed": 13.9, "width": 3.5},
            ],
        }

    return [
        Step(name="health", method="GET", path=lambda _ctx: "/health", expected_statuses=(200,)),
        Step(
            name="create_project",
            method="POST",
            path=lambda _ctx: "/projects",
            expected_statuses=(201,),
            body=lambda _ctx: {"name": f"Smoke Script {suffix}", "description": "Isolated smoke scenario"},
            capture=lambda ctx, body: ctx.update({"project_id": body["id"]}),
        ),
        Step(name="list_projects", method="GET", path=lambda _ctx: "/projects", expected_statuses=(200,)),
        Step(
            name="get_project",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}",
            expected_statuses=(200,),
        ),
        Step(
            name="update_project",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}",
            body=lambda _ctx: {"description": "Updated by isolated smoke script"},
            expected_statuses=(200,),
        ),
        Step(
            name="create_node_a",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes",
            body=lambda _ctx: {"code": f"N-{suffix}-A", "x": 10.0, "y": 10.0, "type": "junction"},
            expected_statuses=(201,),
            capture=lambda ctx, body: ctx.update({"node_a_id": body["id"]}),
        ),
        Step(
            name="create_node_b",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes",
            body=lambda _ctx: {"code": f"N-{suffix}-B", "x": 40.0, "y": 20.0, "type": "junction"},
            expected_statuses=(201,),
            capture=lambda ctx, body: ctx.update({"node_b_id": body["id"]}),
        ),
        Step(
            name="create_node_c",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes",
            body=lambda _ctx: {"code": f"N-{suffix}-C", "x": 80.0, "y": 10.0, "type": "junction"},
            expected_statuses=(201,),
            capture=lambda ctx, body: ctx.update({"node_c_id": body["id"]}),
        ),
        Step(
            name="create_disposable_node",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes",
            body=lambda _ctx: {"code": f"N-{suffix}-D", "x": 100.0, "y": 100.0, "type": "shape"},
            expected_statuses=(201,),
            capture=lambda ctx, body: ctx.update({"disposable_node_id": body["id"]}),
        ),
        Step(
            name="list_nodes",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes",
            expected_statuses=(200,),
        ),
        Step(
            name="update_node_a",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_a_id']}",
            body=lambda _ctx: {"x": 12.0, "y": 9.0},
            expected_statuses=(200,),
        ),
        Step(
            name="delete_disposable_node",
            method="DELETE",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['disposable_node_id']}",
            expected_statuses=(204,),
        ),
        Step(
            name="create_road_type",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/road-types",
            expected_statuses=(201,),
            body=lambda _ctx: {
                "code": f"RT-{suffix}",
                "name": "Urban test",
                "num_lanes": 2,
                "speed": 13.9,
                "priority": 3,
                "width": 3.5,
                "sidewalk_width": 2.0,
            },
            capture=lambda ctx, body: ctx.update({"road_type_id": body["id"]}),
        ),
        Step(
            name="list_road_types",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/road-types",
            expected_statuses=(200,),
        ),
        Step(
            name="update_road_type",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/road-types/{ctx['road_type_id']}",
            body=lambda _ctx: {"speed": 15.0, "width": 3.6},
            expected_statuses=(200,),
        ),
        Step(
            name="create_edge_ab",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges",
            body=create_edge_body,
            expected_statuses=(201,),
            capture=lambda ctx, body: ctx.update({"edge_ab_id": body["id"], "edge_ab_lane_id": body["lanes"][0]["id"]}),
        ),
        Step(
            name="create_edge_bc",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges",
            expected_statuses=(201,),
            body=lambda ctx: {
                "code": f"E-{suffix}-BC",
                "from_node_id": ctx["node_b_id"],
                "to_node_id": ctx["node_c_id"],
                "road_type_id": ctx["road_type_id"],
                "name": "B to C",
                "speed": 13.0,
                "width": 3.5,
                "shape": [{"x": 40.0, "y": 20.0}, {"x": 80.0, "y": 10.0}],
            },
            capture=lambda ctx, body: ctx.update({"edge_bc_id": body["id"]}),
        ),
        Step(
            name="create_bidirectional_edge_ab",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/bidirectional",
            expected_statuses=(201,),
            body=lambda ctx: {
                "forward_code": f"E-{suffix}-FWD",
                "reverse_code": f"E-{suffix}-REV",
                "from_node_id": ctx["node_a_id"],
                "to_node_id": ctx["node_b_id"],
                "road_type_id": ctx["road_type_id"],
                "shape": [{"x": 12.0, "y": 9.0}, {"x": 40.0, "y": 20.0}],
            },
            capture=lambda ctx, body: ctx.update({"edge_fwd_id": body[0]["id"], "edge_rev_id": body[1]["id"]}),
        ),
        Step(
            name="list_edges",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges",
            expected_statuses=(200,),
        ),
        Step(
            name="get_edge_ab",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}",
            expected_statuses=(200,),
        ),
        Step(
            name="get_edge_editor_ab",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/editor",
            expected_statuses=(200,),
        ),
        Step(
            name="patch_edge_ab",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}",
            body=lambda _ctx: {"name": "Smoke edge updated", "speed": 14.2, "width": 3.7},
            expected_statuses=(200,),
        ),
        Step(
            name="patch_shape_ab",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/shape",
            body=lambda _ctx: {"shape": [{"x": 12.0, "y": 9.0}, {"x": 20.0, "y": 14.0}, {"x": 40.0, "y": 20.0}]},
            expected_statuses=(200,),
        ),
        Step(
            name="recalculate_length_ab",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/recalculate-length",
            expected_statuses=(200,),
        ),
        Step(
            name="replace_lanes_ab",
            method="PUT",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/lanes",
            body=lambda _ctx: {
                "lanes": [
                    {"index": 0, "allow": "passenger", "speed": 14.0, "width": 3.6},
                    {"index": 1, "allow": "passenger bus", "speed": 13.4, "width": 3.7},
                ]
            },
            expected_statuses=(200,),
            capture=lambda ctx, body: ctx.update({"edge_ab_lane_id": body["lanes"][0]["id"]}),
        ),
        Step(
            name="patch_lane_ab",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/lanes/{ctx['edge_ab_lane_id']}",
            body=lambda _ctx: {"allow": "passenger bus taxi", "speed": 12.8},
            expected_statuses=(200,),
        ),
        Step(
            name="apply_road_type_ab",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/edges/{ctx['edge_ab_id']}/apply-road-type",
            body=lambda ctx: {
                "road_type_id": ctx["road_type_id"],
                "speed": 14.4,
                "width": 3.55,
                "lane_speed": 14.4,
                "lane_width": 3.55,
                "apply_to_lanes": True,
            },
            expected_statuses=(200,),
        ),
        Step(
            name="connection_candidates_node_b",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/connection-candidates",
            expected_statuses=(200,),
        ),
        Step(
            name="create_connection_manual",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/connections",
            expected_statuses=(201,),
            body=lambda ctx: {
                "via_node_id": ctx["node_b_id"],
                "from_edge_id": ctx["edge_ab_id"],
                "to_edge_id": ctx["edge_bc_id"],
                "from_lane_index": 0,
                "to_lane_index": 0,
                "uncontrolled": False,
            },
            capture=lambda ctx, body: ctx.update({"connection_id": body["id"]}),
        ),
        Step(
            name="patch_connection_manual",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/connections/{ctx['connection_id']}",
            expected_statuses=(200,),
            body=lambda _ctx: {"uncontrolled": True},
        ),
        Step(
            name="node_connections_node_b",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/connections",
            expected_statuses=(200,),
        ),
        Step(
            name="create_connection_invalid_topology",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/connections",
            expected_statuses=(400,),
            body=lambda ctx: {
                "via_node_id": ctx["node_a_id"],
                "from_edge_id": ctx["edge_ab_id"],
                "to_edge_id": ctx["edge_bc_id"],
                "from_lane_index": 0,
                "to_lane_index": 0,
                "uncontrolled": False,
            },
        ),
        Step(
            name="autogenerate_connections_node_b",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/connections/autogenerate",
            expected_statuses=(200,),
            body=lambda _ctx: {"add_missing_only": True, "allow_u_turns": False, "uncontrolled": False},
        ),
        Step(
            name="autogenerate_connections_repeat",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/connections/autogenerate",
            expected_statuses=(200,),
            body=lambda _ctx: {"add_missing_only": True, "allow_u_turns": False, "uncontrolled": False},
        ),
        Step(
            name="autogenerate_invalid_mode",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/connections/autogenerate",
            expected_statuses=(400,),
            body=lambda _ctx: {"add_missing_only": False, "allow_u_turns": False, "uncontrolled": False},
        ),
        Step(
            name="create_intersection_node_b",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections",
            expected_statuses=(201,),
            body=lambda ctx: {
                "node_id": ctx["node_b_id"],
                "kind": "crossroad",
                "name": "Smoke intersection",
                "auto_sync": True,
            },
            capture=lambda ctx, body: ctx.update({"intersection_id": body["id"]}),
        ),
        Step(
            name="get_intersection",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}",
            expected_statuses=(200,),
        ),
        Step(
            name="get_intersection_by_node",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/nodes/{ctx['node_b_id']}/intersection",
            expected_statuses=(200,),
        ),
        Step(
            name="patch_intersection",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}",
            expected_statuses=(200,),
            body=lambda _ctx: {"name": "Smoke intersection patched"},
        ),
        Step(
            name="sync_approaches",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/approaches/sync",
            expected_statuses=(200,),
            body=lambda _ctx: {"add_missing_only": True, "remove_stale": False},
        ),
        Step(
            name="list_approaches",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/approaches",
            expected_statuses=(200,),
            capture=lambda ctx, body: ctx.update(
                {
                    "approach_id": body[0]["id"] if body else "",
                    "approaches_json": json.dumps(body),
                }
            ),
        ),
        Step(
            name="pedestrian_crossing_sides",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossing-sides",
            expected_statuses=(200,),
            capture=lambda ctx, body: ctx.update(
                {
                    "pedestrian_side_key": (body.get("candidate_sides") or [{}])[0].get("side_key", ""),
                }
            ),
        ),
        Step(
            name="create_pedestrian_crossing",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings",
            expected_statuses=(201,),
            body=lambda ctx: {
                "approach_id": ctx["approach_id"],
                "side_key": f"approach:{ctx['approach_id']}",
                "is_enabled": True,
                "name": "Crosswalk A",
                "crossing_kind": "zebra",
            },
            capture=lambda ctx, body: ctx.update({"pedestrian_crossing_id": body["id"]}),
        ),
        Step(
            name="list_pedestrian_crossings",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings",
            expected_statuses=(200,),
        ),
        Step(
            name="get_pedestrian_crossing",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings/{ctx['pedestrian_crossing_id']}",
            expected_statuses=(200,),
        ),
        Step(
            name="create_pedestrian_crossing_duplicate_side",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings",
            expected_statuses=(409,),
            body=lambda ctx: {
                "approach_id": ctx["approach_id"],
                "side_key": f"approach:{ctx['approach_id']}",
                "is_enabled": True,
                "name": "Duplicate crossing",
                "crossing_kind": "signalized",
            },
        ),
        Step(
            name="create_pedestrian_crossing_invalid_side",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings",
            expected_statuses=(400,),
            body=lambda _ctx: {
                "side_key": "approach:not-a-real-approach",
                "is_enabled": True,
                "name": "Invalid side crossing",
                "crossing_kind": "zebra",
            },
        ),
        Step(
            name="patch_pedestrian_crossing_disable",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings/{ctx['pedestrian_crossing_id']}",
            expected_statuses=(200,),
            body=lambda _ctx: {
                "is_enabled": False,
                "name": "Crosswalk A disabled",
                "crossing_kind": "uncontrolled",
            },
        ),
        Step(
            name="patch_approach_priority",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/approaches/{ctx['approach_id']}",
            expected_statuses=(200,),
            body=lambda _ctx: {"role": "main", "priority_rank": 1},
        ),
        Step(
            name="put_priority_scheme",
            method="PUT",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/priority-scheme",
            expected_statuses=(200,),
            body=lambda ctx: {
                "items": [
                    {
                        "approach_id": item["id"],
                        "role": "main" if idx == 0 else "secondary",
                        "priority_rank": idx + 1,
                    }
                    for idx, item in enumerate(json.loads(ctx.get("approaches_json", "[]")))
                ],
                "reset_missing": False,
            },
        ),
        Step(
            name="get_priority_scheme",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/priority-scheme",
            expected_statuses=(200,),
        ),
        Step(
            name="validate_priority_scheme",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/priority-validation",
            expected_statuses=(200,),
        ),
        Step(
            name="generate_signs",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/signs/generate",
            expected_statuses=(200,),
            body=lambda _ctx: {"secondary_sign_type": "yield"},
        ),
        Step(
            name="list_signs",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/signs",
            expected_statuses=(200,),
        ),
        Step(
            name="get_export_hints",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/export-hints",
            expected_statuses=(200,),
        ),
        Step(
            name="sync_movements",
            method="POST",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/movements/sync",
            expected_statuses=(200,),
            body=lambda _ctx: {"add_missing_only": True, "remove_stale": False, "default_is_enabled": True},
        ),
        Step(
            name="list_movements",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/movements",
            expected_statuses=(200,),
            capture=lambda ctx, body: ctx.update({"movement_id": body[0]["id"] if body else ""}),
        ),
        Step(
            name="patch_movement",
            method="PATCH",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/movements/{ctx['movement_id']}",
            expected_statuses=(200,),
            body=lambda _ctx: {"is_enabled": False, "movement_kind": "straight"},
        ),
        Step(
            name="intersection_editor",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/editor",
            expected_statuses=(200,),
        ),
        Step(
            name="intersection_validation",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/validation",
            expected_statuses=(200,),
        ),
        Step(
            name="delete_pedestrian_crossing",
            method="DELETE",
            path=lambda ctx: f"/projects/{ctx['project_id']}/intersections/{ctx['intersection_id']}/pedestrian-crossings/{ctx['pedestrian_crossing_id']}",
            expected_statuses=(204,),
        ),
        Step(
            name="delete_connection_manual",
            method="DELETE",
            path=lambda ctx: f"/projects/{ctx['project_id']}/connections/{ctx['connection_id']}",
            expected_statuses=(204,),
        ),
        Step(
            name="get_network",
            method="GET",
            path=lambda ctx: f"/projects/{ctx['project_id']}/network",
            expected_statuses=(200,),
        ),
        Step(
            name="delete_project",
            method="DELETE",
            path=lambda ctx: f"/projects/{ctx['project_id']}",
            expected_statuses=(204,),
        ),
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run backend API smoke scenario")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    args = parser.parse_args()

    ctx: dict[str, Any] = {}
    suffix = str(int(time.time()))[-6:]
    steps = build_steps(suffix)

    print(f"[smoke] base_url={args.base_url}")

    for i, step in enumerate(steps, start=1):
        path = step.path(ctx)
        body = step.body(ctx) if step.body else None
        status, response = http_request(args.base_url, step.method, path, body)

        ok = status in step.expected_statuses
        marker = "OK" if ok else "FAIL"
        print(f"[{i:02d}/{len(steps):02d}] {marker} {step.name}: {step.method} {path} -> {status}")

        if not ok:
            print("response:")
            print(json.dumps(response, ensure_ascii=True, indent=2) if not isinstance(response, str) else response)
            return 1

        if step.capture:
            step.capture(ctx, response)

    print("[smoke] all steps passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
