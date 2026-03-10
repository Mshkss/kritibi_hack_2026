export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  project_id: string;
  code: string;
  x: number;
  y: number;
  type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lane {
  id: string;
  edge_id: string;
  index: number;
  allow: string | null;
  disallow: string | null;
  speed: number | null;
  width: number | null;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  project_id: string;
  code: string;
  from_node_id: string;
  to_node_id: string;
  road_type_id: string | null;
  name: string | null;
  speed: number | null;
  priority: number | null;
  length: number | null;
  width: number | null;
  sidewalk_width: number | null;
  shape: Point[];
  lanes: Lane[];
  num_lanes: number;
  created_at: string;
  updated_at: string;
}

export interface RoadType {
  id: string;
  project_id: string;
  code: string;
  name: string | null;
  num_lanes: number | null;
  speed: number | null;
  priority: number | null;
  width: number | null;
  sidewalk_width: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectNetwork {
  project: Project;
  nodes: Node[];
  road_types: RoadType[];
  edges: Edge[];
}

export interface NodeSummary {
  id: string;
  code: string;
}

export interface EdgeConnectionSummary {
  id: string;
  code: string;
  name: string | null;
  from_node_id: string;
  to_node_id: string;
  num_lanes: number;
}

export interface Connection {
  id: string;
  project_id: string;
  via_node_id: string;
  from_edge_id: string;
  to_edge_id: string;
  from_lane_index: number;
  to_lane_index: number;
  uncontrolled: boolean;
  from_edge_code: string;
  to_edge_code: string;
  via_node_code: string;
  from_edge_name: string | null;
  to_edge_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NodeConnectionsResponse {
  node: NodeSummary;
  incoming_edges: EdgeConnectionSummary[];
  outgoing_edges: EdgeConnectionSummary[];
  connections: Connection[];
}

export interface ConnectionCandidatePair {
  from_edge_id: string;
  from_edge_code: string;
  to_edge_id: string;
  to_edge_code: string;
  is_u_turn: boolean;
  lane_mapping_count: number;
}

export interface ConnectionInvalidPair {
  from_edge_id: string;
  from_edge_code: string;
  to_edge_id: string;
  to_edge_code: string;
  reason: string;
}

export interface ConnectionCandidatesResponse {
  node_id: string;
  incoming_edges: EdgeConnectionSummary[];
  outgoing_edges: EdgeConnectionSummary[];
  valid_pairs: ConnectionCandidatePair[];
  invalid_pairs: ConnectionInvalidPair[];
  diagnostics: string[];
}

export interface ConnectionAutogenerateResponse {
  node_id: string;
  considered_pairs: number;
  created_count: number;
  skipped_duplicates: number;
  skipped_u_turns: number;
  created_connections: Connection[];
  diagnostics: string[];
}

export interface EdgeEditorResponse {
  edge: Edge;
  road_type: RoadType | null;
}

export interface Intersection {
  id: string;
  project_id: string;
  node_id: string;
  kind: 'crossroad' | 'roundabout';
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntersectionNodeSummary {
  id: string;
  code: string;
  x: number;
  y: number;
  type: string | null;
}

export interface IntersectionEdgeSummary {
  id: string;
  code: string;
  name: string | null;
  from_node_id: string;
  to_node_id: string;
  num_lanes: number;
}

export interface IntersectionApproach {
  id: string;
  project_id: string;
  intersection_id: string;
  incoming_edge_id: string;
  incoming_edge_code: string;
  incoming_edge_name: string | null;
  order_index: number | null;
  name: string | null;
  role: 'main' | 'secondary' | null;
  priority_rank: number | null;
  created_at: string;
  updated_at: string;
}

export interface Movement {
  id: string;
  project_id: string;
  intersection_id: string;
  approach_id: string;
  connection_id: string;
  from_edge_id: string;
  to_edge_id: string;
  from_lane_index: number;
  to_lane_index: number;
  is_enabled: boolean;
  movement_kind: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntersectionValidationResponse {
  intersection_id: string;
  is_valid: boolean;
  empty_approaches: string[];
  missing_movements: string[];
  stale_movements: string[];
  warnings: string[];
  errors: string[];
}

export interface PrioritySchemeSummary {
  main_count: number;
  secondary_count: number;
  unassigned_count: number;
  is_complete: boolean;
  has_conflicts: boolean;
}

export interface PrioritySchemeResponse {
  intersection_id: string;
  approaches: IntersectionApproach[];
  summary: PrioritySchemeSummary;
}

export interface PrioritySchemeValidationResponse {
  intersection_id: string;
  is_valid: boolean;
  is_complete: boolean;
  missing_roles: string[];
  warnings: string[];
  errors: string[];
  exportable_as_priority_controlled: boolean;
}

export interface TrafficSign {
  id: string;
  project_id: string;
  intersection_id: string | null;
  approach_id: string | null;
  node_id: string | null;
  edge_id: string | null;
  sign_type: 'main_road' | 'yield' | 'stop';
  generated: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SignGenerationResponse {
  intersection_id: string;
  secondary_sign_type: 'yield' | 'stop';
  created_count: number;
  updated_count: number;
  deleted_count: number;
  signs: TrafficSign[];
  diagnostics: string[];
}

export interface IntersectionExportHintsResponse {
  intersection_id: string;
  node_type: string | null;
  priority_controlled: boolean;
  requires_stop_signs: boolean;
  requires_yield_signs: boolean;
  notes: string[];
}

export interface PedestrianCrossing {
  id: string;
  project_id: string;
  intersection_id: string;
  approach_id: string | null;
  side_key: string;
  is_enabled: boolean;
  name: string | null;
  crossing_kind: 'zebra' | 'signalized' | 'uncontrolled' | null;
  incoming_edge_id: string | null;
  incoming_edge_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedestrianCrossingListResponse {
  intersection_id: string;
  crossings: PedestrianCrossing[];
}

export interface PedestrianCrossingSideCandidate {
  side_key: string;
  approach_id: string | null;
  incoming_edge_id: string | null;
  incoming_edge_code: string | null;
  already_has_crossing: boolean;
  crossing_id: string | null;
  crossing_is_enabled: boolean | null;
}

export interface PedestrianCrossingSidesResponse {
  intersection_id: string;
  candidate_sides: PedestrianCrossingSideCandidate[];
  warnings: string[];
  errors: string[];
}

export interface IntersectionEditorResponse {
  intersection: Intersection;
  node: IntersectionNodeSummary;
  incoming_edges: IntersectionEdgeSummary[];
  outgoing_edges: IntersectionEdgeSummary[];
  approaches: IntersectionApproach[];
  movements: Movement[];
  diagnostics: IntersectionValidationResponse;
  priority_scheme: PrioritySchemeResponse;
  generated_signs: TrafficSign[];
  export_hints: IntersectionExportHintsResponse;
  pedestrian_crossings: PedestrianCrossing[];
  pedestrian_crossing_sides: PedestrianCrossingSidesResponse;
}

export interface ApiErrorPayload {
  detail?: string;
  errors?: Array<Record<string, unknown>>;
}
