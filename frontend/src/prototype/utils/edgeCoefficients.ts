import { Edge, NetworkState, Node } from '../types';

export const MAX_EDGE_CAPACITY = 1000;
export const BASE_CITY_SPEED_KMH = 60;

const INTERSECTION_CONNECTION_NAMES = new Set([
  'Intersection Connection',
  'Соединение перекрёстка',
  'РЎРѕРµРґРёРЅРµРЅРёРµ РїРµСЂРµРєСЂС‘СЃС‚РєР°',
]);

const TRAFFIC_LIGHT_LINK_RADIUS_METERS = 25;

const isIntersectionConnection = (edge: Edge) =>
  typeof edge.name === 'string' && INTERSECTION_CONNECTION_NAMES.has(edge.name);

const isLaneEdge = (edge: Edge) => !isIntersectionConnection(edge);

type TraversalSegment = {
  edgeId: string;
  fromId: string;
  toId: string;
};

export type EdgeCoefficientBreakdown = {
  width: number;
  speed: number;
  radius: number;
  crosswalk: number;
  slope: number;
  parking: number;
  busStop: number;
  maneuver: number;
};

export type EdgeCoefficientMetrics = {
  edgeId: string;
  coefficients: EdgeCoefficientBreakdown;
  totalCoefficient: number;
  finalCapacity: number;
  finalSpeed: number;
  normalizedTurnPercentage: number;
};

export type EdgeGroupSummary = {
  id: string;
  startLightId: string;
  startLightLabel: string;
  endLightId: string | null;
  endLightLabel: string | null;
  pathEdgeIds: string[];
  laneEdgeIds: string[];
  coefficient: number | null;
  capacity: number | null;
  speedLimit: number | null;
  finalSpeed: number | null;
  isComplete: boolean;
  startEdgeId: string;
};

export type NetworkCoefficientSummary = {
  edgeMetrics: Record<string, EdgeCoefficientMetrics>;
  groups: EdgeGroupSummary[];
  completeGroups: EdgeGroupSummary[];
  incompleteGroups: EdgeGroupSummary[];
  overallCoefficient: number | null;
  overallCapacity: number | null;
  overallSpeedLimit: number | null;
  overallFinalSpeed: number | null;
};

const toLocalDelta = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  refLat: number,
): { x: number; y: number } => ({
  x: (to.lng - from.lng) * 111320 * Math.cos((refLat * Math.PI) / 180),
  y: (to.lat - from.lat) * 111320,
});

const vectorLength = (v: { x: number; y: number }) => Math.sqrt(v.x * v.x + v.y * v.y);

const distanceMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const refLat = (a.lat + b.lat) / 2;
  const delta = toLocalDelta(a, b, refLat);
  return vectorLength(delta);
};

const angleBetween = (a: { x: number; y: number } | null, b: { x: number; y: number } | null): number => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const aLen = vectorLength(a);
  const bLen = vectorLength(b);
  if (aLen < 1e-9 || bLen < 1e-9) return Number.POSITIVE_INFINITY;
  const dot = a.x * b.x + a.y * b.y;
  const ratio = Math.max(-1, Math.min(1, dot / (aLen * bLen)));
  return Math.acos(ratio);
};

const incomingVectorAtTarget = (
  edge: Edge,
  nodes: Record<string, Node>,
  fromId: string,
  toId: string,
): { x: number; y: number } | null => {
  const source = nodes[edge.sourceId];
  const target = nodes[edge.targetId];
  if (!source || !target) return null;

  if (fromId === edge.sourceId && toId === edge.targetId) {
    const prev = edge.points.length > 0 ? edge.points[edge.points.length - 1] : source;
    return toLocalDelta(prev, target, target.lat);
  }

  if (fromId === edge.targetId && toId === edge.sourceId) {
    const prev = edge.points.length > 0 ? edge.points[0] : target;
    return toLocalDelta(prev, source, source.lat);
  }

  return null;
};

