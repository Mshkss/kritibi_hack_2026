import {
  NetworkState,
  TrafficLightControlConfig,
  TrafficLightSide,
  TrafficLightTimings,
} from '../types';
import { EdgeCoefficientMetrics, EdgeGroupSummary } from './edgeCoefficients';
import { SimulationGraphRuntime } from './vehicleSimulation';
import {
  TrafficLightLocalFrame,
  getDefaultTrafficLightControlConfig,
  getDefaultTrafficLightLocalFrame,
  toLocalMetersVector,
} from './trafficLightSimulation';

type PhaseAxis = 'NS' | 'EW';

const DEFAULT_SPEED_KMH = 40;
const EPSILON = 1e-9;
const MIN_GREEN_SEC = 8;
const MAX_GREEN_SEC = 300;
const MIN_YELLOW_SEC = 3;
const MAX_YELLOW_SEC = 5;
const SMART_SYNC_ALL_RED_SEC = 0;
const MIN_SHARED_CYCLE_SEC = 48;
const MAX_SHARED_CYCLE_SEC = 72;
const NS_WAVE_SHARE = 0.68;
const EW_WAVE_SHARE = 0.32;

type LightTopologyStats = {
  nsApproachCount: number;
  ewApproachCount: number;
  totalApproachCount: number;
  avgApproachSpeedKmh: number;
};

type DirectedWaveLink = {
  fromId: string;
  toId: string;
  travelTimeSec: number;
  startAxis: PhaseAxis;
  endAxis: PhaseAxis;
  weight: number;
};

type UndirectedWaveLink = {
  a: string;
  b: string;
  weight: number;
};

export type TrafficLightApproachForCoordination = {
  targetNodeId: string;
  directedEdgeIds: string[];
  effectiveSide: TrafficLightSide;
};

export type SmartTrafficLightCoordinationParams = {
  state: NetworkState;
  edgeMetrics: Record<string, EdgeCoefficientMetrics>;
  directedEdges: SimulationGraphRuntime['directedEdges'];
  trafficLightApproachesById: Record<string, TrafficLightApproachForCoordination[]>;
  trafficLightLocalFrameById: Record<string, TrafficLightLocalFrame>;
  completeGroups: EdgeGroupSummary[];
};

export type SmartTrafficLightCoordinationResult = {
  controlByLightId: Record<
    string,
    Pick<TrafficLightControlConfig, 'timings' | 'cycleOffsetSec'>
  >;
};

const DEFAULT_TOPOLOGY: LightTopologyStats = {
  nsApproachCount: 0,
  ewApproachCount: 0,
  totalApproachCount: 0,
  avgApproachSpeedKmh: DEFAULT_SPEED_KMH,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeModulo = (value: number, modulo: number): number => {
  if (!isFiniteNumber(value) || !isFiniteNumber(modulo) || modulo <= 0) return 0;
  const normalized = value % modulo;
  return normalized >= 0 ? normalized : normalized + modulo;
};

const getCycleLengthSec = (timings: TrafficLightTimings): number =>
  timings.nsGreenSec +
  timings.nsYellowSec +
  timings.allRedSec +
  timings.ewGreenSec +
  timings.ewYellowSec +
  timings.allRedSec;

const toAxisBySide = (side: TrafficLightSide): PhaseAxis =>
  side === 'north' || side === 'south' ? 'NS' : 'EW';

const toAxisMidpointSec = (timings: TrafficLightTimings, axis: PhaseAxis): number => {
  if (axis === 'NS') return timings.nsGreenSec / 2;
  return timings.nsGreenSec + timings.nsYellowSec + timings.allRedSec + timings.ewGreenSec / 2;
};

const dot = (
  a: { eastMeters: number; northMeters: number },
  b: { eastMeters: number; northMeters: number },
): number => a.eastMeters * b.eastMeters + a.northMeters * b.northMeters;

const geoDistanceMeters = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number => {
  const avgLatRad = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const dx = (to.lng - from.lng) * 111320 * Math.cos(avgLatRad);
  const dy = (to.lat - from.lat) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
};

const axisByDirection = (
  frame: TrafficLightLocalFrame,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): PhaseAxis => {
  const vector = toLocalMetersVector(from, to);
  const projA = dot(vector, frame.axisA);
  const projB = dot(vector, frame.axisB);
  return Math.abs(projA) >= Math.abs(projB) ? 'NS' : 'EW';
};

const getEdgeLengthMeters = (state: NetworkState, edgeId: string): number => {
  const edge = state.edges[edgeId];
  if (!edge) return 0;
  const source = state.nodes[edge.sourceId];
  const target = state.nodes[edge.targetId];
  if (!source || !target) return 0;

  const path = [
    { lat: source.lat, lng: source.lng },
    ...edge.points.map((point) => ({ lat: point.lat, lng: point.lng })),
    { lat: target.lat, lng: target.lng },
  ];
  let length = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    length += geoDistanceMeters(path[i], path[i + 1]);
  }
  return length;
};

