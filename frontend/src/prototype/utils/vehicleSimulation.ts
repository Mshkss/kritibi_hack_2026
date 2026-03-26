import { Edge, NetworkState } from '../types';
import { calculateEdgeCoefficientMetrics } from './edgeCoefficients';

type LatLngPoint = {
  lat: number;
  lng: number;
};

export type DirectedEdgeRuntime = {
  id: string;
  baseEdgeId: string;
  sourceId: string;
  targetId: string;
  reverseEdgeId?: string;
  path: LatLngPoint[];
  segmentLengths: number[];
  cumulativeLengths: number[];
  totalLength: number;
  effectiveLength: number;
  speedLimit: number;
};

export type SimulationGraphRuntime = {
  directedEdges: Record<string, DirectedEdgeRuntime>;
  edgeIds: string[];
  spawnEdgeIds: string[];
  outgoingByNode: Record<string, string[]>;
};

export type CarState = {
  id: string;
  edgeId: string;
  distanceOnEdge: number;
  lat: number;
  lng: number;
  recentNodeIds: string[];
};

type BuildSimulationGraphParams = {
  includeEdge?: (edge: Edge) => boolean;
  canSpawnOnEdge?: (edge: Edge) => boolean;
};

type ReconcileCarsParams = {
  cars: CarState[];
  targetCount: number;
  graph: SimulationGraphRuntime;
  createCarId: () => string;
  random?: () => number;
};

type AdvanceCarParams = {
  car: CarState;
  graph: SimulationGraphRuntime;
  dtSeconds: number;
  random?: () => number;
  canLeaveEdge?: (edge: DirectedEdgeRuntime) => boolean;
};

const DEFAULT_SPEED_LIMIT_KMH = 60;
const METERS_PER_DEGREE_LAT = 111320;
const EPSILON_DISTANCE_METERS = 1e-3;
const DEGENERATE_EDGE_EFFECTIVE_LENGTH_METERS = 0.5;
const MAX_EDGE_TRANSITIONS_PER_STEP = 32;
const LOOP_REPEAT_THRESHOLD = 4;
const LOOP_WINDOW_SIZE = 12;
const LOOP_UNIQUE_NODE_LIMIT = 3;
const EDGE_EXIT_STOP_BUFFER_METERS = 4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isFinitePoint = (point: LatLngPoint): boolean =>
  isFiniteNumber(point.lat) && isFiniteNumber(point.lng);

const sanitizeRecentNodeIds = (recentNodeIds: unknown): string[] => {
  if (!Array.isArray(recentNodeIds)) return [];
  return recentNodeIds
    .filter((nodeId): nodeId is string => typeof nodeId === 'string' && nodeId.length > 0)
    .slice(-LOOP_WINDOW_SIZE);
};

const updateLoopHistory = (
  recentNodeIds: string[],
  nodeId: string,
): { recentNodeIds: string[]; isLoopDetected: boolean } => {
  const nextHistory = [...recentNodeIds, nodeId].slice(-LOOP_WINDOW_SIZE);
  const counts: Record<string, number> = {};
  nextHistory.forEach((id) => {
    counts[id] = (counts[id] ?? 0) + 1;
  });

  const uniqueNodeCount = Object.keys(counts).length;
  const maxRepeatCount = Object.values(counts).reduce((max, count) => Math.max(max, count), 0);
  const isLoopDetected =
    uniqueNodeCount <= LOOP_UNIQUE_NODE_LIMIT && maxRepeatCount >= LOOP_REPEAT_THRESHOLD;

  return {
    recentNodeIds: nextHistory,
    isLoopDetected,
  };
};

const distanceMeters = (from: LatLngPoint, to: LatLngPoint): number => {
  const avgLatRad = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const dx = (to.lng - from.lng) * METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);
  const dy = (to.lat - from.lat) * METERS_PER_DEGREE_LAT;
  return Math.sqrt(dx * dx + dy * dy);
};

const normalizeSpeedMps = (speedLimitKmh: number): number => {
  const safeSpeedLimitKmh =
    isFiniteNumber(speedLimitKmh) && speedLimitKmh > 0
      ? speedLimitKmh
      : DEFAULT_SPEED_LIMIT_KMH;
  return safeSpeedLimitKmh / 3.6;
};

