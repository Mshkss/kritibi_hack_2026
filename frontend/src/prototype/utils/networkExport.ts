import { Edge, NetworkState, Node, NodeType } from '../types';

const INTERSECTION_CONNECTION_NAMES = new Set([
  'Intersection Connection',
  'Соединение перекрёстка',
  'РЎРѕРµРґРёРЅРµРЅРёРµ РїРµСЂРµРєСЂС‘СЃС‚РєР°',
]);

const SPECIAL_NODE_TYPES = new Set<NodeType>([
  'traffic_light',
  'crossing',
  'bus_stop',
  'speed_limit',
]);

const isIntersectionConnection = (edge: Edge) =>
  typeof edge.name === 'string' && INTERSECTION_CONNECTION_NAMES.has(edge.name);

const isSpecialNode = (node: Node) =>
  typeof node.type === 'string' && SPECIAL_NODE_TYPES.has(node.type);

type ExportNode = {
  id: string;
  lat: number;
  lng: number;
  type: NodeType;
  name?: string;
  speedLimit?: number;
};

type ExportEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  points: { lat: number; lng: number }[];
  isOneWay: boolean;
  laneIndex?: number;
  isForward?: boolean;
  name?: string;
  speedLimit: number;
  laneWidth: number;
  turnRadius: number;
  pedestrianIntensity: number;
  pedestrianIntensityMode: 'auto' | 'manual';
  roadSlope: number;
  parkingType: 1 | 2 | 3;
  stopType: 1 | 2 | 3;
  stopTypeMode: 'auto' | 'manual';
  maneuverType: 1 | 2 | 3 | 4 | 5;
  turnPercentage: number;
  crossroad: boolean;
  busStop: boolean;
  tags: Record<string, string>;
  description: string;
};

export type LaneNetworkJsonExport = {
  schema: 'kritibi.lane-network-export.v1';
  exportedAt: string;
  counts: {
    laneNodes: number;
    specialNodes: number;
    laneEdges: number;
  };
  nodes: ExportNode[];
  edges: ExportEdge[];
};

type FilteredLaneGraph = {
  nodes: Node[];
  edges: Edge[];
};

const toNodeType = (node: Node): NodeType => node.type ?? 'default';

const buildEdgeDescription = (edge: Edge, source: Node, target: Node): string => {
  const lanePart =
    typeof edge.laneIndex === 'number'
      ? `lane ${edge.laneIndex + 1}`
      : 'lane without index';
  const directionPart =
    typeof edge.isForward === 'boolean'
      ? edge.isForward
        ? 'forward along source way'
        : 'reverse to source way'
      : 'direction not set';

  const flags: string[] = [];
  if (edge.crossroad) flags.push('near pedestrian crossing');
  if (edge.busStop) flags.push('near bus stop');
  const context = flags.length > 0 ? ` (${flags.join(', ')})` : '';
  const edgeName = edge.name && edge.name.trim().length > 0 ? edge.name : edge.id;

  return `${edgeName}: ${lanePart}, ${directionPart}, speed ${edge.speedLimit} km/h${context}. ${source.id} -> ${target.id}`;
};

const filterLaneGraph = (state: NetworkState): FilteredLaneGraph => {
  const exportEdges = (Object.values(state.edges) as Edge[])
    // Keep hidden intersection links in export so node-edge connectivity survives OSM round-trips.
    .filter(edge => edge.isOneWay || isIntersectionConnection(edge))
    .sort((a, b) => a.id.localeCompare(b.id));

  const exportNodeIds = new Set<string>();
  exportEdges.forEach(edge => {
    exportNodeIds.add(edge.sourceId);
    exportNodeIds.add(edge.targetId);
  });

  const specialNodes = (Object.values(state.nodes) as Node[]).filter(isSpecialNode);
  specialNodes.forEach(node => exportNodeIds.add(node.id));

  const nodes = [...exportNodeIds]
    .map(id => state.nodes[id])
    .filter((node): node is Node => Boolean(node))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges: exportEdges };
};