const getPathTravelTimeSec = (
  state: NetworkState,
  edgeMetrics: Record<string, EdgeCoefficientMetrics>,
  pathEdgeIds: string[],
): number => {
  let total = 0;
  pathEdgeIds.forEach((edgeId) => {
    const edge = state.edges[edgeId];
    if (!edge) return;

    const length = getEdgeLengthMeters(state, edgeId);
    if (!isFiniteNumber(length) || length <= 0) return;

    const speedKmhRaw = edgeMetrics[edgeId]?.finalSpeed ?? edge.speedLimit;
    const speedKmh =
      isFiniteNumber(speedKmhRaw) && speedKmhRaw > 0 ? speedKmhRaw : DEFAULT_SPEED_KMH;
    total += length / (speedKmh / 3.6);
  });

  return total;
};

const getClosestEndpoint = (
  light: { lat: number; lng: number },
  source: { lat: number; lng: number },
  target: { lat: number; lng: number },
): 'source' | 'target' => {
  const sourceDistance = geoDistanceMeters(light, source);
  const targetDistance = geoDistanceMeters(light, target);
  return sourceDistance <= targetDistance ? 'source' : 'target';
};

const getGroupAxes = (
  state: NetworkState,
  group: EdgeGroupSummary,
  framesByLightId: Record<string, TrafficLightLocalFrame>,
): { startAxis: PhaseAxis; endAxis: PhaseAxis } => {
  const startLight = state.nodes[group.startLightId];
  const endLight = group.endLightId ? state.nodes[group.endLightId] : null;
  const firstEdgeId = group.pathEdgeIds[0];
  const lastEdgeId = group.pathEdgeIds[group.pathEdgeIds.length - 1];
  const firstEdge = firstEdgeId ? state.edges[firstEdgeId] : undefined;
  const lastEdge = lastEdgeId ? state.edges[lastEdgeId] : undefined;
  if (!startLight || !endLight || !firstEdge || !lastEdge) {
    return { startAxis: 'NS', endAxis: 'NS' };
  }

  const firstSource = state.nodes[firstEdge.sourceId];
  const firstTarget = state.nodes[firstEdge.targetId];
  const lastSource = state.nodes[lastEdge.sourceId];
  const lastTarget = state.nodes[lastEdge.targetId];
  if (!firstSource || !firstTarget || !lastSource || !lastTarget) {
    return { startAxis: 'NS', endAxis: 'NS' };
  }

  const startFrame = framesByLightId[group.startLightId] ?? getDefaultTrafficLightLocalFrame();
  const endFrame = framesByLightId[group.endLightId ?? ''] ?? getDefaultTrafficLightLocalFrame();

  const startClosest = getClosestEndpoint(startLight, firstSource, firstTarget);
  const startFrom = startClosest === 'source' ? firstSource : firstTarget;
  const startTo =
    startClosest === 'source'
      ? firstEdge.points[0] ?? firstTarget
      : firstEdge.points[firstEdge.points.length - 1] ?? firstSource;

  const endClosest = getClosestEndpoint(endLight, lastSource, lastTarget);
  const endTo = endClosest === 'source' ? lastSource : lastTarget;
  const endFrom =
    endClosest === 'source'
      ? lastEdge.points[0] ?? lastTarget
      : lastEdge.points[lastEdge.points.length - 1] ?? lastSource;

  return {
    startAxis: axisByDirection(startFrame, startFrom, startTo),
    endAxis: axisByDirection(endFrame, endFrom, endTo),
  };
};