const buildDirectedEdgeRuntime = ({
  id,
  baseEdgeId,
  sourceId,
  targetId,
  path,
  speedLimit,
  reverseEdgeId,
  allowDegenerateLength,
}: {
  id: string;
  baseEdgeId: string;
  sourceId: string;
  targetId: string;
  path: LatLngPoint[];
  speedLimit: number;
  reverseEdgeId?: string;
  allowDegenerateLength: boolean;
}): DirectedEdgeRuntime | null => {
  if (path.length < 2) return null;

  const segmentLengths: number[] = [];
  const cumulativeLengths: number[] = [0];
  let totalLength = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = distanceMeters(path[i], path[i + 1]);
    if (!isFiniteNumber(segmentLength) || segmentLength < 0) return null;
    segmentLengths.push(segmentLength);
    totalLength += segmentLength;
    cumulativeLengths.push(totalLength);
  }

  if (totalLength <= EPSILON_DISTANCE_METERS && !allowDegenerateLength) return null;

  const effectiveLength =
    totalLength > EPSILON_DISTANCE_METERS
      ? totalLength
      : DEGENERATE_EDGE_EFFECTIVE_LENGTH_METERS;

  return {
    id,
    baseEdgeId,
    sourceId,
    targetId,
    reverseEdgeId,
    path,
    segmentLengths,
    cumulativeLengths,
    totalLength,
    effectiveLength,
    speedLimit,
  };
};

const positionAtDistance = (
  edge: DirectedEdgeRuntime,
  distance: number,
): LatLngPoint | null => {
  if (edge.path.length < 2) return null;
  if (!isFiniteNumber(distance)) return null;

  const targetDistance = clamp(distance, 0, edge.effectiveLength);
  if (edge.totalLength <= EPSILON_DISTANCE_METERS) {
    return targetDistance < edge.effectiveLength / 2
      ? edge.path[0]
      : edge.path[edge.path.length - 1];
  }

  const geometricDistance = clamp(
    (targetDistance / edge.effectiveLength) * edge.totalLength,
    0,
    edge.totalLength,
  );
  if (geometricDistance <= EPSILON_DISTANCE_METERS) return edge.path[0];
  if (geometricDistance >= edge.totalLength - EPSILON_DISTANCE_METERS) {
    return edge.path[edge.path.length - 1];
  }

  let remaining = geometricDistance;
  for (let i = 0; i < edge.segmentLengths.length; i++) {
    const segmentLength = edge.segmentLengths[i];
    if (segmentLength <= EPSILON_DISTANCE_METERS) continue;
    if (remaining <= segmentLength) {
      const ratio = remaining / segmentLength;
      const start = edge.path[i];
      const end = edge.path[i + 1];
      return {
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio,
      };
    }
    remaining -= segmentLength;
  }

  return edge.path[edge.path.length - 1];
};

const pickWeightedId = (
  scored: Array<{ id: string; score: number }>,
  random: () => number,
): string | null => {
  if (scored.length === 0) return null;

  const totalScore = scored.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  if (totalScore <= 0) {
    const randomIndex = Math.floor(clamp(random(), 0, 0.999999) * scored.length);
    return scored[randomIndex]?.id ?? scored[0].id;
  }

  let threshold = clamp(random(), 0, 0.999999) * totalScore;
  for (const item of scored) {
    threshold -= Math.max(0, item.score);
    if (threshold <= 0) return item.id;
  }

  return scored[scored.length - 1].id;
};

const chooseStartEdgeId = (
  graph: SimulationGraphRuntime,
  random: () => number,
): string | null => {
  const startPool = graph.spawnEdgeIds.length > 0 ? graph.spawnEdgeIds : graph.edgeIds;
  if (startPool.length === 0) return null;

  const scored = startPool
    .map((edgeId) => {
      const edge = graph.directedEdges[edgeId];
      if (!edge) return null;

      const outgoing = graph.outgoingByNode[edge.targetId] ?? [];
      const depthTwoContinuationCount = outgoing.reduce((count, nextEdgeId) => {
        const nextEdge = graph.directedEdges[nextEdgeId];
        if (!nextEdge) return count;
        const nextOutgoing = graph.outgoingByNode[nextEdge.targetId] ?? [];
        return nextOutgoing.length > 0 ? count + 1 : count;
      }, 0);

      return {
        id: edgeId,
        hasExitPath: depthTwoContinuationCount > 0,
        score:
          1 +
          (outgoing.length > 0 ? 6 : 0) +
          Math.min(outgoing.length, 6) * 2 +
          Math.min(depthTwoContinuationCount, 8),
      };
    })
    .filter((value): value is { id: string; score: number; hasExitPath: boolean } => Boolean(value));

  const withExitPath = scored.filter((edge) => edge.hasExitPath);
  const pool = withExitPath.length > 0 ? withExitPath : scored;
  return pickWeightedId(pool.map((edge) => ({ id: edge.id, score: edge.score })), random);
};