const outgoingVectorAtSource = (
  edge: Edge,
  nodes: Record<string, Node>,
  fromId: string,
  toId: string,
): { x: number; y: number } | null => {
  const source = nodes[edge.sourceId];
  const target = nodes[edge.targetId];
  if (!source || !target) return null;

  if (fromId === edge.sourceId && toId === edge.targetId) {
    const next = edge.points.length > 0 ? edge.points[0] : target;
    return toLocalDelta(source, next, source.lat);
  }

  if (fromId === edge.targetId && toId === edge.sourceId) {
    const next = edge.points.length > 0 ? edge.points[edge.points.length - 1] : source;
    return toLocalDelta(target, next, target.lat);
  }

  return null;
};

const normalizeTurnPercentage = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return 0.2;
  let normalized = value;
  if (normalized > 1) normalized /= 100;
  return Math.max(0, Math.min(1, normalized));
};

const calculateWidthCoefficient = (width: number): number => {
  if (width >= 3.75) return 1;
  if (width >= 3.5) return 0.99;
  if (width >= 3.25) return 0.97;
  if (width >= 3.0) return 0.93;
  if (width >= 2.75) return 0.9;
  return 0.9;
};

const calculateSpeedCoefficient = (speed: number): number => {
  if (speed >= 60) return 1;
  if (speed >= 50) return 0.98;
  if (speed >= 40) return 0.96;
  if (speed >= 30) return 0.88;
  if (speed >= 20) return 0.76;
  if (speed >= 10) return 0.44;
  return 0.44;
};

const calculateRadiusCoefficient = (radius: number): number => {
  if (radius >= 450) return 1;
  if (radius >= 250) return 0.96;
  if (radius >= 100) return 0.9;
  return 0.85;
};

const calculateCrosswalkCoefficient = (pedestrians: number): number => {
  if (pedestrians === 0) return 1;
  if (pedestrians < 60) return 0.86;
  if (pedestrians < 120) return 0.58;
  return 0.27;
};

const calculateSlopeCoefficient = (slope: number): number => {
  if (slope <= 5) return 1;
  if (slope <= 10) return 0.9;
  if (slope <= 16) return 0.8;
  if (slope <= 21) return 0.7;
  if (slope <= 26) return 0.6;
  if (slope <= 30) return 0.5;
  if (slope <= 34) return 0.4;
  if (slope <= 38) return 0.3;
  if (slope <= 41) return 0.2;
  if (slope <= 44) return 0.1;
  return 0.05;
};

const calculateParkingCoefficient = (parkingType: 1 | 2 | 3): number => {
  if (parkingType === 2) return 0.8;
  if (parkingType === 3) return 0.64;
  return 1;
};

const calculateStopCoefficient = (stopType: 1 | 2 | 3): number => {
  if (stopType === 2) return 0.8;
  if (stopType === 3) return 0.64;
  return 1;
};

const calculateManeuverCoefficient = (
  maneuverType: 1 | 2 | 3 | 4 | 5,
  turnPercentage: number | undefined,
): number => {
  const turnPct = normalizeTurnPercentage(turnPercentage);
  const baseMap: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 1,
    2: 0.99,
    3: 0.9,
    4: 0.88,
    5: 0.3,
  };
  let base = baseMap[maneuverType] ?? 1;
  if (maneuverType === 5 && turnPct < 0.05) {
    base = 0.9;
  }
  const reduction = (1 - base) * turnPct;
  const result = 1 - reduction;
  return Math.max(base, Math.min(1, result));
};