const getDirectedEdgeSpeedKmh = (
  params: SmartTrafficLightCoordinationParams,
  directedEdgeId: string,
): number => {
  const directedEdge = params.directedEdges[directedEdgeId];
  const baseEdgeId = directedEdge?.baseEdgeId;
  const speedRaw =
    directedEdge?.speedLimit ??
    (baseEdgeId ? params.edgeMetrics[baseEdgeId]?.finalSpeed : undefined) ??
    (baseEdgeId ? params.state.edges[baseEdgeId]?.speedLimit : undefined);
  return isFiniteNumber(speedRaw) && speedRaw > 0 ? speedRaw : DEFAULT_SPEED_KMH;
};

const calculateTopologyByLight = (
  params: SmartTrafficLightCoordinationParams,
  trafficLightIds: string[],
): Record<string, LightTopologyStats> => {
  const topologyByLightId: Record<string, LightTopologyStats> = {};

  trafficLightIds.forEach((lightId) => {
    const approaches = params.trafficLightApproachesById[lightId] ?? [];
    let nsApproachCount = 0;
    let ewApproachCount = 0;
    let totalApproachCount = 0;
    let approachSpeedSum = 0;

    approaches.forEach((approach) => {
      const speeds = approach.directedEdgeIds.map((directedEdgeId) =>
        getDirectedEdgeSpeedKmh(params, directedEdgeId),
      );
      const approachSpeedKmh =
        speeds.length > 0
          ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
          : DEFAULT_SPEED_KMH;

      if (toAxisBySide(approach.effectiveSide) === 'NS') {
        nsApproachCount += 1;
      } else {
        ewApproachCount += 1;
      }
      totalApproachCount += 1;
      approachSpeedSum += approachSpeedKmh;
    });

    topologyByLightId[lightId] = {
      nsApproachCount,
      ewApproachCount,
      totalApproachCount,
      avgApproachSpeedKmh:
        totalApproachCount > 0 ? approachSpeedSum / totalApproachCount : DEFAULT_SPEED_KMH,
    };
  });

  return topologyByLightId;
};

const calculateBaseCycleSec = (topology: LightTopologyStats | undefined): number => {
  const totalApproachCount = topology?.totalApproachCount ?? 0;
  return clamp(Math.round(42 + 4 * totalApproachCount), 40, 80);
};

const calculateComponentCycleSecByLight = (
  components: string[][],
  topologyByLightId: Record<string, LightTopologyStats>,
): Record<string, number> => {
  const cycleSecByLightId: Record<string, number> = {};

  components.forEach((componentNodes) => {
    if (componentNodes.length === 0) return;

    const baseCycleValues = componentNodes.map((lightId) =>
      calculateBaseCycleSec(topologyByLightId[lightId]),
    );
    const componentCycleSec =
      componentNodes.length <= 1
        ? baseCycleValues[0]
        : clamp(
            Math.round(baseCycleValues.reduce((sum, value) => sum + value, 0) / baseCycleValues.length),
            MIN_SHARED_CYCLE_SEC,
            MAX_SHARED_CYCLE_SEC,
          );

    componentNodes.forEach((lightId) => {
      cycleSecByLightId[lightId] = componentCycleSec;
    });
  });

  return cycleSecByLightId;
};

const rebalanceGreens = (
  nsGreenRaw: number,
  ewGreenRaw: number,
  greenBudget: number,
  nsShare: number,
): { nsGreenSec: number; ewGreenSec: number } => {
  let nsGreen = Math.round(nsGreenRaw);
  let ewGreen = Math.round(ewGreenRaw);

  if (nsGreen < MIN_GREEN_SEC) {
    const transfer = MIN_GREEN_SEC - nsGreen;
    nsGreen += transfer;
    ewGreen -= transfer;
  }
  if (ewGreen < MIN_GREEN_SEC) {
    const transfer = MIN_GREEN_SEC - ewGreen;
    ewGreen += transfer;
    nsGreen -= transfer;
  }

  nsGreen = Math.max(MIN_GREEN_SEC, nsGreen);
  ewGreen = Math.max(MIN_GREEN_SEC, ewGreen);

  let difference = greenBudget - (nsGreen + ewGreen);
  if (difference > 0) {
    if (nsShare >= 0.5) {
      nsGreen += difference;
    } else {
      ewGreen += difference;
    }
    difference = 0;
  }

  if (difference < 0) {
    let toReduce = -difference;
    const nsReducible = Math.max(0, nsGreen - MIN_GREEN_SEC);
    const reduceNs = Math.min(nsReducible, toReduce);
    nsGreen -= reduceNs;
    toReduce -= reduceNs;

    if (toReduce > 0) {
      const ewReducible = Math.max(0, ewGreen - MIN_GREEN_SEC);
      const reduceEw = Math.min(ewReducible, toReduce);
      ewGreen -= reduceEw;
      toReduce -= reduceEw;
    }

    if (toReduce > 0) {
      const extraReduceNs = Math.min(Math.max(0, nsGreen - MIN_GREEN_SEC), toReduce);
      nsGreen -= extraReduceNs;
    }
  }

  return { nsGreenSec: nsGreen, ewGreenSec: ewGreen };
};