const getForwardCandidates = (
  graph: SimulationGraphRuntime,
  edge: DirectedEdgeRuntime,
  previousNodeId?: string,
): string[] =>
  (graph.outgoingByNode[edge.targetId] ?? []).filter((nextEdgeId) => {
    const nextEdge = graph.directedEdges[nextEdgeId];
    if (!nextEdge) return false;
    if (nextEdgeId === edge.reverseEdgeId) return false;
    if (previousNodeId && nextEdge.targetId === previousNodeId) return false;
    return true;
  });

const countLookaheadContinuations = (
  graph: SimulationGraphRuntime,
  startEdgeId: string,
  previousNodeId: string,
  depth: number,
): number => {
  if (depth <= 0) return 0;
  const startEdge = graph.directedEdges[startEdgeId];
  if (!startEdge) return 0;

  let total = 0;
  const queue: Array<{
    edgeId: string;
    previousNodeId: string;
    remainingDepth: number;
  }> = [{ edgeId: startEdgeId, previousNodeId, remainingDepth: depth }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.remainingDepth <= 0) continue;

    const signature = `${current.edgeId}|${current.previousNodeId}|${current.remainingDepth}`;
    if (visited.has(signature)) continue;
    visited.add(signature);

    const edge = graph.directedEdges[current.edgeId];
    if (!edge) continue;

    const forward = getForwardCandidates(graph, edge, current.previousNodeId);
    total += forward.length;

    if (current.remainingDepth > 1) {
      forward.forEach((nextEdgeId) => {
        queue.push({
          edgeId: nextEdgeId,
          previousNodeId: edge.targetId,
          remainingDepth: current.remainingDepth - 1,
        });
      });
    }
  }

  return total;
};

const countRecentVisits = (recentNodeIds: string[], nodeId: string): number =>
  recentNodeIds.reduce((count, id) => (id === nodeId ? count + 1 : count), 0);