export const calculateEdgeCoefficientMetrics = (edge: Edge): EdgeCoefficientMetrics => {
  const normalizedTurn = normalizeTurnPercentage(edge.turnPercentage);
  const coefficients: EdgeCoefficientBreakdown = {
    width: calculateWidthCoefficient(edge.laneWidth),
    speed: calculateSpeedCoefficient(edge.speedLimit),
    radius: calculateRadiusCoefficient(edge.turnRadius),
    crosswalk: calculateCrosswalkCoefficient(edge.pedestrianIntensity),
    slope: calculateSlopeCoefficient(edge.roadSlope),
    parking: calculateParkingCoefficient(edge.parkingType),
    busStop: calculateStopCoefficient(edge.stopType),
    maneuver: calculateManeuverCoefficient(edge.maneuverType, edge.turnPercentage),
  };

  let total = 1;
  total *= coefficients.width;
  total *= coefficients.speed;
  total *= coefficients.radius;
  total *= coefficients.crosswalk;
  total *= coefficients.slope;
  if (edge.parkingType !== 1) total *= coefficients.parking;
  if (edge.stopType !== 1) total *= coefficients.busStop;
  if (edge.maneuverType !== 1) total *= coefficients.maneuver;

  return {
    edgeId: edge.id,
    coefficients,
    totalCoefficient: total,
    finalCapacity: MAX_EDGE_CAPACITY * total,
    finalSpeed: Math.min(BASE_CITY_SPEED_KMH * total, edge.speedLimit),
    normalizedTurnPercentage: normalizedTurn,
  };
};

const buildAdjacency = (state: NetworkState): Record<string, TraversalSegment[]> => {
  const adjacency: Record<string, TraversalSegment[]> = {};
  const edges = Object.values(state.edges) as Edge[];
  edges.forEach((edge) => {
    if (!adjacency[edge.sourceId]) adjacency[edge.sourceId] = [];
    adjacency[edge.sourceId].push({
      edgeId: edge.id,
      fromId: edge.sourceId,
      toId: edge.targetId,
    });
    if (!edge.isOneWay) {
      if (!adjacency[edge.targetId]) adjacency[edge.targetId] = [];
      adjacency[edge.targetId].push({
        edgeId: edge.id,
        fromId: edge.targetId,
        toId: edge.sourceId,
      });
    }
  });

  Object.values(adjacency).forEach((segments) => {
    segments.sort((a, b) => {
      const edgeCmp = a.edgeId.localeCompare(b.edgeId);
      if (edgeCmp !== 0) return edgeCmp;
      return a.toId.localeCompare(b.toId);
    });
  });

  return adjacency;
};

const segmentKey = (segment: TraversalSegment) => `${segment.edgeId}:${segment.fromId}->${segment.toId}`;

const chooseStraightest = (
  current: TraversalSegment,
  candidates: TraversalSegment[],
  state: NetworkState,
): TraversalSegment => {
  const currentEdge = state.edges[current.edgeId];
  if (!currentEdge) return candidates[0];

  const incoming = incomingVectorAtTarget(currentEdge, state.nodes, current.fromId, current.toId);
  if (!incoming) return candidates[0];

  let best = candidates[0];
  let bestAngle = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const edge = state.edges[candidate.edgeId];
    if (!edge) return;
    const outgoing = outgoingVectorAtSource(edge, state.nodes, candidate.fromId, candidate.toId);
    const angle = angleBetween(incoming, outgoing);
    if (angle < bestAngle - 1e-9) {
      best = candidate;
      bestAngle = angle;
      return;
    }
    if (Math.abs(angle - bestAngle) <= 1e-9) {
      const edgeCmp = candidate.edgeId.localeCompare(best.edgeId);
      if (edgeCmp < 0 || (edgeCmp === 0 && candidate.toId.localeCompare(best.toId) < 0)) {
        best = candidate;
        bestAngle = angle;
      }
    }
  });

  return best;
};

const getNodeLabel = (node: Node | undefined, fallbackId: string): string => {
  if (!node) return fallbackId;
  if (typeof node.name === 'string' && node.name.trim().length > 0) return node.name;
  return fallbackId;
};

type LightLookup = {
  nodeIdsNearLight: Record<string, string[]>;
  lightsNearNode: Record<string, string[]>;
};