const directionalLinkKey = (fromId: string, toId: string): string => `${fromId}->${toId}`;

const undirectedLinkKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

const buildDirectionalLinks = (
  params: SmartTrafficLightCoordinationParams,
  trafficLightIds: Set<string>,
): Map<string, DirectedWaveLink> => {
  const linksByDirection = new Map<string, DirectedWaveLink>();

  params.completeGroups.forEach((group) => {
    if (!group.isComplete || !group.endLightId) return;
    if (!trafficLightIds.has(group.startLightId) || !trafficLightIds.has(group.endLightId)) {
      return;
    }
    if (group.pathEdgeIds.length === 0) return;

    const travelTimeSec = getPathTravelTimeSec(
      params.state,
      params.edgeMetrics,
      group.pathEdgeIds,
    );
    if (!isFiniteNumber(travelTimeSec) || travelTimeSec <= 0) return;

    const weight = 1 / Math.max(travelTimeSec, 1);
    if (!isFiniteNumber(weight) || weight <= 0) return;

    const { startAxis, endAxis } = getGroupAxes(
      params.state,
      group,
      params.trafficLightLocalFrameById,
    );
    const link: DirectedWaveLink = {
      fromId: group.startLightId,
      toId: group.endLightId,
      travelTimeSec,
      startAxis,
      endAxis,
      weight,
    };

    const key = directionalLinkKey(link.fromId, link.toId);
    const existing = linksByDirection.get(key);
    if (!existing || link.travelTimeSec < existing.travelTimeSec - EPSILON) {
      linksByDirection.set(key, link);
    }
  });

  return linksByDirection;
};

const buildUndirectedLinks = (
  directionalLinks: Map<string, DirectedWaveLink>,
): UndirectedWaveLink[] => {
  const linksByPair = new Map<string, UndirectedWaveLink>();

  directionalLinks.forEach((link) => {
    if (link.fromId === link.toId) return;

    const key = undirectedLinkKey(link.fromId, link.toId);
    const existing = linksByPair.get(key);
    if (!existing) {
      linksByPair.set(key, {
        a: link.fromId < link.toId ? link.fromId : link.toId,
        b: link.fromId < link.toId ? link.toId : link.fromId,
        weight: link.weight,
      });
      return;
    }
    existing.weight = Math.max(existing.weight, link.weight);
  });

  return Array.from(linksByPair.values());
};

