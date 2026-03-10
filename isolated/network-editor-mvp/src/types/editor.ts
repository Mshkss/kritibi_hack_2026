import type {Edge, Intersection, Project} from './api';

export type EditorMode = 'select' | 'add-node' | 'add-edge' | 'connections' | 'intersection';

export type EntitySelection =
  | {kind: 'node'; id: string}
  | {kind: 'edge'; id: string}
  | {kind: 'connection'; id: string; nodeId: string}
  | {kind: 'intersection'; id: string; nodeId: string}
  | {kind: 'approach'; id: string; intersectionId: string; nodeId: string}
  | {kind: 'sign'; id: string; intersectionId: string; nodeId: string}
  | {kind: 'movement'; id: string; intersectionId: string; nodeId: string}
  | {kind: 'crossing'; id: string; intersectionId: string; nodeId: string}
  | {kind: 'validation'; id: string; scope: 'intersection' | 'priority'; intersectionId: string; nodeId: string}
  | null;

export interface ViewBoxState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number | 'error';
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  errorMessage?: string;
}

export interface NetworkMaps {
  nodesById: Record<string, import('./api').Node>;
  edgesById: Record<string, Edge>;
  incomingByNodeId: Record<string, Edge[]>;
  outgoingByNodeId: Record<string, Edge[]>;
}

export interface ProjectOption {
  project: Project;
  nodeCount?: number;
  edgeCount?: number;
}

export interface EdgeDraftOptions {
  bidirectional: boolean;
  roadTypeId: string;
}

export interface EdgeInspectorContext {
  edge: Edge;
  destinationConnections: import('./api').NodeConnectionsResponse | null;
}

export interface NodeIntersectionContext {
  intersection: Intersection | null;
  editor: import('./api').IntersectionEditorResponse | null;
}