const buildLightLookup = (state: NetworkState, trafficLights: Node[]): LightLookup => {
  const allNodes = Object.values(state.nodes) as Node[];
  const nodeIdsNearLight: Record<string, string[]> = {};
  const lightsNearNode: Record<string, string[]> = {};
  const lightDistanceByNodeId: Record<string, Record<string, number>> = {};

  allNodes.forEach((node) => {
    lightsNearNode[node.id] = [];
    lightDistanceByNodeId[node.id] = {};
  });

  trafficLights.forEach((lightNode) => {
    let nearbyNodes = allNodes
      .filter((node) => {
        if (node.id === lightNode.id) return true;
        if (node.type !== 'default') return false;
        return distanceMeters(lightNode, node) <= TRAFFIC_LIGHT_LINK_RADIUS_METERS;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    const hasLaneAnchors = nearbyNodes.some((node) => node.type === 'default');
    if (!hasLaneAnchors) {
      const nearestLaneAnchors = allNodes
        .filter((node) => node.type === 'default')
        .sort((a, b) => distanceMeters(lightNode, a) - distanceMeters(lightNode, b))
        .slice(0, 3);
      nearbyNodes = [...nearbyNodes, ...nearestLaneAnchors]
        .filter((node, index, list) => list.findIndex((item) => item.id === node.id) === index)
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    nodeIdsNearLight[lightNode.id] = nearbyNodes.map((node) => node.id);

    nearbyNodes.forEach((node) => {
      const distance = node.id === lightNode.id ? 0 : distanceMeters(lightNode, node);
      lightsNearNode[node.id].push(lightNode.id);
      lightDistanceByNodeId[node.id][lightNode.id] = distance;
    });
  });

  Object.entries(lightsNearNode).forEach(([nodeId, lightIds]) => {
    lightIds.sort((a, b) => {
      const distanceA = lightDistanceByNodeId[nodeId][a] ?? Number.POSITIVE_INFINITY;
      const distanceB = lightDistanceByNodeId[nodeId][b] ?? Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) return distanceA - distanceB;
      return a.localeCompare(b);
    });
  });

  return {
    nodeIdsNearLight,
    lightsNearNode,
  };
};

const buildGroups = (
  state: NetworkState,
  edgeMetrics: Record<string, EdgeCoefficientMetrics>,
): EdgeGroupSummary[] => {
  const adjacency = buildAdjacency(state);
  const trafficLights = (Object.values(state.nodes) as Node[])
    .filter((node) => node.type === 'traffic_light')
    .sort((a, b) => a.id.localeCompare(b.id));

  if (trafficLights.length === 0) return [];

  const { nodeIdsNearLight, lightsNearNode } = buildLightLookup(state, trafficLights);
  const groups: EdgeGroupSummary[] = [];
  const edgeLimit = Math.max(1, Object.keys(state.edges).length * 2);

  trafficLights.forEach((lightNode) => {
    const startMap = new Map<string, TraversalSegment>();
    (nodeIdsNearLight[lightNode.id] ?? []).forEach((anchorNodeId) => {
      const segments = adjacency[anchorNodeId] ?? [];
      segments.forEach((segment) => {
        startMap.set(segmentKey(segment), segment);
      });
    });

    const starts = Array.from(startMap.values()).sort((a, b) => {
      const edgeCmp = a.edgeId.localeCompare(b.edgeId);
      if (edgeCmp !== 0) return edgeCmp;
      const fromCmp = a.fromId.localeCompare(b.fromId);
      if (fromCmp !== 0) return fromCmp;
      return a.toId.localeCompare(b.toId);
    });

    starts.forEach((startSegment, startIndex) => {
      const visited = new Set<string>();
      const traversed: TraversalSegment[] = [];

      let current = startSegment;
      let steps = 0;
      let isComplete = false;
      let endLightId: string | null = null;

      while (steps < edgeLimit) {
        const currentKey = segmentKey(current);
        if (visited.has(currentKey)) break;
        visited.add(currentKey);
        traversed.push(current);

        const arrivedNode = state.nodes[current.toId];
        const reachedByNodeType =
          arrivedNode?.type === 'traffic_light' && current.toId !== lightNode.id
            ? current.toId
            : null;
        const reachedByProximity = (lightsNearNode[current.toId] ?? []).find(
          (candidateId) => candidateId !== lightNode.id,
        ) ?? null;
        const reachedLightId = reachedByNodeType ?? reachedByProximity;

        if (reachedLightId) {
          isComplete = true;
          endLightId = reachedLightId;
          break;
        }

        const nextSegments = adjacency[current.toId] ?? [];
        if (nextSegments.length === 0) break;

        const noImmediateBacktracking = nextSegments.filter((segment) => {
          const isReverseOfCurrent =
            segment.edgeId === current.edgeId &&
            segment.toId === current.fromId &&
            segment.fromId === current.toId;
          return !isReverseOfCurrent && !visited.has(segmentKey(segment));
        });

        const fallback = nextSegments.filter((segment) => !visited.has(segmentKey(segment)));
        const candidates = noImmediateBacktracking.length > 0 ? noImmediateBacktracking : fallback;
        if (candidates.length === 0) break;

        current = chooseStraightest(current, candidates, state);
        steps += 1;
      }

      const pathEdgeIds = traversed.map((segment) => segment.edgeId);
      const laneEdgeIds = Array.from(
        new Set(
          pathEdgeIds.filter((edgeId) => {
            const edge = state.edges[edgeId];
            if (!edge) return false;
            return isLaneEdge(edge);
          }),
        ),
      );
      const laneTotals = laneEdgeIds
        .map((edgeId) => edgeMetrics[edgeId]?.totalCoefficient)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const coefficient =
        laneTotals.length > 0 ? laneTotals.reduce((sum, value) => sum + value, 0) / laneTotals.length : null;
      const capacity = coefficient === null ? null : MAX_EDGE_CAPACITY * coefficient;
      const laneSpeedLimits = laneEdgeIds
        .map((edgeId) => state.edges[edgeId]?.speedLimit)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const speedLimit =
        laneSpeedLimits.length > 0
          ? laneSpeedLimits.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY)
          : null;
      const finalSpeed =
        coefficient === null
          ? null
          : Math.min(BASE_CITY_SPEED_KMH * coefficient, speedLimit ?? Number.POSITIVE_INFINITY);
      const endNode = endLightId ? state.nodes[endLightId] : null;

      groups.push({
        id: `${lightNode.id}:${startSegment.edgeId}:${startIndex}`,
        startLightId: lightNode.id,
        startLightLabel: getNodeLabel(lightNode, lightNode.id),
        endLightId,
        endLightLabel: endLightId ? getNodeLabel(endNode ?? undefined, endLightId) : null,
        pathEdgeIds,
        laneEdgeIds,
        coefficient,
        capacity,
        speedLimit,
        finalSpeed,
        isComplete,
        startEdgeId: startSegment.edgeId,
      });
    });
  });

  return groups;
};

export const calculateNetworkCoefficientSummary = (state: NetworkState): NetworkCoefficientSummary => {
  const edgeMetrics: Record<string, EdgeCoefficientMetrics> = {};
  const edges = Object.values(state.edges) as Edge[];
  edges.forEach((edge) => {
    if (!isLaneEdge(edge)) return;
    edgeMetrics[edge.id] = calculateEdgeCoefficientMetrics(edge);
  });

  const groups = buildGroups(state, edgeMetrics);
  const completeGroups = groups.filter((group) => group.isComplete && group.coefficient !== null);
  const incompleteGroups = groups.filter((group) => !group.isComplete);

  const overallCoefficient =
    completeGroups.length > 0
      ? completeGroups.reduce((sum, group) => sum + (group.coefficient ?? 0), 0) / completeGroups.length
      : null;
  const overallCapacity = overallCoefficient === null ? null : MAX_EDGE_CAPACITY * overallCoefficient;
  const completeSpeedLimits = completeGroups
    .map((group) => group.speedLimit)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const overallSpeedLimit =
    completeSpeedLimits.length > 0
      ? completeSpeedLimits.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY)
      : null;
  const overallFinalSpeed =
    overallCoefficient === null
      ? null
      : Math.min(BASE_CITY_SPEED_KMH * overallCoefficient, overallSpeedLimit ?? Number.POSITIVE_INFINITY);

  return {
    edgeMetrics,
    groups,
    completeGroups,
    incompleteGroups,
    overallCoefficient,
    overallCapacity,
    overallSpeedLimit,
    overallFinalSpeed,
  };
};