const findConnectedComponents = (
  nodes: string[],
  links: UndirectedWaveLink[],
): string[][] => {
  const adjacency: Record<string, string[]> = {};
  nodes.forEach((nodeId) => {
    adjacency[nodeId] = [];
  });
  links.forEach((link) => {
    adjacency[link.a]?.push(link.b);
    adjacency[link.b]?.push(link.a);
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  nodes.forEach((nodeId) => {
    if (visited.has(nodeId)) return;
    const queue = [nodeId];
    const component: string[] = [];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      (adjacency[current] ?? []).forEach((next) => {
        if (visited.has(next)) return;
        visited.add(next);
        queue.push(next);
      });
    }

    components.push(component.sort((a, b) => a.localeCompare(b)));
  });

  return components;
};

const getComponentDominantAxis = (
  componentNodes: string[],
  topologyByLightId: Record<string, LightTopologyStats>,
  directionalLinks: Map<string, DirectedWaveLink>,
): PhaseAxis => {
  const componentSet = new Set(componentNodes);
  let nsWeight = 0;
  let ewWeight = 0;

  directionalLinks.forEach((link) => {
    if (!componentSet.has(link.fromId) || !componentSet.has(link.toId)) return;
    const halfWeight = link.weight * 0.5;
    if (link.startAxis === 'NS') {
      nsWeight += halfWeight;
    } else {
      ewWeight += halfWeight;
    }
    if (link.endAxis === 'NS') {
      nsWeight += halfWeight;
    } else {
      ewWeight += halfWeight;
    }
  });

  if (Math.abs(nsWeight - ewWeight) > EPSILON) {
    return nsWeight > ewWeight ? 'NS' : 'EW';
  }

  let nsApproaches = 0;
  let ewApproaches = 0;
  componentNodes.forEach((lightId) => {
    const topology = topologyByLightId[lightId] ?? DEFAULT_TOPOLOGY;
    nsApproaches += topology.nsApproachCount;
    ewApproaches += topology.ewApproachCount;
  });

  if (nsApproaches !== ewApproaches) {
    return nsApproaches > ewApproaches ? 'NS' : 'EW';
  }
  return 'NS';
};

const buildAutoTimings = (
  topologyByLightId: Record<string, LightTopologyStats>,
  components: string[][],
  componentCycleSecByLightId: Record<string, number>,
  directionalLinks: Map<string, DirectedWaveLink>,
): Record<string, TrafficLightTimings> => {
  const timingsByLightId: Record<string, TrafficLightTimings> = {};

  components.forEach((componentNodes) => {
    if (componentNodes.length === 0) return;
    const dominantAxis = getComponentDominantAxis(
      componentNodes,
      topologyByLightId,
      directionalLinks,
    );

    componentNodes.forEach((lightId) => {
      const topology = topologyByLightId[lightId] ?? DEFAULT_TOPOLOGY;
      const cycleSec = componentCycleSecByLightId[lightId] ?? calculateBaseCycleSec(topology);
      const yellowSec = clamp(
        Math.round(topology.avgApproachSpeedKmh / 25) + 1,
        MIN_YELLOW_SEC,
        MAX_YELLOW_SEC,
      );
      const greenBudget = Math.max(16, cycleSec - 2 * yellowSec);

      const approachSum = topology.nsApproachCount + topology.ewApproachCount;
      const baseNsShare = approachSum > 0 ? topology.nsApproachCount / approachSum : 0.5;
      const waveNsShare = dominantAxis === 'NS' ? NS_WAVE_SHARE : EW_WAVE_SHARE;
      let nsShare = clamp(0.35 * baseNsShare + 0.65 * waveNsShare, 0.25, 0.75);
      if (topology.nsApproachCount <= 0 && topology.ewApproachCount > 0) {
        nsShare = 0.25;
      } else if (topology.ewApproachCount <= 0 && topology.nsApproachCount > 0) {
        nsShare = 0.75;
      }

      const rawNsGreen = greenBudget * nsShare;
      const rawEwGreen = greenBudget - rawNsGreen;
      const { nsGreenSec, ewGreenSec } = rebalanceGreens(
        rawNsGreen,
        rawEwGreen,
        greenBudget,
        nsShare,
      );

      timingsByLightId[lightId] = {
        nsGreenSec,
        nsYellowSec: yellowSec,
        ewGreenSec,
        ewYellowSec: yellowSec,
        allRedSec: SMART_SYNC_ALL_RED_SEC,
      };
    });
  });

  return timingsByLightId;
};

class DisjointSet {
  private parent: Map<string, string>;

  constructor(nodes: string[]) {
    this.parent = new Map(nodes.map((nodeId) => [nodeId, nodeId]));
  }

  find(nodeId: string): string {
    const current = this.parent.get(nodeId) ?? nodeId;
    if (current === nodeId) return current;
    const root = this.find(current);
    this.parent.set(nodeId, root);
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    this.parent.set(rootB, rootA);
    return true;
  }
}

const buildMaxSpanningTree = (
  componentNodes: string[],
  links: UndirectedWaveLink[],
): UndirectedWaveLink[] => {
  const sorted = [...links].sort((a, b) => {
    if (Math.abs(b.weight - a.weight) > EPSILON) return b.weight - a.weight;
    const aKey = `${a.a}|${a.b}`;
    const bKey = `${b.a}|${b.b}`;
    return aKey.localeCompare(bKey);
  });
  const dsu = new DisjointSet(componentNodes);
  const tree: UndirectedWaveLink[] = [];

  sorted.forEach((link) => {
    if (tree.length >= componentNodes.length - 1) return;
    if (dsu.union(link.a, link.b)) {
      tree.push(link);
    }
  });

  return tree;
};

const computeNeighborOffset = (
  currentId: string,
  neighborId: string,
  currentOffsetSec: number,
  timingsByLightId: Record<string, TrafficLightTimings>,
  directionalLinks: Map<string, DirectedWaveLink>,
): number => {
  const currentTimings =
    timingsByLightId[currentId] ?? getDefaultTrafficLightControlConfig().timings;
  const neighborTimings =
    timingsByLightId[neighborId] ?? getDefaultTrafficLightControlConfig().timings;
  const direct = directionalLinks.get(directionalLinkKey(currentId, neighborId));

  if (direct) {
    const currentMid = toAxisMidpointSec(currentTimings, direct.startAxis);
    const neighborMid = toAxisMidpointSec(neighborTimings, direct.endAxis);
    // offset_to = normalize(offset_from + mid_to - mid_from - travelTime, cycle)
    return currentOffsetSec + (neighborMid - currentMid - direct.travelTimeSec);
  }

  const reverse = directionalLinks.get(directionalLinkKey(neighborId, currentId));
  if (reverse) {
    const currentMid = toAxisMidpointSec(currentTimings, reverse.endAxis);
    const neighborMid = toAxisMidpointSec(neighborTimings, reverse.startAxis);
    return currentOffsetSec + (neighborMid - currentMid + reverse.travelTimeSec);
  }

  return currentOffsetSec;
};

const calculateOffsets = (
  components: string[][],
  undirectedLinks: UndirectedWaveLink[],
  timingsByLightId: Record<string, TrafficLightTimings>,
  directionalLinks: Map<string, DirectedWaveLink>,
  componentCycleSecByLightId: Record<string, number>,
): Record<string, number> => {
  const offsetsByLightId: Record<string, number> = {};
  components.forEach((componentNodes) => {
    componentNodes.forEach((lightId) => {
      offsetsByLightId[lightId] = 0;
    });
  });

  components.forEach((componentNodes) => {
    if (componentNodes.length === 0) return;
    if (componentNodes.length === 1) {
      offsetsByLightId[componentNodes[0]] = 0;
      return;
    }

    const componentSet = new Set(componentNodes);
    const componentLinks = undirectedLinks.filter(
      (link) => componentSet.has(link.a) && componentSet.has(link.b),
    );
    if (componentLinks.length === 0) {
      componentNodes.forEach((nodeId) => {
        offsetsByLightId[nodeId] = 0;
      });
      return;
    }

    const treeLinks = buildMaxSpanningTree(componentNodes, componentLinks);
    const treeAdjacency: Record<string, string[]> = {};
    const incidentWeights: Record<string, number> = {};
    componentNodes.forEach((nodeId) => {
      treeAdjacency[nodeId] = [];
      incidentWeights[nodeId] = 0;
    });
    componentLinks.forEach((link) => {
      incidentWeights[link.a] = (incidentWeights[link.a] ?? 0) + link.weight;
      incidentWeights[link.b] = (incidentWeights[link.b] ?? 0) + link.weight;
    });

    treeLinks.forEach((link) => {
      treeAdjacency[link.a].push(link.b);
      treeAdjacency[link.b].push(link.a);
    });

    const root = [...componentNodes].sort((a, b) => {
      const diff = (incidentWeights[b] ?? 0) - (incidentWeights[a] ?? 0);
      if (Math.abs(diff) > EPSILON) return diff > 0 ? 1 : -1;
      return a.localeCompare(b);
    })[0];

    offsetsByLightId[root] = 0;
    const visited = new Set<string>([root]);
    const queue = [root];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentOffset = offsetsByLightId[current] ?? 0;

      (treeAdjacency[current] ?? []).forEach((neighbor) => {
        if (visited.has(neighbor)) return;
        const nextOffsetRaw = computeNeighborOffset(
          current,
          neighbor,
          currentOffset,
          timingsByLightId,
          directionalLinks,
        );
        const cycleSec =
          componentCycleSecByLightId[neighbor] ??
          getCycleLengthSec(timingsByLightId[neighbor] ?? getDefaultTrafficLightControlConfig().timings);
        offsetsByLightId[neighbor] = normalizeModulo(nextOffsetRaw, cycleSec);
        visited.add(neighbor);
        queue.push(neighbor);
      });
    }

    componentNodes.forEach((nodeId) => {
      if (visited.has(nodeId)) return;
      offsetsByLightId[nodeId] = 0;
    });
  });

  return offsetsByLightId;
};

