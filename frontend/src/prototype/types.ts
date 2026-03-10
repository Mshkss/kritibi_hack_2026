export type NodeType = 'default' | 'traffic_light' | 'crossing' | 'bus_stop';

export type Point = {
  lat: number;
  lng: number;
};

export type Node = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  type?: NodeType;
};

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  points: Point[]; // intermediate control points
  isOneWay: boolean;
  name?: string;
  laneIndex?: number;
  isForward?: boolean;
  tags?: Record<string, string>;
};

export type NetworkState = {
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
};