const chooseNextEdgeId = (
  graph: SimulationGraphRuntime,
  currentEdgeId: string,
  recentNodeIds: string[],
  random: () => number,
): string | null => {
  const currentEdge = graph.directedEdges[currentEdgeId];
  if (!currentEdge) return null;

  const candidates = (graph.outgoingByNode[currentEdge.targetId] ?? [])
    .map((candidateId) => {
      const candidate = graph.directedEdges[candidateId];
      if (!candidate) return null;

      const nonReverseForward = getForwardCandidates(graph, candidate, currentEdge.targetId);
      const lookaheadDepth2 = countLookaheadContinuations(
        graph,
        candidate.id,
        currentEdge.targetId,
        2,
      );
      const lookaheadDepth3 = countLookaheadContinuations(
        graph,
        candidate.id,
        currentEdge.targetId,
        3,
      );

      const isImmediateReverse =
        candidate.id === currentEdge.reverseEdgeId || candidate.targetId === currentEdge.sourceId;
      const returnsToRecentNode = candidate.targetId === currentEdge.sourceId;
      const isDirectDeadEnd = nonReverseForward.length === 0;
      const targetNodeVisitCount = countRecentVisits(recentNodeIds, candidate.targetId);
      const hasExitPath = lookaheadDepth2 > 0 || lookaheadDepth3 > 0;

      const score =
        40 +
        nonReverseForward.length * 12 +
        lookaheadDepth2 * 6 +
        lookaheadDepth3 * 2 -
        (isImmediateReverse ? 60 : 0) -
        (returnsToRecentNode ? 35 : 0) -
        (isDirectDeadEnd ? 45 : 0) -
        targetNodeVisitCount * 14;

      return {
        id: candidate.id,
        score: Math.max(1, score),
        targetNodeVisitCount,
        isDirectDeadEnd,
        hasExitPath,
        isImmediateReverse,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: string;
        score: number;
        targetNodeVisitCount: number;
        isDirectDeadEnd: boolean;
        hasExitPath: boolean;
        isImmediateReverse: boolean;
      } => Boolean(value),
    );

  if (candidates.length === 0) return null;

  const withExitPath = candidates.filter((candidate) => candidate.hasExitPath);
  const basePool = withExitPath.length > 0 ? withExitPath : candidates;

  const noRecentCycleNodes = basePool.filter((candidate) => candidate.targetNodeVisitCount === 0);
  const noDeadEnds = basePool.filter((candidate) => !candidate.isDirectDeadEnd);
  const noImmediateReverse = basePool.filter((candidate) => !candidate.isImmediateReverse);

  const pool =
    noRecentCycleNodes.length > 0
      ? noRecentCycleNodes
      : noDeadEnds.length > 0
        ? noDeadEnds
        : noImmediateReverse.length > 0
          ? noImmediateReverse
          : basePool;

  return pickWeightedId(
    pool.map((candidate) => ({ id: candidate.id, score: candidate.score })),
    random,
  );
};

const sanitizeCar = (
  car: CarState,
  graph: SimulationGraphRuntime,
): CarState | null => {
  const edge = graph.directedEdges[car.edgeId];
  if (!edge) return null;
  if (!isFiniteNumber(car.distanceOnEdge)) return null;
  if (!isFiniteNumber(edge.effectiveLength) || edge.effectiveLength <= 0) return null;

  const distanceOnEdge = clamp(car.distanceOnEdge, 0, edge.effectiveLength);
  const position = positionAtDistance(edge, distanceOnEdge);
  if (!position || !isFinitePoint(position)) return null;
  const recentNodeIds = sanitizeRecentNodeIds(car.recentNodeIds);

  return {
    ...car,
    distanceOnEdge,
    lat: position.lat,
    lng: position.lng,
    recentNodeIds,
  };
};

export const spawnCar = (
  graph: SimulationGraphRuntime,
  id: string,
  random: () => number = Math.random,
): CarState | null => {
  const startEdgeId = chooseStartEdgeId(graph, random);
  if (!startEdgeId) return null;
  const edge = graph.directedEdges[startEdgeId];
  if (!edge) return null;

  const distanceOnEdge = edge.effectiveLength * clamp(random(), 0, 1);
  const position = positionAtDistance(edge, distanceOnEdge);
  if (!position || !isFinitePoint(position)) return null;

  return {
    id,
    edgeId: startEdgeId,
    distanceOnEdge,
    lat: position.lat,
    lng: position.lng,
    recentNodeIds: [edge.sourceId],
  };
};

export const buildSimulationGraph = (
  state: NetworkState,
  params: BuildSimulationGraphParams = {},
): SimulationGraphRuntime => {
  const includeEdge = params.includeEdge ?? (() => true);
  const canSpawnOnEdge = params.canSpawnOnEdge ?? (() => true);
  const directedEdges: Record<string, DirectedEdgeRuntime> = {};
  const spawnEdgeIds: string[] = [];
  const outgoingByNode: Record<string, string[]> = {};

  const addOutgoing = (nodeId: string, edgeId: string) => {
    if (!outgoingByNode[nodeId]) outgoingByNode[nodeId] = [];
    outgoingByNode[nodeId].push(edgeId);
  };

  for (const edge of Object.values(state.edges) as Edge[]) {
    if (!includeEdge(edge)) continue;

    const source = state.nodes[edge.sourceId];
    const target = state.nodes[edge.targetId];
    if (!source || !target) continue;

    const basePath: LatLngPoint[] = [
      { lat: source.lat, lng: source.lng },
      ...edge.points.map((point) => ({ lat: point.lat, lng: point.lng })),
      { lat: target.lat, lng: target.lng },
    ];
    if (basePath.some((point) => !isFinitePoint(point))) continue;

    const edgeMetrics = calculateEdgeCoefficientMetrics(edge);
    const speedLimit =
      isFiniteNumber(edgeMetrics.finalSpeed) && edgeMetrics.finalSpeed > 0
        ? edgeMetrics.finalSpeed
        : DEFAULT_SPEED_LIMIT_KMH;
    const canSpawn = canSpawnOnEdge(edge);

    if (edge.isOneWay) {
      const directed = buildDirectedEdgeRuntime({
        id: edge.id,
        baseEdgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        path: basePath,
        speedLimit,
        allowDegenerateLength: !canSpawn,
      });
      if (!directed) continue;

      directedEdges[directed.id] = directed;
      addOutgoing(directed.sourceId, directed.id);
      if (canSpawn) spawnEdgeIds.push(directed.id);
      continue;
    }

    const forwardId = `${edge.id}::sim:fwd`;
    const reverseId = `${edge.id}::sim:rev`;
    const forward = buildDirectedEdgeRuntime({
      id: forwardId,
      baseEdgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      path: basePath,
      speedLimit,
      reverseEdgeId: reverseId,
      allowDegenerateLength: !canSpawn,
    });
    const reverse = buildDirectedEdgeRuntime({
      id: reverseId,
      baseEdgeId: edge.id,
      sourceId: edge.targetId,
      targetId: edge.sourceId,
      path: [...basePath].reverse(),
      speedLimit,
      reverseEdgeId: forwardId,
      allowDegenerateLength: !canSpawn,
    });

    if (!forward || !reverse) continue;

    directedEdges[forward.id] = forward;
    directedEdges[reverse.id] = reverse;
    addOutgoing(forward.sourceId, forward.id);
    addOutgoing(reverse.sourceId, reverse.id);
    if (canSpawn) {
      spawnEdgeIds.push(forward.id, reverse.id);
    }
  }

  const edgeIds = Object.keys(directedEdges).sort((a, b) => a.localeCompare(b));
  spawnEdgeIds.sort((a, b) => a.localeCompare(b));
  Object.values(outgoingByNode).forEach((edgeList) => edgeList.sort((a, b) => a.localeCompare(b)));

  return {
    directedEdges,
    edgeIds,
    spawnEdgeIds,
    outgoingByNode,
  };
};

export const reconcileCars = ({
  cars,
  targetCount,
  graph,
  createCarId,
  random = Math.random,
}: ReconcileCarsParams): CarState[] => {
  const boundedTargetCount = Math.max(0, Math.floor(targetCount));
  if (boundedTargetCount === 0 || graph.edgeIds.length === 0) return [];

  const nextCars: CarState[] = [];
  for (let i = 0; i < boundedTargetCount; i++) {
    const existing = i < cars.length ? sanitizeCar(cars[i], graph) : null;
    if (existing) {
      nextCars.push(existing);
      continue;
    }

    const id = cars[i]?.id ?? createCarId();
    const spawned = spawnCar(graph, id, random);
    if (spawned) nextCars.push(spawned);
  }

  return nextCars;
};

export const advanceCar = ({
  car,
  graph,
  dtSeconds,
  random = Math.random,
  canLeaveEdge,
}: AdvanceCarParams): CarState | null => {
  const restoredCar = sanitizeCar(car, graph);
  if (!restoredCar) return spawnCar(graph, car.id, random);
  if (dtSeconds <= 0) return restoredCar;

  let edge = graph.directedEdges[restoredCar.edgeId];
  if (!edge) return spawnCar(graph, restoredCar.id, random);
  if (!isFiniteNumber(edge.effectiveLength) || edge.effectiveLength <= 0) {
    return spawnCar(graph, restoredCar.id, random);
  }

  let distanceOnEdge = restoredCar.distanceOnEdge + normalizeSpeedMps(edge.speedLimit) * dtSeconds;
  let transitions = 0;
  let recentNodeIds = sanitizeRecentNodeIds(restoredCar.recentNodeIds);
  if (canLeaveEdge && !canLeaveEdge(edge)) {
    const stopLineDistance = Math.max(0, edge.effectiveLength - EDGE_EXIT_STOP_BUFFER_METERS);
    distanceOnEdge = Math.min(distanceOnEdge, stopLineDistance);
  }

  while (distanceOnEdge > edge.effectiveLength + EPSILON_DISTANCE_METERS) {
    if (canLeaveEdge && !canLeaveEdge(edge)) {
      const stopLineDistance = Math.max(0, edge.effectiveLength - EDGE_EXIT_STOP_BUFFER_METERS);
      distanceOnEdge = Math.min(distanceOnEdge, stopLineDistance);
      break;
    }

    distanceOnEdge -= edge.effectiveLength;
    const loopUpdate = updateLoopHistory(recentNodeIds, edge.targetId);
    recentNodeIds = loopUpdate.recentNodeIds;
    if (loopUpdate.isLoopDetected) {
      return spawnCar(graph, restoredCar.id, random);
    }

    const nextEdgeId = chooseNextEdgeId(graph, edge.id, recentNodeIds, random);
    if (!nextEdgeId) return spawnCar(graph, restoredCar.id, random);

    const nextEdge = graph.directedEdges[nextEdgeId];
    if (!nextEdge || !isFiniteNumber(nextEdge.effectiveLength) || nextEdge.effectiveLength <= 0) {
      return spawnCar(graph, restoredCar.id, random);
    }

    edge = nextEdge;
    transitions += 1;
    if (transitions > MAX_EDGE_TRANSITIONS_PER_STEP) {
      return spawnCar(graph, restoredCar.id, random);
    }
  }

  const position = positionAtDistance(edge, distanceOnEdge);
  if (!position || !isFinitePoint(position)) return spawnCar(graph, restoredCar.id, random);

  return {
    ...restoredCar,
    edgeId: edge.id,
    distanceOnEdge: clamp(distanceOnEdge, 0, edge.effectiveLength),
    lat: position.lat,
    lng: position.lng,
    recentNodeIds,
  };
};
