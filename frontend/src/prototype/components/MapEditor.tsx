import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Pane,
  useMapEvents,
  Tooltip,
  useMap,
  CircleMarker,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import {
  Edge,
  NetworkState,
  Node,
  NodeType,
  TrafficLightColor,
  TrafficLightPhase,
  TrafficLightSide,
} from '../types';
import { Sidebar } from './Sidebar';
import { parseOSM } from '../utils/osmParser';
import { validateNetwork, ValidationResult } from '../utils/graphValidation';
import {
  buildLaneNetworkJsonExport,
  buildLaneNetworkOsmExport,
  downloadTextFile,
} from '../utils/networkExport';
import {
  NETWORK_EDITOR_AUTOSAVE_DEBOUNCE_MS,
  NETWORK_EDITOR_AUTOSAVE_MIN_INTERVAL_MS,
  NETWORK_EDITOR_HISTORY_LIMIT,
  NETWORK_EDITOR_STORAGE_KEY,
  appendHistoryState,
  createInitialHistoryState,
  persistHistoryStateWithFallback,
  type EditorHistoryState,
} from '../utils/networkStatePersistence';
import {
  advanceCar,
  buildSimulationGraph,
  reconcileCars,
  type CarState,
  type SimulationGraphRuntime,
} from '../utils/vehicleSimulation';
import {
  MAX_EDGE_CAPACITY,
  calculateNetworkCoefficientSummary,
} from '../utils/edgeCoefficients';
import {
  TRAFFIC_LIGHT_APPROACH_RADIUS_METERS,
  buildTrafficLightLocalFrame,
  deriveTrafficLightApproachSide,
  distanceMeters,
  getDefaultTrafficLightControlConfig,
  getDefaultTrafficLightLocalFrame,
  getTrafficLightRuntimeState,
  getTrafficLightSideUnitVector,
  sanitizeTrafficLightControlConfig,
  type TrafficLightLocalFrame,
} from '../utils/trafficLightSimulation';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map centering
function MapCenterer({ center }: { center: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, 16);
    }
  }, [center, map]);
  return null;
}

// Custom icons
const nodeIcon = L.divIcon({
  className: 'custom-node-icon',
  html: '<div style="background-color: #3b82f6; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const selectedNodeIcon = L.divIcon({
  className: 'custom-node-icon-selected',
  html: '<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const trafficLightIcon = L.divIcon({
  className: 'custom-tl-icon',
  html: '<div style="background-color: #333; width: 18px; height: 30px; border-radius: 4px; border: 1px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;"><div style="background: #ef4444; width: 7px; height: 7px; border-radius: 50%"></div><div style="background: #eab308; width: 7px; height: 7px; border-radius: 50%"></div><div style="background: #22c55e; width: 7px; height: 7px; border-radius: 50%"></div></div>',
  iconSize: [18, 30],
  iconAnchor: [9, 15]
});

