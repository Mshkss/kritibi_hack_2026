# API Contract

TODO: describe API DTOs and endpoint contracts.

-Общий JSON:
	{
	"project": {
		"id": "proj-1",
		"name": "demo"
	},
	"nodes": [],
	"edges": [],
	"road_types": [],
	"connections": [],
	"intersections": [],
	"movements": [],
	"phases": []
	}

-Node:
	{
	"id": "uuid",
	"code": "N1",
	"project_id": "uuid",
	"x": 50.0,
	"y": 50.0,
	"type": "traffic_light"
	}

-edge.dto 
	{
	"id": "uuid",
	"code": "E1",
	"project_id": "uuid",
	"from_node_id": "uuid",
	"to_node_id": "uuid",
	"road_type_id": "uuid",
	"speed": 15.0,
	"priority": 3,
	"length": 100.0,
	"width": 3.5,
	"sidewalk_width": 2.0,
	"shape": [
		{"x": 50.0, "y": 50.0},
		{"x": 60.0, "y": 55.0}
	],
	"name": "Main street",
	"lanes": [
		{
		"index": 0,
		"allow": ["bus"],
		"speed": 10.0,
		"width": 3.0
		}
	]
	}
-Connection DTO
	{
	"id": "uuid",
	"project_id": "uuid",
	"from_edge_code": "E0",
	"to_edge_code": "E1",
	"from_lane": 0,
	"to_lane": 1,
	"uncontrolled": false
	}