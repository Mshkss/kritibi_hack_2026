export type NodeType = 'default' | 'traffic_light' | 'crossing' | 'bus_stop' | 'speed_limit';
export type EdgeValueMode = 'auto' | 'manual';
export type ParkingType = 1 | 2 | 3;
export type StopType = 1 | 2 | 3;
export type ManeuverType = 1 | 2 | 3 | 4 | 5;
export type TrafficLightSide = 'north' | 'east' | 'south' | 'west';
export type TrafficLightColor = 'red' | 'yellow' | 'green';
export type TrafficLightPhase =
  | 'NS_GREEN'
  | 'NS_YELLOW'
  | 'ALL_RED_NS_TO_EW'
  | 'EW_GREEN'
  | 'EW_YELLOW'
  | 'ALL_RED_EW_TO_NS';

export type TrafficLightTimings = {
  nsGreenSec: number;
  nsYellowSec: number;
  ewGreenSec: number;
  ewYellowSec: number;
  allRedSec: number;
};

export type TrafficLightControlConfig = {
  timings: TrafficLightTimings;
  cycleOffsetSec: number;
  approachSideOverrides: Record<string, TrafficLightSide>;
};

export type Point = {
  lat: number;
  lng: number;
};

export type Node = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  speedLimit?: number;
  type?: NodeType;
  trafficLightControl?: TrafficLightControlConfig;
};

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  points: Point[]; // intermediate control points
  isOneWay: boolean;
  crossroad: boolean;
  busStop: boolean;
  speedLimit: number;
  laneWidth: number;
  turnRadius: number;
  pedestrianIntensity: number;
  pedestrianIntensityMode: EdgeValueMode;
  roadSlope: number;
  parkingType: ParkingType;
  stopType: StopType;
  stopTypeMode: EdgeValueMode;
  maneuverType: ManeuverType;
  turnPercentage: number;
  name?: string;
  laneIndex?: number;
  isForward?: boolean;
  tags?: Record<string, string>;
};

export type NetworkState = {
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
};