const crossingIcon = L.divIcon({
  className: 'custom-cross-icon',
  html: '<div style="background-color: #ffffff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #111827; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const busStopIcon = L.divIcon({
  className: 'custom-bus-icon',
  html: '<div style="background-color: #007bff; width: 20px; height: 20px; border-radius: 4px; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; color: white; font-size: 11px; font-weight: bold;">А</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const getSpeedLimitIcon = (value: number) => {
  const safeValue = Math.max(5, Math.min(200, Math.round(value)));
  const fontSize = safeValue >= 100 ? 9 : 10;
  return L.divIcon({
    className: 'custom-speed-limit-icon',
    html: `<div style="background-color: #ffffff; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #dc2626; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; color: #111827; font-size: ${fontSize}px; font-weight: 700; line-height: 1;">${safeValue}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const getDirectionArrowIcon = (angleDeg: number, zoom: number) => {
  const scale = Math.max(0.2, Math.min(1, (zoom - 11) / 6));
  const halfBase = Math.max(1, Math.round(4 * scale));
  const height = Math.max(4, Math.round(12 * scale));
  const size = Math.max(6, Math.round(14 * scale));
  const anchorX = Math.round(size / 2);
  const gapPx = Math.max(1, Math.round(8 * scale));
  return L.divIcon({
    className: 'custom-lane-direction-arrow',
    html: `<div style="width: 0; height: 0; border-left: ${halfBase}px solid transparent; border-right: ${halfBase}px solid transparent; border-bottom: ${height}px solid #111827; transform: rotate(${angleDeg}deg) translateY(${gapPx}px); transform-origin: 50% 0%; filter: drop-shadow(0 0 1px rgba(255,255,255,0.9));"></div>`,
    iconSize: [size, size],
    iconAnchor: [anchorX, 0]
  });
};

const CAR_ICON_SIZE: [number, number] = [24, 40];
const CAR_ICON_ANCHOR: [number, number] = [12, 20];
const CAR_ICON_SVG = `
  <svg width="24" height="40" viewBox="0 0 20 34" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.42));">
    <rect x="4" y="2.5" width="12" height="29" rx="4.8" fill="#16a34a" stroke="#ffffff" stroke-width="1.25"/>
    <rect x="6.4" y="6.2" width="7.2" height="6.6" rx="1.6" fill="#e6f4ff" stroke="#9ca3af" stroke-width="0.5"/>
    <rect x="6.4" y="14.2" width="7.2" height="7.8" rx="1.7" fill="#dbeafe" stroke="#9ca3af" stroke-width="0.5"/>
    <rect x="6.7" y="24" width="6.6" height="3.6" rx="1.2" fill="#14532d" opacity="0.28"/>
    <rect x="2" y="7" width="2.5" height="6.6" rx="1.1" fill="#111827"/>
    <rect x="2" y="20.4" width="2.5" height="6.6" rx="1.1" fill="#111827"/>
    <rect x="15.5" y="7" width="2.5" height="6.6" rx="1.1" fill="#111827"/>
    <rect x="15.5" y="20.4" width="2.5" height="6.6" rx="1.1" fill="#111827"/>
    <rect x="8.2" y="3.6" width="3.6" height="1.4" rx="0.5" fill="#f8fafc" opacity="0.95"/>
    <rect x="8.1" y="29.1" width="3.8" height="1.5" rx="0.6" fill="#dc2626" opacity="0.9"/>
  </svg>
`;
const carIconCache = new Map<number, L.DivIcon>();

const normalizeAngle = (angleDeg: number): number => {
  const normalized = angleDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const toLaneHeadingAngle = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number | null => {
  const dx = (to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180);
  const dy = to.lat - from.lat;
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return null;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
};

const getCarDirectionAngle = (car: CarState, graph: SimulationGraphRuntime): number => {
  const edge = graph.directedEdges[car.edgeId];
  if (!edge || edge.path.length < 2) return 0;

  const distanceOnEdge = Math.max(0, Math.min(edge.effectiveLength, car.distanceOnEdge));
  const geometricDistance =
    edge.totalLength > 1e-6 ? (distanceOnEdge / edge.effectiveLength) * edge.totalLength : 0;

  let passedLength = 0;
  for (let i = 0; i < edge.path.length - 1; i++) {
    const segmentLength = edge.segmentLengths[i] ?? 0;
    const from = edge.path[i];
    const to = edge.path[i + 1];
    const angle = toLaneHeadingAngle(from, to);

    if (geometricDistance <= passedLength + segmentLength + 1e-6) {
      if (angle !== null) return normalizeAngle(angle);
    }
    if (angle !== null && i === edge.path.length - 2) return normalizeAngle(angle);

    passedLength += segmentLength;
  }

  for (let i = 0; i < edge.path.length - 1; i++) {
    const angle = toLaneHeadingAngle(edge.path[i], edge.path[i + 1]);
    if (angle !== null) return normalizeAngle(angle);
  }

  return 0;
};

const getCarIcon = (angleDeg: number): L.DivIcon => {
  const roundedAngle = Math.round(normalizeAngle(angleDeg));
  const cached = carIconCache.get(roundedAngle);
  if (cached) return cached;

  const icon = L.divIcon({
    className: 'custom-car-icon',
    html: `<div style="width:${CAR_ICON_SIZE[0]}px;height:${CAR_ICON_SIZE[1]}px;display:flex;align-items:center;justify-content:center;transform:rotate(${roundedAngle}deg);transform-origin:50% 50%;">${CAR_ICON_SVG}</div>`,
    iconSize: CAR_ICON_SIZE,
    iconAnchor: CAR_ICON_ANCHOR,
  });
  carIconCache.set(roundedAngle, icon);
  return icon;
};

const INTERSECTION_CONNECTION_NAMES = new Set([
  'Intersection Connection',
  'Соединение перекрёстка',
  'РЎРѕРµРґРёРЅРµРЅРёРµ РїРµСЂРµРєСЂС‘СЃС‚РєР°',
]);
const isIntersectionConnection = (edge: Edge) =>
  typeof edge.name === 'string' && INTERSECTION_CONNECTION_NAMES.has(edge.name);

const toLocalXY = (lat: number, lng: number, refLat: number) => ({
  x: lng * 111320 * Math.cos((refLat * Math.PI) / 180),
  y: lat * 111320
});

const fromLocalXY = (x: number, y: number, refLat: number): [number, number] => [
  y / 111320,
  x / (111320 * Math.cos((refLat * Math.PI) / 180))
];

const DEFAULT_SPEED_LIMIT = 60;
const DEFAULT_LANE_WIDTH = 3.5;
const DEFAULT_TURN_RADIUS = 0;
const DEFAULT_PEDESTRIAN_INTENSITY = 0;
const CROSSING_PEDESTRIAN_INTENSITY = 1;
const DEFAULT_ROAD_SLOPE = 0;
const DEFAULT_PARKING_TYPE: 1 | 2 | 3 = 1;
const DEFAULT_STOP_TYPE: 1 | 2 | 3 = 1;
const BUS_STOP_TYPE: 1 | 2 | 3 = 2;
const DEFAULT_MANEUVER_TYPE: 1 | 2 | 3 | 4 | 5 = 1;
const DEFAULT_TURN_PERCENTAGE = 20;
const CROSSING_RADIUS_METERS = 10;
const BUS_STOP_RADIUS_METERS = 15;
const SPEED_LIMIT_DETECTION_RADIUS_METERS = 15;
const TRAFFIC_LIGHT_INDICATOR_OFFSET_METERS = 8;
const TRAFFIC_LIGHT_INDICATOR_RADIUS_PX = 5;
const TRAFFIC_LIGHT_SIDE_ORDER: TrafficLightSide[] = ['north', 'east', 'south', 'west'];
const TRAFFIC_LIGHT_SIDE_LABELS: Record<TrafficLightSide, string> = {
  north: 'A+',
  east: 'B+',
  south: 'A-',
  west: 'B-',
};
const TRAFFIC_LIGHT_COLOR_HEX: Record<TrafficLightColor, string> = {
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
};
const TRAFFIC_LIGHT_BLOCKING_COLORS = new Set<TrafficLightColor>(['red', 'yellow']);
const TRAFFIC_LIGHT_PHASE_LABELS: Record<TrafficLightPhase, string> = {
  NS_GREEN: 'A green',
  NS_YELLOW: 'A yellow',
  ALL_RED_NS_TO_EW: 'all-red A->B',
  EW_GREEN: 'B green',
  EW_YELLOW: 'B yellow',
  ALL_RED_EW_TO_NS: 'all-red B->A',
};
const isTrafficLightSideValue = (value: string): value is TrafficLightSide =>
  TRAFFIC_LIGHT_SIDE_ORDER.includes(value as TrafficLightSide);

type TrafficLightApproachEntry = {
  targetNodeId: string;
  directedEdgeIds: string[];
  autoSide: TrafficLightSide;
  effectiveSide: TrafficLightSide;
  isManual: boolean;
  distanceMeters: number;
};

const normalizeEdgeMode = (value: unknown): 'auto' | 'manual' =>
  value === 'manual' ? 'manual' : 'auto';

const normalizeLaneWidth = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : DEFAULT_LANE_WIDTH;

const normalizeTurnRadius = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : DEFAULT_TURN_RADIUS;

const normalizePedestrianIntensityValue = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : DEFAULT_PEDESTRIAN_INTENSITY;

const normalizeRoadSlope = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_ROAD_SLOPE;

const normalizeParkingType = (value: unknown): 1 | 2 | 3 =>
  value === 2 || value === 3 ? value : DEFAULT_PARKING_TYPE;

const normalizeStopType = (value: unknown): 1 | 2 | 3 =>
  value === 2 || value === 3 ? value : DEFAULT_STOP_TYPE;

const normalizeManeuverType = (value: unknown): 1 | 2 | 3 | 4 | 5 =>
  value === 2 || value === 3 || value === 4 || value === 5 ? value : DEFAULT_MANEUVER_TYPE;

const normalizeTurnPercentage = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_TURN_PERCENTAGE;

const normalizeNodeType = (type: Node['type']): NodeType => {
  if (type === 'traffic_light') return 'traffic_light';
  if (type === 'crossing') return 'crossing';
  if (type === 'bus_stop') return 'bus_stop';
  if (type === 'speed_limit') return 'speed_limit';
  return 'default';
};

const offsetLatLngByMeters = (
  lat: number,
  lng: number,
  northMeters: number,
  eastMeters: number,
): [number, number] => {
  const dLat = northMeters / 111320;
  const dLng = eastMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
};

type EdgeComputedProps = {
  crossroad: boolean;
  busStop: boolean;
  speedLimit: number;
};

const computeEdgeProps = (networkState: NetworkState): Record<string, EdgeComputedProps> => {
  const edges = Object.values(networkState.edges) as Edge[];
  const nodes = Object.values(networkState.nodes) as Node[];
  const laneEdges = edges.filter(edge => edge.isOneWay && !isIntersectionConnection(edge));
  const edgeProps: Record<string, EdgeComputedProps> = {};

  edges.forEach(edge => {
    edgeProps[edge.id] = {
      crossroad: false,
      busStop: false,
      speedLimit: DEFAULT_SPEED_LIMIT,
    };
  });

  const crossings = nodes.filter(node => node.type === 'crossing');
  const busStops = nodes.filter(node => node.type === 'bus_stop');

  laneEdges.forEach(edge => {
    const source = networkState.nodes[edge.sourceId];
    const target = networkState.nodes[edge.targetId];
    if (!source || !target) return;

    const hasCrossing = crossings.some(node =>
      L.latLng(source.lat, source.lng).distanceTo(L.latLng(node.lat, node.lng)) < CROSSING_RADIUS_METERS ||
      L.latLng(target.lat, target.lng).distanceTo(L.latLng(node.lat, node.lng)) < CROSSING_RADIUS_METERS
    );
    const hasBusStop = busStops.some(node =>
      L.latLng(source.lat, source.lng).distanceTo(L.latLng(node.lat, node.lng)) < BUS_STOP_RADIUS_METERS ||
      L.latLng(target.lat, target.lng).distanceTo(L.latLng(node.lat, node.lng)) < BUS_STOP_RADIUS_METERS
    );

    edgeProps[edge.id].crossroad = hasCrossing;
    edgeProps[edge.id].busStop = hasBusStop;
  });

  const intersectionNodes = new Set<string>();
  edges.forEach(edge => {
    if (isIntersectionConnection(edge)) {
      intersectionNodes.add(edge.sourceId);
      intersectionNodes.add(edge.targetId);
    }
  });

  const outgoingByNode: Record<string, string[]> = {};
  laneEdges.forEach(edge => {
    if (!outgoingByNode[edge.sourceId]) outgoingByNode[edge.sourceId] = [];
    outgoingByNode[edge.sourceId].push(edge.id);
  });

  const getPath = (edge: Edge): { lat: number; lng: number }[] => {
    const source = networkState.nodes[edge.sourceId];
    const target = networkState.nodes[edge.targetId];
    if (!source || !target) return [];
    return [source, ...edge.points, target];
  };

  const getDistanceAndSide = (path: { lat: number; lng: number }[], point: { lat: number; lng: number }) => {
    let minDistance = Number.POSITIVE_INFINITY;
    let isRight = false;
    for (let i = 0; i < path.length - 1; i++) {
      const a = toLocalXY(path[i].lat, path[i].lng, point.lat);
      const b = toLocalXY(path[i + 1].lat, path[i + 1].lng, point.lat);
      const p = toLocalXY(point.lat, point.lng, point.lat);
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = p.x - a.x;
      const apy = p.y - a.y;
      const ab2 = abx * abx + aby * aby;
      if (ab2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
      const cx = a.x + abx * t;
      const cy = a.y + aby * t;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        const cross = abx * (p.y - cy) - aby * (p.x - cx);
        isRight = cross < 0;
      }
    }
    return { distance: minDistance, isRight };
  };

  type Assignment = { speed: number; depth: number; startDistance: number };
  const assignments: Record<string, Assignment> = {};
  const speedSigns = nodes.filter(node => node.type === 'speed_limit' && typeof node.speedLimit === 'number');

  speedSigns.forEach(sign => {
    const signLimit = Math.max(5, Math.min(200, Math.round(sign.speedLimit || DEFAULT_SPEED_LIMIT)));
    const seedEdges: Array<{ edgeId: string; distance: number }> = [];

    laneEdges.forEach(edge => {
      const path = getPath(edge);
      if (path.length < 2) return;
      const { distance, isRight } = getDistanceAndSide(path, sign);
      if (isRight && distance <= SPEED_LIMIT_DETECTION_RADIUS_METERS) {
        seedEdges.push({ edgeId: edge.id, distance });
      }
    });

    seedEdges.forEach(seed => {
      const queue: Array<{ edgeId: string; depth: number }> = [{ edgeId: seed.edgeId, depth: 0 }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.edgeId)) continue;
        visited.add(current.edgeId);

        const prev = assignments[current.edgeId];
        const shouldAssign =
          !prev ||
          current.depth < prev.depth ||
          (current.depth === prev.depth && seed.distance < prev.startDistance);

        if (shouldAssign) {
          assignments[current.edgeId] = {
            speed: signLimit,
            depth: current.depth,
            startDistance: seed.distance,
          };
        }

        const edge = networkState.edges[current.edgeId];
        if (!edge) continue;
        if (intersectionNodes.has(edge.targetId)) continue;

        const nextEdges = outgoingByNode[edge.targetId] || [];
        nextEdges.forEach(nextEdgeId => {
          if (!visited.has(nextEdgeId)) {
            queue.push({ edgeId: nextEdgeId, depth: current.depth + 1 });
          }
        });
      }
    });
  });

  Object.keys(assignments).forEach(edgeId => {
    if (edgeProps[edgeId]) edgeProps[edgeId].speedLimit = assignments[edgeId].speed;
  });

  return edgeProps;
};

const normalizeNetworkState = (networkState: NetworkState): NetworkState => {
  const nodeIds = new Set(Object.keys(networkState.nodes));
  const normalizedNodes: Record<string, Node> = {};
  const computed = computeEdgeProps(networkState);
  const normalizedEdges: Record<string, Edge> = {};

  Object.entries(networkState.nodes).forEach(([nodeId, node]) => {
    const normalizedType = normalizeNodeType(node.type);
    const normalizedNode: Node = {
      ...node,
      type: normalizedType,
    };

    if (normalizedType === 'traffic_light') {
      normalizedNode.trafficLightControl = sanitizeTrafficLightControlConfig(
        node.trafficLightControl ?? getDefaultTrafficLightControlConfig(),
        nodeIds,
      );
    } else if (normalizedNode.trafficLightControl !== undefined) {
      delete normalizedNode.trafficLightControl;
    }

    normalizedNodes[nodeId] = normalizedNode;
  });

  Object.entries(networkState.edges).forEach(([edgeId, edge]) => {
    const props = computed[edgeId] || {
      crossroad: false,
      busStop: false,
      speedLimit: DEFAULT_SPEED_LIMIT,
    };
    const isHiddenIntersectionConnection = isIntersectionConnection(edge);
    const pedestrianIntensityMode = normalizeEdgeMode(edge.pedestrianIntensityMode);
    const stopTypeMode = normalizeEdgeMode(edge.stopTypeMode);
    const autoPedestrianIntensity = props.crossroad ? CROSSING_PEDESTRIAN_INTENSITY : DEFAULT_PEDESTRIAN_INTENSITY;
    const autoStopType = props.busStop ? BUS_STOP_TYPE : DEFAULT_STOP_TYPE;

    normalizedEdges[edgeId] = {
      ...edge,
      isOneWay: isHiddenIntersectionConnection ? true : edge.isOneWay,
      crossroad: props.crossroad,
      busStop: props.busStop,
      speedLimit: props.speedLimit,
      laneWidth: normalizeLaneWidth(edge.laneWidth),
      turnRadius: normalizeTurnRadius(edge.turnRadius),
      pedestrianIntensityMode,
      pedestrianIntensity:
        pedestrianIntensityMode === 'auto'
          ? autoPedestrianIntensity
          : normalizePedestrianIntensityValue(edge.pedestrianIntensity),
      roadSlope: normalizeRoadSlope(edge.roadSlope),
      parkingType: normalizeParkingType(edge.parkingType),
      stopTypeMode,
      stopType:
        stopTypeMode === 'auto'
          ? autoStopType
          : normalizeStopType(edge.stopType),
      maneuverType: normalizeManeuverType(edge.maneuverType),
      turnPercentage: normalizeTurnPercentage(edge.turnPercentage),
    };
  });

  return {
    ...networkState,
    nodes: normalizedNodes,
    edges: normalizedEdges,
  };
};

const getIconForNode = (node: Node, isSelected: boolean) => {
  if (isSelected && node.type === 'default') return selectedNodeIcon;
  if (node.type === 'traffic_light') return trafficLightIcon;
  if (node.type === 'crossing') return crossingIcon;
  if (node.type === 'bus_stop') return busStopIcon;
  if (node.type === 'speed_limit') return getSpeedLimitIcon(node.speedLimit || 40);
  return nodeIcon;
};

type Mode = 'SELECT' | 'ADD_NODE' | 'ADD_TRAFFIC_LIGHT' | 'ADD_CROSSING' | 'ADD_BUS_STOP' | 'ADD_SPEED_LIMIT' | 'ADD_EDGE' | 'DELETE';

const EMPTY_NETWORK_STATE = normalizeNetworkState({ nodes: {}, edges: {} });

const getMapCenterFromState = (networkState: NetworkState): [number, number] | null => {
  const nodes = Object.values(networkState.nodes);
  if (nodes.length === 0) return null;

  const avgLat = nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length;
  const avgLng = nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length;
  return [avgLat, avgLng];
};

export function MapEditor() {
  const initialHistoryState = useMemo<EditorHistoryState>(
    () =>
      createInitialHistoryState(
        NETWORK_EDITOR_STORAGE_KEY,
        EMPTY_NETWORK_STATE,
        normalizeNetworkState,
      ),
    [],
  );
  const [historyState, setHistoryState] = useState<EditorHistoryState>(initialHistoryState);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(() =>
    getMapCenterFromState(
      initialHistoryState.history[initialHistoryState.currentIndex] ?? EMPTY_NETWORK_STATE,
    ),
  );
  const saveTimeoutRef = useRef<number | null>(null);
  const lastAutosaveAtRef = useRef<number>(0);

  const { history, currentIndex } = historyState;
  const state = history[currentIndex];

  const pushState = useCallback((newState: NetworkState) => {
    const normalizedState = normalizeNetworkState(newState);
    setHistoryState((prev) =>
      appendHistoryState({
        history: prev.history,
        currentIndex: prev.currentIndex,
        nextState: normalizedState,
        maxHistory: NETWORK_EDITOR_HISTORY_LIMIT,
      }),
    );
  }, []);

  const undo = useCallback(() => {
    setHistoryState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const redo = useCallback(() => {
    setHistoryState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.history.length - 1, prev.currentIndex + 1),
    }));
  }, []);

  const flushPersistedState = useCallback(() => {
    persistHistoryStateWithFallback({
      storageKey: NETWORK_EDITOR_STORAGE_KEY,
      history,
      currentIndex,
    });
  }, [history, currentIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const now = Date.now();
      const elapsedSinceLastAutosave = now - lastAutosaveAtRef.current;
      if (elapsedSinceLastAutosave < NETWORK_EDITOR_AUTOSAVE_MIN_INTERVAL_MS) {
        const waitMs = NETWORK_EDITOR_AUTOSAVE_MIN_INTERVAL_MS - elapsedSinceLastAutosave;
        saveTimeoutRef.current = window.setTimeout(() => {
          flushPersistedState();
          lastAutosaveAtRef.current = Date.now();
          saveTimeoutRef.current = null;
        }, waitMs);
        return;
      }
      flushPersistedState();
      lastAutosaveAtRef.current = now;
      saveTimeoutRef.current = null;
    }, NETWORK_EDITOR_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [flushPersistedState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      flushPersistedState();
      lastAutosaveAtRef.current = Date.now();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushPersistedState]);
  
  const [mode, setMode] = useState<Mode>('SELECT');
  const [currentZoom, setCurrentZoom] = useState(13);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [speedLimitDialogPosition, setSpeedLimitDialogPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [speedLimitInput, setSpeedLimitInput] = useState('40');
  const [speedLimitInputError, setSpeedLimitInputError] = useState('');
  const [targetCarCount, setTargetCarCount] = useState(0);
  const [carCountInput, setCarCountInput] = useState('25');
  const [carInputError, setCarInputError] = useState('');
  const [cars, setCars] = useState<CarState[]>([]);
  const [trafficLightClockSec, setTrafficLightClockSec] = useState<number>(() =>
    typeof performance === 'undefined' ? 0 : performance.now() / 1000,
  );
  const simulationRafRef = useRef<number | null>(null);
  const simulationLastTsRef = useRef<number | null>(null);
  const blockedSimulationEdgesRef = useRef<Set<string>>(new Set());
  const selectedNode = selectedNodeId ? state.nodes[selectedNodeId] : null;
  const selectedTrafficLight = selectedNode?.type === 'traffic_light' ? selectedNode : null;
  const selectedEdge = selectedEdgeId ? state.edges[selectedEdgeId] : null;
  const coefficientSummary = useMemo(() => calculateNetworkCoefficientSummary(state), [state]);
  const selectedEdgeMetrics = selectedEdge ? coefficientSummary.edgeMetrics[selectedEdge.id] : undefined;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const intervalId = window.setInterval(() => {
      setTrafficLightClockSec(performance.now() / 1000);
    }, 200);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedNodeId && !state.nodes[selectedNodeId]) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, state.nodes]);

  useEffect(() => {
    if (selectedEdgeId && !state.edges[selectedEdgeId]) {
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId, state.edges]);

  const updateEdgeById = useCallback(
    (edgeId: string, updater: (edge: Edge) => Edge) => {
      const edge = state.edges[edgeId];
      if (!edge) return;
      pushState({
        ...state,
        edges: {
          ...state.edges,
          [edgeId]: updater(edge),
        },
      });
    },
    [pushState, state],
  );

  const updateNodeById = useCallback(
    (nodeId: string, updater: (node: Node) => Node) => {
      const node = state.nodes[nodeId];
      if (!node) return;
      pushState({
        ...state,
        nodes: {
          ...state.nodes,
          [nodeId]: updater(node),
        },
      });
    },
    [pushState, state],
  );

  const updateTrafficLightControl = useCallback(
    (
      nodeId: string,
      updater: (
        control: ReturnType<typeof getDefaultTrafficLightControlConfig>,
      ) => ReturnType<typeof getDefaultTrafficLightControlConfig>,
    ) => {
      const node = state.nodes[nodeId];
      if (!node || node.type !== 'traffic_light') return;

      const nodeIds = new Set(Object.keys(state.nodes));
      const currentControl = sanitizeTrafficLightControlConfig(
        node.trafficLightControl ?? getDefaultTrafficLightControlConfig(),
        nodeIds,
      );
      const nextControl = sanitizeTrafficLightControlConfig(updater(currentControl), nodeIds);

      updateNodeById(nodeId, (currentNode) => ({
        ...currentNode,
        trafficLightControl: nextControl,
      }));
    },
    [state.nodes, updateNodeById],
  );

  const nodeDirectionAngles = useMemo(() => {
    const angles: Record<string, number> = {};
    const edges = Object.values(state.edges) as Edge[];
    const visibleLaneEdges = edges
      .filter(edge => edge.isOneWay && !isIntersectionConnection(edge))
      .sort((a, b) => a.id.localeCompare(b.id));

    const angleFrom = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      const dx = (to.lng - from.lng) * Math.cos((from.lat * Math.PI) / 180);
      const dy = to.lat - from.lat;
      if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return null;
      return (Math.atan2(dx, dy) * 180) / Math.PI;
    };

    visibleLaneEdges.forEach(edge => {
      const source = state.nodes[edge.sourceId];
      const target = state.nodes[edge.targetId];
      if (!source || !target) return;

      if (source.type === 'default' && angles[source.id] === undefined) {
        const nextPoint = edge.points[0] || target;
        const angle = angleFrom(source, nextPoint);
        if (angle !== null) angles[source.id] = angle;
      }

      if (target.type === 'default' && angles[target.id] === undefined) {
        const prevPoint = edge.points.length > 0 ? edge.points[edge.points.length - 1] : source;
        const angle = angleFrom(prevPoint, target);
        if (angle !== null) angles[target.id] = angle;
      }
    });

    return angles;
  }, [state.edges, state.nodes]);

  const crossingZebraStripes = useMemo(() => {
    const laneEdges = (Object.values(state.edges) as Edge[]).filter(
      edge => edge.isOneWay && !isIntersectionConnection(edge)
    );
    const crossings = (Object.values(state.nodes) as Node[]).filter(node => node.type === 'crossing');
    const stripes: Array<{ id: string; positions: [number, number][] }> = [];

    crossings.forEach(crossing => {
      const refLat = crossing.lat;
      const p = toLocalXY(crossing.lat, crossing.lng, refLat);
      let best:
        | { distance: number; tx: number; ty: number }
        | null = null;
      const nearbyEdgeMetrics: Array<{ edge: Edge; distance: number }> = [];

      laneEdges.forEach(edge => {
        const source = state.nodes[edge.sourceId];
        const target = state.nodes[edge.targetId];
        if (!source || !target) return;

        const path = [source, ...edge.points, target];
        let edgeMinDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < path.length - 1; i++) {
          const a = toLocalXY(path[i].lat, path[i].lng, refLat);
          const b = toLocalXY(path[i + 1].lat, path[i + 1].lng, refLat);
          const abx = b.x - a.x;
          const aby = b.y - a.y;
          const ab2 = abx * abx + aby * aby;
          if (ab2 < 1e-9) continue;

          const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2));
          const cx = a.x + abx * t;
          const cy = a.y + aby * t;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < edgeMinDistance) edgeMinDistance = distance;
          const len = Math.sqrt(ab2);
          if (len < 1e-9) continue;

          if (!best || distance < best.distance) {
            best = { distance, tx: abx / len, ty: aby / len };
          }
        }

        if (Number.isFinite(edgeMinDistance)) {
          nearbyEdgeMetrics.push({ edge, distance: edgeMinDistance });
        }
      });

      if (!best || best.distance > 20) return;

      // Stripe direction and progression are intentionally swapped
      // to keep zebra bands perpendicular to lane direction in this map setup.
      const stripeDirX = best.tx;
      const stripeDirY = best.ty;
      const progressDirX = -best.ty;
      const progressDirY = best.tx;
      const nearbyEdges = nearbyEdgeMetrics.filter(m => m.distance <= 15).map(m => m.edge);
      const indexedNearby = nearbyEdges.filter(e => typeof e.laneIndex === 'number');
      const laneCount =
        indexedNearby.length > 0
          ? Math.max(...indexedNearby.map(e => (e.laneIndex as number) + 1))
          : Math.max(1, Math.min(6, nearbyEdges.length || 1));
      const stripeCount = Math.max(2, laneCount * 2);
      const halfSpanAcrossRoad = Math.max(3.2, laneCount * 1.45);
      const stripeSpacing = stripeCount > 1 ? (halfSpanAcrossRoad * 2) / (stripeCount - 1) : 0;
      const stripeHalfLength = 1.05;
      for (let i = 0; i < stripeCount; i++) {
        const offsetAcrossRoad = (i - (stripeCount - 1) / 2) * stripeSpacing;
        const sx = p.x + progressDirX * offsetAcrossRoad - stripeDirX * stripeHalfLength;
        const sy = p.y + progressDirY * offsetAcrossRoad - stripeDirY * stripeHalfLength;
        const ex = p.x + progressDirX * offsetAcrossRoad + stripeDirX * stripeHalfLength;
        const ey = p.y + progressDirY * offsetAcrossRoad + stripeDirY * stripeHalfLength;

        const [dLat1, dLng1] = fromLocalXY(sx - p.x, sy - p.y, refLat);
        const [dLat2, dLng2] = fromLocalXY(ex - p.x, ey - p.y, refLat);

        stripes.push({
          id: `${crossing.id}-stripe-${i}`,
          positions: [
            [crossing.lat + dLat1, crossing.lng + dLng1],
            [crossing.lat + dLat2, crossing.lng + dLng2]
          ]
        });
      }
    });

    return stripes;
  }, [state.edges, state.nodes]);

  const zebraScale = Math.max(0.45, Math.min(1, (currentZoom - 9) / 4));
  const zebraOuterWeight = Math.max(2.8, 6.2 * zebraScale);
  const zebraInnerWeight = Math.max(1.7, 4.2 * zebraScale);

  const simulationGraph = useMemo(
    () =>
      buildSimulationGraph(state, {
        canSpawnOnEdge: (edge) => !isIntersectionConnection(edge),
      }),
    [state],
  );

  const trafficLightNodes = useMemo(
    () =>
      (Object.values(state.nodes) as Node[])
        .filter((node) => node.type === 'traffic_light')
        .sort((a, b) => a.id.localeCompare(b.id)),
    [state.nodes],
  );

  const trafficLightRuntimeById = useMemo(() => {
    const runtimeById: Record<string, ReturnType<typeof getTrafficLightRuntimeState>> = {};
    trafficLightNodes.forEach((lightNode) => {
      runtimeById[lightNode.id] = getTrafficLightRuntimeState(
        trafficLightClockSec,
        lightNode.trafficLightControl ?? getDefaultTrafficLightControlConfig(),
      );
    });
    return runtimeById;
  }, [trafficLightClockSec, trafficLightNodes]);

  const { trafficLightApproachesById, trafficLightLocalFrameById } = useMemo(() => {
    const rawByLightId: Record<
      string,
      Array<{
        targetNodeId: string;
        directedEdgeId: string;
        distanceMeters: number;
      }>
    > = {};
    const localFrameByLightId: Record<string, TrafficLightLocalFrame> = {};
    const emptyApproachesByLightId: Record<string, TrafficLightApproachEntry[]> = {};
    trafficLightNodes.forEach((lightNode) => {
      rawByLightId[lightNode.id] = [];
      localFrameByLightId[lightNode.id] = getDefaultTrafficLightLocalFrame();
      emptyApproachesByLightId[lightNode.id] = [];
    });

    if (trafficLightNodes.length === 0) {
      return {
        trafficLightApproachesById: emptyApproachesByLightId,
        trafficLightLocalFrameById: localFrameByLightId,
      };
    }

    const directedEdges = Object.values(
      simulationGraph.directedEdges,
    ) as SimulationGraphRuntime['directedEdges'][string][];
    directedEdges.forEach((directedEdge) => {
      const baseEdge = state.edges[directedEdge.baseEdgeId];
      if (!baseEdge || isIntersectionConnection(baseEdge)) return;

      const targetNode = state.nodes[directedEdge.targetId];
      if (!targetNode || targetNode.type !== 'default') return;

      let nearestLight: { lightId: string; distanceMeters: number } | null = null;
      trafficLightNodes.forEach((lightNode) => {
        const candidateDistance = distanceMeters(lightNode, targetNode);
        if (candidateDistance > TRAFFIC_LIGHT_APPROACH_RADIUS_METERS) return;

        if (
          !nearestLight ||
          candidateDistance < nearestLight.distanceMeters ||
          (Math.abs(candidateDistance - nearestLight.distanceMeters) <= 1e-9 &&
            lightNode.id.localeCompare(nearestLight.lightId) < 0)
        ) {
          nearestLight = { lightId: lightNode.id, distanceMeters: candidateDistance };
        }
      });

      if (!nearestLight) return;

      rawByLightId[nearestLight.lightId].push({
        targetNodeId: targetNode.id,
        directedEdgeId: directedEdge.id,
        distanceMeters: nearestLight.distanceMeters,
      });
    });

    const nodeIds = new Set(Object.keys(state.nodes));
    const groupedByLightId: Record<string, TrafficLightApproachEntry[]> = {};

    trafficLightNodes.forEach((lightNode) => {
      const control = sanitizeTrafficLightControlConfig(
        lightNode.trafficLightControl ?? getDefaultTrafficLightControlConfig(),
        nodeIds,
      );
      const groupedByTargetNode = new Map<
        string,
        Omit<TrafficLightApproachEntry, 'autoSide' | 'effectiveSide' | 'isManual'>
      >();

      rawByLightId[lightNode.id].forEach((entry) => {
        const existing = groupedByTargetNode.get(entry.targetNodeId);
        if (existing) {
          existing.directedEdgeIds.push(entry.directedEdgeId);
          existing.distanceMeters = Math.min(existing.distanceMeters, entry.distanceMeters);
          return;
        }

        groupedByTargetNode.set(entry.targetNodeId, {
          targetNodeId: entry.targetNodeId,
          directedEdgeIds: [entry.directedEdgeId],
          distanceMeters: entry.distanceMeters,
        });
      });

      const groupedEntries = [...groupedByTargetNode.values()]
        .map((entry) => ({
          ...entry,
          directedEdgeIds: [...new Set(entry.directedEdgeIds)].sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => {
          const distanceCmp = a.distanceMeters - b.distanceMeters;
          if (Math.abs(distanceCmp) > 1e-9) return distanceCmp;
          return a.targetNodeId.localeCompare(b.targetNodeId);
        });

      const frameTargets = groupedEntries
        .map((entry) => state.nodes[entry.targetNodeId])
        .filter((targetNode): targetNode is Node => Boolean(targetNode));
      const localFrame = buildTrafficLightLocalFrame(lightNode, frameTargets);
      localFrameByLightId[lightNode.id] = localFrame;

      groupedByLightId[lightNode.id] = groupedEntries.map((entry) => {
        const targetNode = state.nodes[entry.targetNodeId];
        const autoSide = targetNode
          ? deriveTrafficLightApproachSide(lightNode, targetNode, localFrame)
          : 'north';
        const manualSide = control.approachSideOverrides[entry.targetNodeId];
        return {
          ...entry,
          autoSide,
          effectiveSide: manualSide ?? autoSide,
          isManual: Boolean(manualSide),
        };
      });
    });

    return {
      trafficLightApproachesById: groupedByLightId,
      trafficLightLocalFrameById: localFrameByLightId,
    };
  }, [simulationGraph.directedEdges, state.edges, state.nodes, trafficLightNodes]);

  const blockedSimulationEdgeIds = useMemo(() => {
    const blocked = new Set<string>();

    trafficLightNodes.forEach((lightNode) => {
      const runtime = trafficLightRuntimeById[lightNode.id];
      if (!runtime) return;

      const approaches = trafficLightApproachesById[lightNode.id] ?? [];
      approaches.forEach((approach) => {
        const sideColor = runtime.colorsBySide[approach.effectiveSide];
        if (!TRAFFIC_LIGHT_BLOCKING_COLORS.has(sideColor)) return;
        approach.directedEdgeIds.forEach((directedEdgeId) => {
          blocked.add(directedEdgeId);
        });
      });
    });

    return blocked;
  }, [trafficLightApproachesById, trafficLightNodes, trafficLightRuntimeById]);

  useEffect(() => {
    blockedSimulationEdgesRef.current = blockedSimulationEdgeIds;
  }, [blockedSimulationEdgeIds]);

  const selectedTrafficLightControl = useMemo(() => {
    if (!selectedTrafficLight) return null;
    return sanitizeTrafficLightControlConfig(
      selectedTrafficLight.trafficLightControl ?? getDefaultTrafficLightControlConfig(),
      new Set(Object.keys(state.nodes)),
    );
  }, [selectedTrafficLight, state.nodes]);

  const selectedTrafficLightRuntime = selectedTrafficLight
    ? trafficLightRuntimeById[selectedTrafficLight.id]
    : null;
  const selectedTrafficLightApproaches = selectedTrafficLight
    ? trafficLightApproachesById[selectedTrafficLight.id] ?? []
    : [];

  const carDirectionAngles = useMemo(() => {
    const angles: Record<string, number> = {};
    cars.forEach((car) => {
      angles[car.id] = getCarDirectionAngle(car, simulationGraph);
    });
    return angles;
  }, [cars, simulationGraph]);

  useEffect(() => {
    setCars((prevCars) =>
      reconcileCars({
        cars: prevCars,
        targetCount: targetCarCount,
        graph: simulationGraph,
        createCarId: () => uuidv4(),
      }),
    );
  }, [simulationGraph, targetCarCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (simulationRafRef.current !== null) {
      window.cancelAnimationFrame(simulationRafRef.current);
      simulationRafRef.current = null;
    }
    simulationLastTsRef.current = null;

    if (targetCarCount <= 0 || simulationGraph.edgeIds.length === 0 || cars.length === 0) return;

    const animate = (timestamp: number) => {
      if (simulationLastTsRef.current === null) {
        simulationLastTsRef.current = timestamp;
        simulationRafRef.current = window.requestAnimationFrame(animate);
        return;
      }

      const dtSeconds = Math.min(
        0.25,
        Math.max(0, (timestamp - simulationLastTsRef.current) / 1000),
      );
      simulationLastTsRef.current = timestamp;

      if (dtSeconds > 0) {
        setCars((prevCars) =>
          prevCars
            .map((car) =>
              advanceCar({
                car,
                graph: simulationGraph,
                dtSeconds,
                canLeaveEdge: (edge) => !blockedSimulationEdgesRef.current.has(edge.id),
              }),
            )
            .filter((car): car is CarState => Boolean(car)),
        );
      }

      simulationRafRef.current = window.requestAnimationFrame(animate);
    };

    simulationRafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (simulationRafRef.current !== null) {
        window.cancelAnimationFrame(simulationRafRef.current);
        simulationRafRef.current = null;
      }
      simulationLastTsRef.current = null;
    };
  }, [cars.length, simulationGraph, targetCarCount]);
  
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (mode === 'ADD_SPEED_LIMIT') {
      setSpeedLimitDialogPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      setSpeedLimitInput('40');
      setSpeedLimitInputError('');
      return;
    }

    if (['ADD_NODE', 'ADD_TRAFFIC_LIGHT', 'ADD_CROSSING', 'ADD_BUS_STOP'].includes(mode)) {
      let type: NodeType = 'default';
      if (mode === 'ADD_TRAFFIC_LIGHT') type = 'traffic_light';
      if (mode === 'ADD_CROSSING') type = 'crossing';
      if (mode === 'ADD_BUS_STOP') type = 'bus_stop';
      
      const newNode: Node = {
        id: uuidv4(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        type
      };
      pushState({
        ...state,
        nodes: { ...state.nodes, [newNode.id]: newNode }
      });
    } else if (mode === 'SELECT') {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  };

  const closeSpeedLimitDialog = () => {
    setSpeedLimitDialogPosition(null);
    setSpeedLimitInputError('');
  };

  const confirmSpeedLimitDialog = () => {
    if (!speedLimitDialogPosition) return;
    const parsed = Number.parseInt(speedLimitInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSpeedLimitInputError('Введите корректное положительное целое число (км/ч).');
      return;
    }

    const speedLimit = Math.min(200, Math.max(5, parsed));
    const newNode: Node = {
      id: uuidv4(),
      lat: speedLimitDialogPosition.lat,
      lng: speedLimitDialogPosition.lng,
      type: 'speed_limit',
      speedLimit,
      name: `Ограничение скорости ${speedLimit}`
    };

    pushState({
      ...state,
      nodes: { ...state.nodes, [newNode.id]: newNode }
    });
    closeSpeedLimitDialog();
  };
  
  const handleNodeClick = (id: string, e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();

    if (mode === 'DELETE') {
      const newNodes = { ...state.nodes };
      delete newNodes[id];

      const newEdges = { ...state.edges };
      Object.keys(newEdges).forEach(edgeId => {
        if (newEdges[edgeId].sourceId === id || newEdges[edgeId].targetId === id) {
          delete newEdges[edgeId];
        }
      });

      pushState({ nodes: newNodes, edges: newEdges });
      if (selectedNodeId === id) setSelectedNodeId(null);
    } else if (mode === 'SELECT') {
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
    } else if (mode === 'ADD_EDGE') {
      if (!selectedNodeId) {
        setSelectedNodeId(id);
      } else if (selectedNodeId !== id) {
        const newEdge: Edge = {
          id: uuidv4(),
          sourceId: selectedNodeId,
          targetId: id,
          points: [],
          isOneWay: true, // Lanes are one-way by default
          crossroad: false,
          busStop: false,
          speedLimit: DEFAULT_SPEED_LIMIT,
          laneWidth: DEFAULT_LANE_WIDTH,
          turnRadius: DEFAULT_TURN_RADIUS,
          pedestrianIntensity: DEFAULT_PEDESTRIAN_INTENSITY,
          pedestrianIntensityMode: 'auto',
          roadSlope: DEFAULT_ROAD_SLOPE,
          parkingType: DEFAULT_PARKING_TYPE,
          stopType: DEFAULT_STOP_TYPE,
          stopTypeMode: 'auto',
          maneuverType: DEFAULT_MANEUVER_TYPE,
          turnPercentage: DEFAULT_TURN_PERCENTAGE,
        };
        pushState({
          ...state,
          edges: { ...state.edges, [newEdge.id]: newEdge }
        });
        setSelectedNodeId(null);
      }
    }
  };

  const handleNodeRightClick = (id: string, e: L.LeafletMouseEvent) => {
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const newNodes = { ...state.nodes };
    delete newNodes[id];

    const newEdges = { ...state.edges };
    Object.keys(newEdges).forEach(edgeId => {
      if (newEdges[edgeId].sourceId === id || newEdges[edgeId].targetId === id) {
        delete newEdges[edgeId];
      }
    });

    pushState({ nodes: newNodes, edges: newEdges });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };
  
  const handleNodeDragEnd = (id: string, e: L.DragEndEvent) => {
    const marker = e.target;
    const position = marker.getLatLng();
    pushState({
      ...state,
      nodes: {
        ...state.nodes,
        [id]: { ...state.nodes[id], lat: position.lat, lng: position.lng }
      }
    });
  };
  
  const handleEdgeClick = (id: string, e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    if (mode === 'DELETE') {
      const newEdges = { ...state.edges };
      delete newEdges[id];
      pushState({ ...state, edges: newEdges });
      if (selectedEdgeId === id) setSelectedEdgeId(null);
    } else {
      setSelectedEdgeId(id);
      if (mode === 'SELECT') setSelectedNodeId(null);
    }
  };
  
  const handleEdgeRightClick = (edgeId: string, e: L.LeafletMouseEvent) => {
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const newEdges = { ...state.edges };
    delete newEdges[edgeId];
    pushState({ ...state, edges: newEdges });
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  };
  
  const handlePointDragEnd = (edgeId: string, pointIndex: number, e: L.DragEndEvent) => {
    const marker = e.target;
    const position = marker.getLatLng();
    const edge = state.edges[edgeId];
    const newPoints = [...edge.points];
    newPoints[pointIndex] = { lat: position.lat, lng: position.lng };
    
    pushState({
      ...state,
      edges: {
        ...state.edges,
        [edgeId]: { ...edge, points: newPoints }
      }
    });
  };
  
  const handlePointClick = (edgeId: string, pointIndex: number, e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    if (mode === 'DELETE') {
      const edge = state.edges[edgeId];
      const newPoints = edge.points.filter((_, i) => i !== pointIndex);
      pushState({
        ...state,
        edges: {
          ...state.edges,
          [edgeId]: { ...edge, points: newPoints }
        }
      });
    }
  };

  const handlePointRightClick = (edgeId: string, pointIndex: number, e: L.LeafletMouseEvent) => {
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const edge = state.edges[edgeId];
    const newPoints = edge.points.filter((_, i) => i !== pointIndex);
    pushState({
      ...state,
      edges: {
        ...state.edges,
        [edgeId]: { ...edge, points: newPoints }
      }
    });
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsedState = parseOSM(content);
        pushState(parsedState);
        
        // Calculate center of imported nodes
        const nodes = Object.values(parsedState.nodes);
        if (nodes.length > 0) {
          const avgLat = nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length;
          const avgLng = nodes.reduce((sum, n) => sum + n.lng, 0) / nodes.length;
          setMapCenter([avgLat, avgLng]);
        }
      } catch (err) {
        alert("Ошибка при разборе OSM-файла");
      }
    };
    reader.readAsText(file);
  };
  
  const runValidation = () => {
    const result = validateNetwork(state);
    setValidationResult(result);
  };

  const makeExportFileStamp = () => new Date().toISOString().replace(/[:.]/g, '-');

  const exportJson = () => {
    const payload = buildLaneNetworkJsonExport(state);
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `lane-network-${makeExportFileStamp()}.json`,
      'application/json;charset=utf-8',
    );
  };

  const exportOsm = () => {
    const xml = buildLaneNetworkOsmExport(state);
    downloadTextFile(
      xml,
      `lane-network-${makeExportFileStamp()}.osm`,
      'application/xml;charset=utf-8',
    );
  };
  
  const parseFloatSafe = (value: string): number | null => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseIntSafe = (value: string): number | null => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatCoefficient = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '-';

  const formatCapacity = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-';

  const formatSpeed = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-';

  const updateSelectedTrafficLightControl = useCallback(
    (
      updater: (
        control: ReturnType<typeof getDefaultTrafficLightControlConfig>,
      ) => ReturnType<typeof getDefaultTrafficLightControlConfig>,
    ) => {
      if (!selectedTrafficLight) return;
      updateTrafficLightControl(selectedTrafficLight.id, updater);
    },
    [selectedTrafficLight, updateTrafficLightControl],
  );

  const updateSelectedTrafficLightTiming = useCallback(
    (key: keyof ReturnType<typeof getDefaultTrafficLightControlConfig>['timings'], value: string) => {
      const parsed = parseFloatSafe(value);
      if (parsed === null) return;
      updateSelectedTrafficLightControl((control) => ({
        ...control,
        timings: {
          ...control.timings,
          [key]: parsed,
        },
      }));
    },
    [updateSelectedTrafficLightControl],
  );

  const updateSelectedTrafficLightOffset = useCallback(
    (value: string) => {
      const parsed = parseFloatSafe(value);
      if (parsed === null) return;
      updateSelectedTrafficLightControl((control) => ({
        ...control,
        cycleOffsetSec: parsed,
      }));
    },
    [updateSelectedTrafficLightControl],
  );

  const setSelectedTrafficLightApproachOverride = useCallback(
    (targetNodeId: string, side: TrafficLightSide | null) => {
      updateSelectedTrafficLightControl((control) => {
        const nextOverrides = { ...control.approachSideOverrides };
        if (!side) {
          delete nextOverrides[targetNodeId];
        } else {
          nextOverrides[targetNodeId] = side;
        }
        return {
          ...control,
          approachSideOverrides: nextOverrides,
        };
      });
    },
    [updateSelectedTrafficLightControl],
  );

  const updateSelectedEdge = useCallback(
    (updater: (edge: Edge) => Edge) => {
      if (!selectedEdgeId) return;
      updateEdgeById(selectedEdgeId, updater);
    },
    [selectedEdgeId, updateEdgeById],
  );

  const toggleOneWay = (edgeId: string) => {
    updateEdgeById(edgeId, (edge) => ({ ...edge, isOneWay: !edge.isOneWay }));
  };

  const handleCarCountInputChange = (value: string) => {
    setCarCountInput(value);
    if (carInputError) setCarInputError('');
  };

  const applyCarCount = () => {
    const parsed = Number.parseInt(carCountInput.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      setCarInputError('Введите целое число от 1 до 100.');
      return;
    }

    setCarInputError('');
    setTargetCarCount(parsed);
  };

  const clearCars = () => {
    setCars([]);
    setTargetCarCount(0);
    setCarInputError('');
  };
  
  const MapEvents = () => {
    useMapEvents({
      click: handleMapClick,
      zoomend: (e) => setCurrentZoom((e.target as L.Map).getZoom()),
    });
    return null;
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans">
      <Sidebar 
        mode={mode} 
        setMode={setMode}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
        undo={undo}
        redo={redo}
        onFileUpload={handleFileUpload}
        onExportJson={exportJson}
        onExportOsm={exportOsm}
        onValidate={runValidation}
        validationResult={validationResult}
        carCountInput={carCountInput}
        onCarCountInputChange={handleCarCountInputChange}
        onApplyCarCount={applyCarCount}
        onClearCars={clearCars}
        activeCarCount={cars.length}
        carCountError={carInputError}
        coefficientSummary={coefficientSummary}
      />
      
      <div className="flex-1 relative">
        <MapContainer 
          center={[55.7558, 37.6173]} 
          zoom={13}
          maxZoom={22}
          attributionControl={false}
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> и участники проекта'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={22}
          />
          <MapCenterer center={mapCenter} />
          <MapEvents />
          
          {(Object.values(state.edges) as Edge[]).map(edge => {
            const source = state.nodes[edge.sourceId];
            const target = state.nodes[edge.targetId];
            if (!source || !target) return null;
            
            const hasCrossing = edge.crossroad;
            const hasBusStop = edge.busStop;
            const hasNearby = hasCrossing || hasBusStop;
            
            const positions: [number, number][] = [
              [source.lat, source.lng],
              ...edge.points.map(p => [p.lat, p.lng] as [number, number]),
              [target.lat, target.lng]
            ];
            
            const isSelected = selectedEdgeId === edge.id;
            const isIntersectionConnectionEdge = isIntersectionConnection(edge);
            const speedLimit = edge.speedLimit;
            const edgeMetrics = coefficientSummary.edgeMetrics[edge.id];

            if (isIntersectionConnectionEdge) {
              return (
                <React.Fragment key={edge.id}>
                  <Polyline
                    positions={positions}
                    color="#0f172a"
                    weight={4}
                    opacity={0.18}
                    pathOptions={{ interactive: false }}
                  />
                  <Polyline
                    positions={positions}
                    color="#06b6d4"
                    weight={2}
                    opacity={0.9}
                    pathOptions={{
                      dashArray: '5, 7',
                      interactive: false,
                    }}
                  />
                </React.Fragment>
              );
            }
            
            return (
              <React.Fragment key={edge.id}>
                <Polyline
                  positions={positions}
                  color="transparent"
                  weight={isSelected ? 22 : 18}
                  opacity={0}
                  eventHandlers={{
                    click: (e) => handleEdgeClick(edge.id, e),
                    contextmenu: (e) => handleEdgeRightClick(edge.id, e)
                  }}
                  pathOptions={{
                    interactive: true
                  }}
                />
                <Polyline
                  positions={positions}
                  color={isSelected ? '#3b82f6' : (hasNearby ? '#f59e0b' : '#4b5563')}
                  weight={isSelected ? 6 : (hasNearby ? 5 : 3)}
                  opacity={0.8}
                  eventHandlers={{
                    click: (e) => handleEdgeClick(edge.id, e),
                    contextmenu: (e) => handleEdgeRightClick(edge.id, e)
                  }}
                  pathOptions={{
                    dashArray: edge.isOneWay ? '10, 10' : undefined
                  }}
                >
                  <Tooltip sticky direction="center">
                    <div className="font-bold">{edge.name || 'Edge'}</div>
                    <div className="text-xs text-gray-700 font-medium">Speed limit: {speedLimit} km/h</div>
                    <div className="text-xs text-gray-700">Lane width: {edge.laneWidth} m</div>
                    <div className="text-xs text-gray-700">Turn radius: {edge.turnRadius} m</div>
                    <div className="text-xs text-gray-700">Slope: {edge.roadSlope}</div>
                    <div className="text-xs text-gray-700">Parking type: {edge.parkingType}</div>
                    <div className="text-xs text-gray-700">Maneuver type: {edge.maneuverType}</div>
                    <div className="text-xs text-gray-700">Turn percentage: {edge.turnPercentage}</div>
                    <div className="text-xs text-gray-700">Pedestrian intensity: {edge.pedestrianIntensity} (mode: {edge.pedestrianIntensityMode})</div>
                    <div className="text-xs text-gray-700">Stop type: {edge.stopType} (mode: {edge.stopTypeMode})</div>
                    {edgeMetrics && (
                      <div className="mt-1 rounded border border-gray-200 bg-gray-50 p-1.5">
                        <div className="text-[11px] font-semibold text-gray-700">Coefficients</div>
                        <div className="text-[11px] text-gray-700">
                          width {formatCoefficient(edgeMetrics.coefficients.width)} | speed {formatCoefficient(edgeMetrics.coefficients.speed)} | radius {formatCoefficient(edgeMetrics.coefficients.radius)}
                        </div>
                        <div className="text-[11px] text-gray-700">
                          crosswalk {formatCoefficient(edgeMetrics.coefficients.crosswalk)} | slope {formatCoefficient(edgeMetrics.coefficients.slope)}
                        </div>
                        <div className="text-[11px] text-gray-700">
                          parking {formatCoefficient(edgeMetrics.coefficients.parking)} | stop {formatCoefficient(edgeMetrics.coefficients.busStop)} | maneuver {formatCoefficient(edgeMetrics.coefficients.maneuver)}
                        </div>
                        <div className="text-[11px] font-semibold text-gray-800">
                          total {formatCoefficient(edgeMetrics.totalCoefficient)} | capacity {formatCapacity(edgeMetrics.finalCapacity)} / {MAX_EDGE_CAPACITY}
                        </div>
                        <div className="text-[11px] font-semibold text-gray-800">
                          final speed {formatSpeed(edgeMetrics.finalSpeed)} km/h
                        </div>
                      </div>
                    )}
                    <div className={`text-xs font-medium ${hasCrossing ? 'text-amber-700' : 'text-gray-700'}`}>
                      Crossing nearby: {hasCrossing ? 'yes (10 m)' : 'no'}
                    </div>
                    <div className={`text-xs font-medium ${hasBusStop ? 'text-blue-700' : 'text-gray-700'}`}>
                      Bus stop nearby: {hasBusStop ? 'yes (15 m)' : 'no'}
                    </div>
                    {edge.tags && Object.entries(edge.tags).map(([k, v]) => (
                      <div key={k} className="text-xs">{k}: {v}</div>
                    ))}
                  </Tooltip>
                </Polyline>
                
                {isSelected && edge.points.map((point, idx) => (
                  <Marker
                    key={`${edge.id}-p-${idx}`}
                    position={[point.lat, point.lng]}
                    draggable={mode === 'SELECT'}
                    icon={L.divIcon({
                      className: 'custom-point-icon',
                      html: '<div style="background-color: #f59e0b; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div>',
                      iconSize: [10, 10],
                      iconAnchor: [5, 5]
                    })}
                    eventHandlers={{
                      dragend: (e) => handlePointDragEnd(edge.id, idx, e),
                      click: (e) => handlePointClick(edge.id, idx, e),
                      contextmenu: (e) => handlePointRightClick(edge.id, idx, e)
                    }}
                  />
                ))}
              </React.Fragment>
            );
          })}

          <Pane name="zebra-overlay-pane" style={{ zIndex: 620 }}>
            {crossingZebraStripes.map(stripe => (
              <React.Fragment key={stripe.id}>
                <Polyline
                  positions={stripe.positions}
                  color="#111827"
                  weight={zebraOuterWeight}
                  opacity={0.9}
                  pathOptions={{ interactive: false }}
                />
                <Polyline
                  positions={stripe.positions}
                  color="#ffffff"
                  weight={zebraInnerWeight}
                  opacity={1}
                  pathOptions={{ interactive: false }}
                />
              </React.Fragment>
            ))}
          </Pane>

          <Pane name="vehicle-overlay-pane" style={{ zIndex: 710 }}>
            {cars.map((car) => (
              <Marker
                key={car.id}
                position={[car.lat, car.lng]}
                icon={getCarIcon(carDirectionAngles[car.id] ?? 0)}
                interactive={false}
                keyboard={false}
              />
            ))}
          </Pane>
          
          {(Object.values(state.nodes) as Node[]).map(node => (
            <React.Fragment key={node.id}>
              <Marker
                position={[node.lat, node.lng]}
                draggable={mode === 'SELECT'}
                icon={getIconForNode(node, selectedNodeId === node.id)}
                zIndexOffset={node.type && node.type !== 'default' ? 2000 : 0}
                eventHandlers={{
                  click: (e) => handleNodeClick(node.id, e),
                  contextmenu: (e) => handleNodeRightClick(node.id, e),
                  dragend: (e) => handleNodeDragEnd(node.id, e)
                }}
              >
                {node.name && <Tooltip>{node.name}</Tooltip>}
              </Marker>

              {node.type === 'traffic_light' && trafficLightRuntimeById[node.id] && (
                <>
                  {TRAFFIC_LIGHT_SIDE_ORDER.map((side) => {
                    const localFrame =
                      trafficLightLocalFrameById[node.id] ?? getDefaultTrafficLightLocalFrame();
                    const sideVector = getTrafficLightSideUnitVector(localFrame, side);
                    const northOffset = sideVector.northMeters * TRAFFIC_LIGHT_INDICATOR_OFFSET_METERS;
                    const eastOffset = sideVector.eastMeters * TRAFFIC_LIGHT_INDICATOR_OFFSET_METERS;
                    const [lat, lng] = offsetLatLngByMeters(node.lat, node.lng, northOffset, eastOffset);
                    const sideColor = trafficLightRuntimeById[node.id].colorsBySide[side];
                    const fillColor = TRAFFIC_LIGHT_COLOR_HEX[sideColor];

                    return (
                      <CircleMarker
                        key={`${node.id}-tl-side-${side}`}
                        center={[lat, lng]}
                        radius={TRAFFIC_LIGHT_INDICATOR_RADIUS_PX}
                        pathOptions={{
                          color: '#111827',
                          weight: 1,
                          fillColor,
                          fillOpacity: 1,
                        }}
                        interactive={false}
                        keyboard={false}
                      >
                        <Tooltip direction="top" opacity={0.95}>
                          {TRAFFIC_LIGHT_SIDE_LABELS[side]}: {sideColor}
                        </Tooltip>
                      </CircleMarker>
                    );
                  })}
                </>
              )}

              {node.type === 'default' && nodeDirectionAngles[node.id] !== undefined && (
                <Marker
                  position={[node.lat, node.lng]}
                  icon={getDirectionArrowIcon(nodeDirectionAngles[node.id], currentZoom)}
                  zIndexOffset={-100}
                  interactive={false}
                  keyboard={false}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
        
        <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000] pointer-events-none">
          <p className="text-sm font-medium text-gray-700">
            {mode === 'SELECT' && "Кликните по узлам/рёбрам для выбора. Перетаскивайте для перемещения. ПКМ по объекту - удалить."}
            {mode === 'ADD_NODE' && "Кликните по карте, чтобы добавить узел полосы."}
            {mode === 'ADD_TRAFFIC_LIGHT' && "Кликните по карте, чтобы добавить светофор."}
            {mode === 'ADD_SPEED_LIMIT' && "Кликните по карте, чтобы поставить знак ограничения, затем введите км/ч в окне."}
            {mode === 'ADD_EDGE' && "Кликните по одному узлу, затем по другому, чтобы соединить их."}
            {mode === 'DELETE' && "Кликните по узлам/рёбрам/точкам, чтобы удалить."}
          </p>
        </div>

        {selectedTrafficLight && selectedTrafficLightControl && selectedTrafficLightRuntime && (
          <div className="absolute top-4 left-4 z-[1110] w-[min(92vw,420px)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-emerald-200 bg-white/95 shadow-xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-emerald-900">Параметры светофора</h3>
                <p className="text-xs text-emerald-800">{selectedTrafficLight.name || selectedTrafficLight.id}</p>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="h-7 w-7 rounded-md border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100"
                aria-label="Close traffic light editor"
                title="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">A green, c</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={selectedTrafficLightControl.timings.nsGreenSec}
                    onChange={(e) => updateSelectedTrafficLightTiming('nsGreenSec', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">A yellow, c</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={selectedTrafficLightControl.timings.nsYellowSec}
                    onChange={(e) => updateSelectedTrafficLightTiming('nsYellowSec', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">B green, c</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={selectedTrafficLightControl.timings.ewGreenSec}
                    onChange={(e) => updateSelectedTrafficLightTiming('ewGreenSec', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">B yellow, c</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={selectedTrafficLightControl.timings.ewYellowSec}
                    onChange={(e) => updateSelectedTrafficLightTiming('ewYellowSec', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">All-red, c</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={selectedTrafficLightControl.timings.allRedSec}
                    onChange={(e) => updateSelectedTrafficLightTiming('allRedSec', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Cycle offset, c</span>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedTrafficLightControl.cycleOffsetSec}
                    onChange={(e) => updateSelectedTrafficLightOffset(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                  />
                </label>
              </div>

              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5">
                <p className="text-xs font-semibold text-emerald-900">
                  Фаза: {TRAFFIC_LIGHT_PHASE_LABELS[selectedTrafficLightRuntime.phase]}
                </p>
                <p className="mt-1 text-xs text-emerald-900">
                  До переключения: {selectedTrafficLightRuntime.phaseRemainingSec.toFixed(1)} c
                </p>
                <p className="mt-1 text-xs text-emerald-900">
                  Длина цикла: {selectedTrafficLightRuntime.cycleLengthSec.toFixed(1)} c
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {TRAFFIC_LIGHT_SIDE_ORDER.map((side) => {
                    const sideColor = selectedTrafficLightRuntime.colorsBySide[side];
                    return (
                      <span key={side} className="inline-flex items-center rounded border border-emerald-200 bg-white px-2 py-0.5 text-emerald-900">
                        <span
                          className="mr-1 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: TRAFFIC_LIGHT_COLOR_HEX[sideColor] }}
                        />
                        {TRAFFIC_LIGHT_SIDE_LABELS[side]}: {sideColor}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-2.5">
                <p className="mb-2 text-xs font-semibold text-gray-700">Подъезды (auto/manual)</p>
                {selectedTrafficLightApproaches.length === 0 ? (
                  <p className="text-xs text-gray-500">Нет подъездов в радиусе 25 м.</p>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-1 pr-2 font-medium">Узел</th>
                          <th className="pb-1 pr-2 font-medium">Auto</th>
                          <th className="pb-1 pr-2 font-medium">Effective</th>
                          <th className="pb-1 pr-2 font-medium">Mode</th>
                          <th className="pb-1 font-medium">Сторона</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTrafficLightApproaches.map((approach) => {
                          const sideColor = selectedTrafficLightRuntime.colorsBySide[approach.effectiveSide];
                          return (
                            <tr key={approach.targetNodeId} className="border-t border-gray-100">
                              <td className="py-1 pr-2 text-gray-800">
                                <div>{approach.targetNodeId}</div>
                                <div className="text-gray-500">{approach.distanceMeters.toFixed(1)} м</div>
                              </td>
                              <td className="py-1 pr-2 text-gray-700">{TRAFFIC_LIGHT_SIDE_LABELS[approach.autoSide]}</td>
                              <td className="py-1 pr-2 text-gray-700">
                                {TRAFFIC_LIGHT_SIDE_LABELS[approach.effectiveSide]}{' '}
                                <span
                                  className="inline-block h-2 w-2 rounded-full align-middle"
                                  style={{ backgroundColor: TRAFFIC_LIGHT_COLOR_HEX[sideColor] }}
                                />
                              </td>
                              <td className="py-1 pr-2 text-gray-700">{approach.isManual ? 'manual' : 'auto'}</td>
                              <td className="py-1">
                                <select
                                  value={approach.isManual ? approach.effectiveSide : 'auto'}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'auto') {
                                      setSelectedTrafficLightApproachOverride(approach.targetNodeId, null);
                                      return;
                                    }
                                    if (!isTrafficLightSideValue(value)) return;
                                    setSelectedTrafficLightApproachOverride(approach.targetNodeId, value);
                                  }}
                                  className="w-full rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-800"
                                >
                                  <option value="auto">auto</option>
                                  <option value="north">A+</option>
                                  <option value="east">B+</option>
                                  <option value="south">A-</option>
                                  <option value="west">B-</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedEdge && !isIntersectionConnection(selectedEdge) && (
          <div className="absolute top-4 left-4 z-[1100] w-[min(92vw,420px)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-blue-200 bg-white/95 shadow-xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">Параметры ребра</h3>
                <p className="text-xs text-blue-800">{selectedEdge.name || selectedEdge.id}</p>
              </div>
              <button
                onClick={() => setSelectedEdgeId(null)}
                className="h-7 w-7 rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
                aria-label="Close edge editor"
                title="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 p-4 text-sm">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedEdge.isOneWay}
                  onChange={() => toggleOneWay(selectedEdge.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Односторонняя полоса
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Ограничение скорости, км/ч (auto)</span>
                <input
                  type="number"
                  value={selectedEdge.speedLimit}
                  readOnly
                  className="w-full rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 text-gray-700"
                />
              </label>

              <div className="rounded-md border border-gray-200 bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-medium text-gray-700">
                  Пешеходный переход рядом: {selectedEdge.crossroad ? 'да (10 м)' : 'нет'}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-700">
                  Автобусная остановка рядом: {selectedEdge.busStop ? 'да (15 м)' : 'нет'}
                </p>
                {selectedEdge.tags && Object.entries(selectedEdge.tags).length > 0 && (
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <p className="mb-1 text-xs font-semibold text-slate-700">Теги ребра:</p>
                    <div className="max-h-24 overflow-auto pr-1">
                      {Object.entries(selectedEdge.tags).map(([k, v]) => (
                        <p key={k} className="text-[11px] text-slate-700">
                          {k}: {v}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Ширина полосы, м</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={selectedEdge.laneWidth}
                  onChange={(e) => {
                    const parsed = parseFloatSafe(e.target.value);
                    if (parsed === null || parsed <= 0) return;
                    updateSelectedEdge((edge) => ({ ...edge, laneWidth: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Радиус поворота, м</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={selectedEdge.turnRadius}
                  onChange={(e) => {
                    const parsed = parseFloatSafe(e.target.value);
                    if (parsed === null || parsed < 0) return;
                    updateSelectedEdge((edge) => ({ ...edge, turnRadius: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Уклон дороги</span>
                <input
                  type="number"
                  step={0.1}
                  value={selectedEdge.roadSlope}
                  onChange={(e) => {
                    const parsed = parseFloatSafe(e.target.value);
                    if (parsed === null) return;
                    updateSelectedEdge((edge) => ({ ...edge, roadSlope: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Тип парковки</span>
                <select
                  value={selectedEdge.parkingType}
                  onChange={(e) => {
                    const parsed = parseIntSafe(e.target.value);
                    if (parsed !== 1 && parsed !== 2 && parsed !== 3) return;
                    updateSelectedEdge((edge) => ({ ...edge, parkingType: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Тип маневра</span>
                <select
                  value={selectedEdge.maneuverType}
                  onChange={(e) => {
                    const parsed = parseIntSafe(e.target.value);
                    if (parsed !== 1 && parsed !== 2 && parsed !== 3 && parsed !== 4 && parsed !== 5) return;
                    updateSelectedEdge((edge) => ({ ...edge, maneuverType: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Доля поворачивающих (0.2 или 20)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={selectedEdge.turnPercentage}
                  onChange={(e) => {
                    const parsed = parseFloatSafe(e.target.value);
                    if (parsed === null || parsed < 0) return;
                    updateSelectedEdge((edge) => ({ ...edge, turnPercentage: parsed }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Нормализовано для формулы: {selectedEdgeMetrics ? `${(selectedEdgeMetrics.normalizedTurnPercentage * 100).toFixed(1)}%` : '-'}
                </p>
              </label>

              <div className="rounded-md border border-gray-200 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Интенсивность пешеходов, чел/ч</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        updateSelectedEdge((edge) => ({
                          ...edge,
                          pedestrianIntensityMode: 'auto',
                        }))
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        selectedEdge.pedestrianIntensityMode === 'auto'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      auto
                    </button>
                    <button
                      onClick={() =>
                        updateSelectedEdge((edge) => ({
                          ...edge,
                          pedestrianIntensityMode: 'manual',
                        }))
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        selectedEdge.pedestrianIntensityMode === 'manual'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      manual
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={selectedEdge.pedestrianIntensity}
                  onChange={(e) => {
                    const parsed = parseIntSafe(e.target.value);
                    if (parsed === null || parsed < 0) return;
                    updateSelectedEdge((edge) => ({
                      ...edge,
                      pedestrianIntensity: parsed,
                      pedestrianIntensityMode: 'manual',
                    }));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-gray-800"
                />
              </div>

              <div className="rounded-md border border-gray-200 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Тип остановки</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        updateSelectedEdge((edge) => ({
                          ...edge,
                          stopTypeMode: 'auto',
                        }))
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        selectedEdge.stopTypeMode === 'auto'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      auto
                    </button>
                    <button
                      onClick={() =>
                        updateSelectedEdge((edge) => ({
                          ...edge,
                          stopTypeMode: 'manual',
                        }))
                      }
                      className={`rounded px-2 py-1 text-xs ${
                        selectedEdge.stopTypeMode === 'manual'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      manual
                    </button>
                  </div>
                </div>
                <select
                  value={selectedEdge.stopType}
                  onChange={(e) => {
                    const parsed = parseIntSafe(e.target.value);
                    if (parsed !== 1 && parsed !== 2 && parsed !== 3) return;
                    updateSelectedEdge((edge) => ({
                      ...edge,
                      stopType: parsed,
                      stopTypeMode: 'manual',
                    }));
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>

              {selectedEdgeMetrics && (
                <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5">
                  <p className="mb-2 text-xs font-semibold text-blue-900">Коэффициенты (py_code)</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-blue-900">
                    <span>Ширина: {formatCoefficient(selectedEdgeMetrics.coefficients.width)}</span>
                    <span>Скорость: {formatCoefficient(selectedEdgeMetrics.coefficients.speed)}</span>
                    <span>Радиус: {formatCoefficient(selectedEdgeMetrics.coefficients.radius)}</span>
                    <span>Переход: {formatCoefficient(selectedEdgeMetrics.coefficients.crosswalk)}</span>
                    <span>Уклон: {formatCoefficient(selectedEdgeMetrics.coefficients.slope)}</span>
                    <span>Парковка: {formatCoefficient(selectedEdgeMetrics.coefficients.parking)}</span>
                    <span>Остановка: {formatCoefficient(selectedEdgeMetrics.coefficients.busStop)}</span>
                    <span>Манёвр: {formatCoefficient(selectedEdgeMetrics.coefficients.maneuver)}</span>
                  </div>
                  <div className="mt-2 border-t border-blue-200 pt-2 text-xs font-semibold text-blue-950">
                    <div>Общий коэффициент: {formatCoefficient(selectedEdgeMetrics.totalCoefficient)}</div>
                    <div>
                      Итоговая пропускная способность: {formatCapacity(selectedEdgeMetrics.finalCapacity)} / {MAX_EDGE_CAPACITY}
                    </div>
                    <div>Итоговая скорость: {formatSpeed(selectedEdgeMetrics.finalSpeed)} км/ч</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {speedLimitDialogPosition && (
          <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-black/30">
            <div className="w-[min(92vw,380px)] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
                <h3 className="text-base font-semibold text-gray-900">Задать ограничение скорости</h3>
                <p className="text-xs text-gray-500 mt-1">Введите допустимую скорость для этого знака (км/ч)</p>
              </div>

              <div className="p-5">
                <label className="block text-xs font-medium text-gray-600 mb-2">Скорость (км/ч)</label>
                <input
                  autoFocus
                  type="number"
                  min={5}
                  max={200}
                  step={1}
                  value={speedLimitInput}
                  onChange={(e) => {
                    setSpeedLimitInput(e.target.value);
                    if (speedLimitInputError) setSpeedLimitInputError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmSpeedLimitDialog();
                    if (e.key === 'Escape') closeSpeedLimitDialog();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                  placeholder="например, 40"
                />
                {speedLimitInputError && (
                  <p className="mt-2 text-xs text-red-600">{speedLimitInputError}</p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={closeSpeedLimitDialog}
                    className="px-3 py-2 rounded-md text-sm text-gray-700 bg-gray-100 hover:bg-gray-200"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={confirmSpeedLimitDialog}
                    className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    Добавить знак
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