const sanitizeTimings = (value: unknown): TrafficLightTimings => {
  const defaults = getDefaultTrafficLightControlConfig().timings;
  const fallback: TrafficLightTimings = {
    ...defaults,
    allRedSec: SMART_SYNC_ALL_RED_SEC,
  };
  const candidate =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const nsGreen = clamp(
    Math.round(isFiniteNumber(candidate.nsGreenSec) ? candidate.nsGreenSec : fallback.nsGreenSec),
    MIN_GREEN_SEC,
    MAX_GREEN_SEC,
  );
  const ewGreen = clamp(
    Math.round(isFiniteNumber(candidate.ewGreenSec) ? candidate.ewGreenSec : fallback.ewGreenSec),
    MIN_GREEN_SEC,
    MAX_GREEN_SEC,
  );
  const nsYellow = clamp(
    Math.round(isFiniteNumber(candidate.nsYellowSec) ? candidate.nsYellowSec : fallback.nsYellowSec),
    MIN_YELLOW_SEC,
    MAX_YELLOW_SEC,
  );
  const ewYellow = clamp(
    Math.round(isFiniteNumber(candidate.ewYellowSec) ? candidate.ewYellowSec : fallback.ewYellowSec),
    MIN_YELLOW_SEC,
    MAX_YELLOW_SEC,
  );

  const sanitized: TrafficLightTimings = {
    nsGreenSec: nsGreen,
    nsYellowSec: nsYellow,
    ewGreenSec: ewGreen,
    ewYellowSec: ewYellow,
    allRedSec: SMART_SYNC_ALL_RED_SEC,
  };

  const cycleLength = getCycleLengthSec(sanitized);
  if (!isFiniteNumber(cycleLength) || cycleLength <= 0) {
    return fallback;
  }
  return sanitized;
};

