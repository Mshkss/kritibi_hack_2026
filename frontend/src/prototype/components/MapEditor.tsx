import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Pane, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { NetworkState, Node, Edge, NodeType } from '../types';
import { Sidebar } from './Sidebar';
import { parseOSM } from '../utils/osmParser';
import { validateNetwork, ValidationResult } from '../utils/graphValidation';
import {
  buildLaneNetworkJsonExport,
  buildLaneNetworkOsmExport,
  downloadTextFile,
} from '../utils/networkExport';

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

const INTERSECTION_CONNECTION_NAMES = new Set(['Intersection Connection', 'Соединение перекрёстка']);
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
const CROSSING_RADIUS_METERS = 10;
const BUS_STOP_RADIUS_METERS = 15;
const SPEED_LIMIT_DETECTION_RADIUS_METERS = 15;

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
  const computed = computeEdgeProps(networkState);
  const normalizedEdges: Record<string, Edge> = {};

  Object.entries(networkState.edges).forEach(([edgeId, edge]) => {
    const props = computed[edgeId] || {
      crossroad: false,
      busStop: false,
      speedLimit: DEFAULT_SPEED_LIMIT,
    };
    normalizedEdges[edgeId] = {
      ...edge,
      crossroad: props.crossroad,
      busStop: props.busStop,
      speedLimit: props.speedLimit,
    };
  });

  return {
    ...networkState,
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

export function MapEditor() {
  const [history, setHistory] = useState<NetworkState[]>([normalizeNetworkState({ nodes: {}, edges: {} })]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  const state = history[currentIndex];
  
  const pushState = (newState: NetworkState) => {
    const normalizedState = normalizeNetworkState(newState);
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(normalizedState);
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  };
  
  const undo = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const redo = () => setCurrentIndex(prev => Math.min(history.length - 1, prev + 1));
  
  const [mode, setMode] = useState<Mode>('SELECT');
  const [currentZoom, setCurrentZoom] = useState(13);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [speedLimitDialogPosition, setSpeedLimitDialogPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [speedLimitInput, setSpeedLimitInput] = useState('40');
  const [speedLimitInputError, setSpeedLimitInputError] = useState('');

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
      const stripeHalfLength = 0.65;
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
  const zebraOuterWeight = Math.max(2, 4 * zebraScale);
  const zebraInnerWeight = Math.max(1, 2.6 * zebraScale);
  
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
          speedLimit: DEFAULT_SPEED_LIMIT
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
    } else if (mode === 'SELECT') {
      setSelectedEdgeId(id);
      setSelectedNodeId(null);
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
  
  const toggleOneWay = (edgeId: string) => {
    const edge = state.edges[edgeId];
    pushState({
      ...state,
      edges: {
        ...state.edges,
        [edgeId]: { ...edge, isOneWay: !edge.isOneWay }
      }
    });
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
        selectedEdge={selectedEdgeId ? state.edges[selectedEdgeId] : null}
        toggleOneWay={toggleOneWay}
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

            if (isIntersectionConnectionEdge) return null;
            
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
                    <div className="font-bold">{edge.name || 'Ребро'}</div>
                    <div className="text-xs text-gray-700 font-medium">Ограничение: {speedLimit} км/ч</div>
                    {hasCrossing && <div className="text-xs text-amber-700 font-bold">Рядом пешеходный переход (10 м)</div>}
                    {hasBusStop && <div className="text-xs text-blue-700 font-bold">Рядом остановка (15 м)</div>}
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