export const buildLaneNetworkJsonExport = (state: NetworkState): LaneNetworkJsonExport => {
  const { nodes, edges } = filterLaneGraph(state);
  const laneNodeCount = nodes.filter(node => toNodeType(node) === 'default').length;
  const specialNodeCount = nodes.length - laneNodeCount;

  return {
    schema: 'kritibi.lane-network-export.v1',
    exportedAt: new Date().toISOString(),
    counts: {
      laneNodes: laneNodeCount,
      specialNodes: specialNodeCount,
      laneEdges: edges.length,
    },
    nodes: nodes.map(node => ({
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      type: toNodeType(node),
      ...(node.name ? { name: node.name } : {}),
      ...(typeof node.speedLimit === 'number' ? { speedLimit: node.speedLimit } : {}),
    })),
    edges: edges.map(edge => {
      const source = state.nodes[edge.sourceId];
      const target = state.nodes[edge.targetId];
      if (!source || !target) {
        return {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          points: edge.points,
          isOneWay: edge.isOneWay,
          ...(typeof edge.laneIndex === 'number' ? { laneIndex: edge.laneIndex } : {}),
          ...(typeof edge.isForward === 'boolean' ? { isForward: edge.isForward } : {}),
          ...(edge.name ? { name: edge.name } : {}),
          speedLimit: edge.speedLimit,
          laneWidth: edge.laneWidth,
          turnRadius: edge.turnRadius,
          pedestrianIntensity: edge.pedestrianIntensity,
          pedestrianIntensityMode: edge.pedestrianIntensityMode,
          roadSlope: edge.roadSlope,
          parkingType: edge.parkingType,
          stopType: edge.stopType,
          stopTypeMode: edge.stopTypeMode,
          maneuverType: edge.maneuverType,
          turnPercentage: edge.turnPercentage,
          crossroad: edge.crossroad,
          busStop: edge.busStop,
          tags: edge.tags ?? {},
          description: `${edge.id}: source/target node not found`,
        };
      }

      return {
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        points: edge.points,
        isOneWay: edge.isOneWay,
        ...(typeof edge.laneIndex === 'number' ? { laneIndex: edge.laneIndex } : {}),
        ...(typeof edge.isForward === 'boolean' ? { isForward: edge.isForward } : {}),
        ...(edge.name ? { name: edge.name } : {}),
        speedLimit: edge.speedLimit,
        laneWidth: edge.laneWidth,
        turnRadius: edge.turnRadius,
        pedestrianIntensity: edge.pedestrianIntensity,
        pedestrianIntensityMode: edge.pedestrianIntensityMode,
        roadSlope: edge.roadSlope,
        parkingType: edge.parkingType,
        stopType: edge.stopType,
        stopTypeMode: edge.stopTypeMode,
        maneuverType: edge.maneuverType,
        turnPercentage: edge.turnPercentage,
        crossroad: edge.crossroad,
        busStop: edge.busStop,
        tags: edge.tags ?? {},
        description: buildEdgeDescription(edge, source, target),
      };
    }),
  };
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const asTag = (key: string, value: string): string =>
  `    <tag k="${escapeXml(key)}" v="${escapeXml(value)}"/>`;

const asLat = (lat: number): string => lat.toFixed(8);
const asLng = (lng: number): string => lng.toFixed(8);

const appendNodeXml = (
  lines: string[],
  osmId: number,
  lat: number,
  lng: number,
  tags: Record<string, string>,
) => {
  lines.push(`  <node id="${osmId}" lat="${asLat(lat)}" lon="${asLng(lng)}">`);
  Object.entries(tags).forEach(([key, value]) => {
    if (value !== '') lines.push(asTag(key, value));
  });
  lines.push('  </node>');
};

const nodeTagsFromType = (node: ExportNode): Record<string, string> => {
  const tags: Record<string, string> = {
    'kritibi:node_id': node.id,
    'kritibi:node_type': node.type,
  };

  if (node.type === 'traffic_light') tags.highway = 'traffic_signals';
  if (node.type === 'crossing') tags.highway = 'crossing';
  if (node.type === 'bus_stop') {
    tags.highway = 'bus_stop';
    tags.public_transport = 'platform';
  }
  if (node.type === 'speed_limit') {
    tags['kritibi:feature'] = 'speed_limit';
    if (typeof node.speedLimit === 'number') tags.maxspeed = String(node.speedLimit);
  }
  if (node.name) tags.name = node.name;
  return tags;
};

const toWayTags = (edge: ExportEdge): Record<string, string> => {
  const tags: Record<string, string> = {
    highway: edge.tags.highway || 'service',
    oneway: edge.isOneWay ? 'yes' : 'no',
    maxspeed: String(edge.speedLimit),
    'kritibi:edge_id': edge.id,
    'kritibi:source_id': edge.sourceId,
    'kritibi:target_id': edge.targetId,
    'kritibi:crossroad': edge.crossroad ? 'yes' : 'no',
    'kritibi:bus_stop': edge.busStop ? 'yes' : 'no',
    'kritibi:lane_width': String(edge.laneWidth),
    'kritibi:turn_radius': String(edge.turnRadius),
    'kritibi:pedestrian_intensity': String(edge.pedestrianIntensity),
    'kritibi:pedestrian_intensity_mode': edge.pedestrianIntensityMode,
    'kritibi:road_slope': String(edge.roadSlope),
    'kritibi:parking_type': String(edge.parkingType),
    'kritibi:stop_type': String(edge.stopType),
    'kritibi:stop_type_mode': edge.stopTypeMode,
    'kritibi:maneuver_type': String(edge.maneuverType),
    'kritibi:turn_percentage': String(edge.turnPercentage),
    description: edge.description,
  };

  if (edge.name) tags.name = edge.name;
  if (typeof edge.laneIndex === 'number') tags['kritibi:lane_index'] = String(edge.laneIndex);
  if (typeof edge.isForward === 'boolean') tags['kritibi:is_forward'] = edge.isForward ? 'yes' : 'no';

  Object.entries(edge.tags).forEach(([key, value]) => {
    if (!tags[key]) tags[key] = value;
  });

  return tags;
};

export const buildLaneNetworkOsmExport = (state: NetworkState): string => {
  const jsonExport = buildLaneNetworkJsonExport(state);
  const nodeIdMap = new Map<string, number>();
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<osm version="0.6" generator="kritibi_hack_2026">'];

  let nextNodeId = -1;
  let nextWayId = -1;

  jsonExport.nodes.forEach(node => {
    const osmNodeId = nextNodeId--;
    nodeIdMap.set(node.id, osmNodeId);
    appendNodeXml(lines, osmNodeId, node.lat, node.lng, nodeTagsFromType(node));
  });

  jsonExport.edges.forEach(edge => {
    const sourceNodeId = nodeIdMap.get(edge.sourceId);
    const targetNodeId = nodeIdMap.get(edge.targetId);
    if (!sourceNodeId || !targetNodeId) return;

    const wayNodeRefs: number[] = [sourceNodeId];

    edge.points.forEach((point, index) => {
      const shapeNodeId = nextNodeId--;
      appendNodeXml(lines, shapeNodeId, point.lat, point.lng, {
        'kritibi:shape_point': `${edge.id}:${index}`,
      });
      wayNodeRefs.push(shapeNodeId);
    });

    wayNodeRefs.push(targetNodeId);
    lines.push(`  <way id="${nextWayId--}">`);
    wayNodeRefs.forEach(ref => {
      lines.push(`    <nd ref="${ref}"/>`);
    });

    Object.entries(toWayTags(edge)).forEach(([key, value]) => {
      if (value !== '') lines.push(asTag(key, value));
    });
    lines.push('  </way>');
  });

  lines.push('</osm>');
  return lines.join('\n');
};

export const downloadTextFile = (content: string, fileName: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