const sanitizeOffset = (value: unknown, timings: TrafficLightTimings): number => {
  const cycleLength = getCycleLengthSec(timings);
  if (!isFiniteNumber(cycleLength) || cycleLength <= 0) return 0;
  const raw = isFiniteNumber(value) ? value : 0;
  return normalizeModulo(raw, cycleLength);
};

export const calculateSmartTrafficLightCoordination = (
  params: SmartTrafficLightCoordinationParams,
): SmartTrafficLightCoordinationResult => {
  const trafficLightIds = (Object.values(params.state.nodes) as NetworkState['nodes'][string][])
    .filter((node) => node.type === 'traffic_light')
    .map((node) => node.id)
    .sort((a, b) => a.localeCompare(b));

  if (trafficLightIds.length === 0) {
    return { controlByLightId: {} };
  }

  const trafficLightIdSet = new Set(trafficLightIds);
  const topologyByLightId = calculateTopologyByLight(params, trafficLightIds);
  const directionalLinks = buildDirectionalLinks(params, trafficLightIdSet);
  const undirectedLinks = buildUndirectedLinks(directionalLinks);
  const components = findConnectedComponents(trafficLightIds, undirectedLinks);
  const componentCycleSecByLightId = calculateComponentCycleSecByLight(
    components,
    topologyByLightId,
  );
  const timingsByLightId = buildAutoTimings(
    topologyByLightId,
    components,
    componentCycleSecByLightId,
    directionalLinks,
  );
  const offsetsByLightId = calculateOffsets(
    components,
    undirectedLinks,
    timingsByLightId,
    directionalLinks,
    componentCycleSecByLightId,
  );

  const defaultControl = getDefaultTrafficLightControlConfig();
  const controlByLightId: SmartTrafficLightCoordinationResult['controlByLightId'] = {};
  trafficLightIds.forEach((lightId) => {
    const timings = sanitizeTimings(timingsByLightId[lightId] ?? defaultControl.timings);
    const cycleOffsetSec = sanitizeOffset(offsetsByLightId[lightId], timings);
    controlByLightId[lightId] = {
      timings,
      cycleOffsetSec,
    };
  });

  return { controlByLightId };
};
