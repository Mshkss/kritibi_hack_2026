import { v4 as uuidv4 } from 'uuid';
import { NetworkState, Node, Edge, NodeType } from '../types';

const DEFAULT_SPEED_LIMIT = 60;
const KRITIBI_TAG_PREFIX = 'kritibi:';

type OsmNodeRecord = {
  id: string;
  lat: number;
  lng: number;
  tags: Record<string, string>;
};

const extractTags = (element: Element): Record<string, string> => {
  const tags: Record<string, string> = {};
  const tagElements = element.getElementsByTagName('tag');
  for (let i = 0; i < tagElements.length; i++) {
    const key = tagElements[i].getAttribute('k');
    if (!key) continue;
    tags[key] = tagElements[i].getAttribute('v') || '';
  }
  return tags;
};

const parseNumericValue = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalInt = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeNodeType = (value: string | undefined): NodeType => {
  if (value === 'default') return 'default';
  if (value === 'traffic_light') return 'traffic_light';
  if (value === 'crossing') return 'crossing';
  if (value === 'bus_stop') return 'bus_stop';
  if (value === 'speed_limit') return 'speed_limit';
  return 'default';
};

const hasKritibiTags = (xmlDoc: XMLDocument): boolean => {
  const tagElements = xmlDoc.getElementsByTagName('tag');
  for (let i = 0; i < tagElements.length; i++) {
    const key = tagElements[i].getAttribute('k');
    if (key === 'kritibi:edge_id' || key === 'kritibi:node_type') return true;
  }
  return false;
};

const parseKritibiLaneOsm = (xmlDoc: XMLDocument): NetworkState => {
  const osmNodes: Record<string, OsmNodeRecord> = {};
  const finalNodes: Record<string, Node> = {};
  const finalEdges: Record<string, Edge> = {};

  const nodeElements = xmlDoc.getElementsByTagName('node');
  for (let i = 0; i < nodeElements.length; i++) {
    const element = nodeElements[i];
    const osmId = element.getAttribute('id');
    if (!osmId) continue;

    const lat = Number.parseFloat(element.getAttribute('lat') || '0');
    const lng = Number.parseFloat(element.getAttribute('lon') || '0');
    const tags = extractTags(element);

    osmNodes[osmId] = { id: osmId, lat, lng, tags };

    const graphNodeId = tags['kritibi:node_id'];
    const nodeTypeTag = tags['kritibi:node_type'];
    if (!graphNodeId || !nodeTypeTag) continue;

    const nodeType = normalizeNodeType(nodeTypeTag);
    const graphNode: Node = {
      id: graphNodeId,
      lat,
      lng,
      type: nodeType,
    };

    if (tags.name) graphNode.name = tags.name;
    if (nodeType === 'speed_limit') {
      const speed = parseNumericValue(tags.maxspeed);
      if (speed !== undefined) graphNode.speedLimit = speed;
    }
    finalNodes[graphNode.id] = graphNode;
  }

  const wayElements = xmlDoc.getElementsByTagName('way');
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i];
    const tags = extractTags(way);
    const edgeId = tags['kritibi:edge_id'];
    if (!edgeId) continue;

    const ndElements = way.getElementsByTagName('nd');
    const ndRefs: string[] = [];
    for (let j = 0; j < ndElements.length; j++) {
      const ref = ndElements[j].getAttribute('ref');
      if (ref) ndRefs.push(ref);
    }

    const firstNode = ndRefs.length > 0 ? osmNodes[ndRefs[0]] : undefined;
    const lastNode = ndRefs.length > 0 ? osmNodes[ndRefs[ndRefs.length - 1]] : undefined;

    const sourceId = tags['kritibi:source_id'] || firstNode?.tags['kritibi:node_id'];
    const targetId = tags['kritibi:target_id'] || lastNode?.tags['kritibi:node_id'];
    if (!sourceId || !targetId) continue;
    if (!finalNodes[sourceId] || !finalNodes[targetId]) continue;

    const points = ndRefs
      .slice(1, -1)
      .map(ref => osmNodes[ref])
      .filter((node): node is OsmNodeRecord => Boolean(node))
      .map(node => ({ lat: node.lat, lng: node.lng }));

    const speedLimit = parseNumericValue(tags.maxspeed) ?? DEFAULT_SPEED_LIMIT;
    const laneIndex = parseOptionalInt(tags['kritibi:lane_index']);
    const isForwardTag = tags['kritibi:is_forward'];

    const edgeTags: Record<string, string> = {};
    Object.entries(tags).forEach(([key, value]) => {
      if (!key.startsWith(KRITIBI_TAG_PREFIX)) edgeTags[key] = value;
    });

    const edge: Edge = {
      id: edgeId,
      sourceId,
      targetId,
      points,
      isOneWay: tags.oneway === 'yes',
      crossroad: tags['kritibi:crossroad'] === 'yes',
      busStop: tags['kritibi:bus_stop'] === 'yes',
      speedLimit,
      tags: edgeTags,
    };

    if (tags.name) edge.name = tags.name;
    if (laneIndex !== undefined) edge.laneIndex = laneIndex;
    if (isForwardTag !== undefined) edge.isForward = isForwardTag === 'yes';
    finalEdges[edge.id] = edge;
  }

  return { nodes: finalNodes, edges: finalEdges };
};

const parseGenericOsm = (xmlDoc: XMLDocument): NetworkState => {
  type RawNode = {
    id: string;
    lat: number;
    lng: number;
    isTrafficLight: boolean;
    isCrossing: boolean;
    isBusStop: boolean;
  };

  type WayCandidate = {
    id: string;
    wayNodeIds: string[];
    lanesForward: number;
    lanesBackward: number;
    name: string;
    tags: Record<string, string>;
  };

  const rawNodes: Record<string, RawNode> = {};
  const nodeUsageCount: Record<string, number> = {};

  const excludedHighways = ['footway', 'path', 'cycleway', 'track', 'service', 'living_street', 'pedestrian'];

  const nodeElements = xmlDoc.getElementsByTagName('node');
  for (let i = 0; i < nodeElements.length; i++) {
    const el = nodeElements[i];
    const id = el.getAttribute('id');
    const lat = Number.parseFloat(el.getAttribute('lat') || '0');
    const lng = Number.parseFloat(el.getAttribute('lon') || '0');

    let isTrafficLight = false;
    let isCrossing = false;
    let isBusStop = false;
    const tags = el.getElementsByTagName('tag');
    for (let j = 0; j < tags.length; j++) {
      const key = tags[j].getAttribute('k');
      const value = tags[j].getAttribute('v');
      if (key === 'highway' && value === 'traffic_signals') isTrafficLight = true;
      if (key === 'highway' && value === 'crossing') isCrossing = true;
      // Do not treat stop_position as a visible stop marker:
      // it is often located on the carriageway and duplicates the platform/bus_stop.
      if ((key === 'highway' && value === 'bus_stop') || (key === 'public_transport' && value === 'platform')) {
        isBusStop = true;
      }
    }

    if (id) {
      rawNodes[id] = { id, lat, lng, isTrafficLight, isCrossing, isBusStop };
      nodeUsageCount[id] = 0;
    }
  }

  const ways: WayCandidate[] = [];
  const wayElements = xmlDoc.getElementsByTagName('way');
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i];
    const wayId = way.getAttribute('id') || uuidv4();
    let isHighway = false;
    let isOneWay = false;
    let lanes = 0;
    let lanesForward = 0;
    let lanesBackward = 0;
    let name = '';
    const tagsMap: Record<string, string> = {};

    const tags = way.getElementsByTagName('tag');
    for (let j = 0; j < tags.length; j++) {
      const key = tags[j].getAttribute('k');
      const value = tags[j].getAttribute('v');
      if (key) tagsMap[key] = value || '';
      if (key === 'highway') {
        if (!excludedHighways.includes(value || '')) isHighway = true;
      }
      if (key === 'oneway' && value === 'yes') isOneWay = true;
      if (key === 'name' && value) name = value;
      if (key === 'lanes' && value) lanes = Number.parseInt(value, 10);
      if (key === 'lanes:forward' && value) lanesForward = Number.parseInt(value, 10);
      if (key === 'lanes:backward' && value) lanesBackward = Number.parseInt(value, 10);
    }

    if (isHighway) {
      const nds = way.getElementsByTagName('nd');
      const wayNodeIds: string[] = [];
      for (let j = 0; j < nds.length; j++) {
        const ref = nds[j].getAttribute('ref');
        if (ref && rawNodes[ref]) {
          wayNodeIds.push(ref);
          nodeUsageCount[ref]++;
        }
      }

      if (wayNodeIds.length > 1) {
        if (lanesForward === 0 && lanesBackward === 0) {
          if (isOneWay) {
            lanesForward = lanes > 0 ? lanes : 1;
            lanesBackward = 0;
          } else {
            const total = lanes > 0 ? lanes : 2;
            lanesForward = Math.ceil(total / 2);
            lanesBackward = Math.floor(total / 2);
          }
        }
        ways.push({ id: wayId, wayNodeIds, lanesForward, lanesBackward, name, tags: tagsMap });
      }
    }
  }

  const finalNodes: Record<string, Node> = {};
  const finalEdges: Record<string, Edge> = {};
  const nodesByOrigNode: Record<string, string[]> = {};

  const getOffsetLatLng = (lat: number, lng: number, nx: number, ny: number, offsetMeters: number) => {
    const dx = nx * offsetMeters;
    const dy = ny * offsetMeters;
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos(lat * Math.PI / 180));
    return { lat: lat + dLat, lng: lng + dLng };
  };

  ways.forEach(way => {
    const { id: wayId, wayNodeIds, lanesForward, lanesBackward, name, tags } = way;
    const totalLanes = lanesForward + lanesBackward;

    const normals: { nx: number; ny: number }[] = [];
    for (let i = 0; i < wayNodeIds.length; i++) {
      const curr = rawNodes[wayNodeIds[i]];
      let dx = 0;
      let dy = 0;

      if (i > 0) {
        const prev = rawNodes[wayNodeIds[i - 1]];
        dx += (curr.lng - prev.lng) * 111320 * Math.cos(curr.lat * Math.PI / 180);
        dy += (curr.lat - prev.lat) * 111320;
      }
      if (i < wayNodeIds.length - 1) {
        const next = rawNodes[wayNodeIds[i + 1]];
        dx += (next.lng - curr.lng) * 111320 * Math.cos(curr.lat * Math.PI / 180);
        dy += (next.lat - curr.lat) * 111320;
      }

      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        normals.push({ nx: -dy / len, ny: dx / len });
      } else {
        normals.push({ nx: 0, ny: 1 });
      }
    }

    for (let laneIdx = 0; laneIdx < totalLanes; laneIdx++) {
      const isForward = laneIdx >= lanesBackward;
      const offsetMeters = ((totalLanes - 1) / 2 - laneIdx) * 3.5;

      let prevLaneNodeId: string | null = null;

      for (let i = 0; i < wayNodeIds.length; i++) {
        const origNodeId = wayNodeIds[i];
        const origNode = rawNodes[origNodeId];
        const normal = normals[i];

        const { lat, lng } = getOffsetLatLng(origNode.lat, origNode.lng, normal.nx, normal.ny, offsetMeters);
        const laneNodeId = `${wayId}_${origNodeId}_lane_${laneIdx}`;

        if (!nodesByOrigNode[origNodeId]) nodesByOrigNode[origNodeId] = [];
        if (!nodesByOrigNode[origNodeId].includes(laneNodeId)) nodesByOrigNode[origNodeId].push(laneNodeId);

        if (!finalNodes[laneNodeId]) {
          finalNodes[laneNodeId] = {
            id: laneNodeId,
            lat,
            lng,
            type: 'default',
          };
        }

        if (prevLaneNodeId) {
          const edgeId = uuidv4();
          const sourceId = isForward ? prevLaneNodeId : laneNodeId;
          const targetId = isForward ? laneNodeId : prevLaneNodeId;

          finalEdges[edgeId] = {
            id: edgeId,
            sourceId,
            targetId,
            points: [],
            isOneWay: true,
            crossroad: false,
            busStop: false,
            speedLimit: DEFAULT_SPEED_LIMIT,
            name: name ? `${name} (Полоса ${laneIdx + 1})` : `Полоса ${laneIdx + 1}`,
            laneIndex: laneIdx,
            isForward,
            tags,
          };
        }

        prevLaneNodeId = laneNodeId;
      }
    }
  });

  Object.keys(nodesByOrigNode).forEach(origNodeId => {
    if (nodeUsageCount[origNodeId] > 1) {
      const laneNodes = nodesByOrigNode[origNodeId];
      const nodesByLaneIdx: Record<number, string[]> = {};

      laneNodes.forEach(nodeId => {
        const parts = nodeId.split('_lane_');
        const laneIdx = Number.parseInt(parts[1], 10);
        if (!nodesByLaneIdx[laneIdx]) nodesByLaneIdx[laneIdx] = [];
        nodesByLaneIdx[laneIdx].push(nodeId);
      });

      Object.values(nodesByLaneIdx).forEach(nodesInLane => {
        // Intersection connectors may be almost zero-length after lane offset projection.
        // Runtime vehicle simulation must still preserve and traverse these hidden links.
        for (let i = 0; i < nodesInLane.length; i++) {
          for (let j = i + 1; j < nodesInLane.length; j++) {
            const edgeId = uuidv4();
            finalEdges[edgeId] = {
              id: edgeId,
              sourceId: nodesInLane[i],
              targetId: nodesInLane[j],
              points: [],
              isOneWay: false,
              crossroad: false,
              busStop: false,
              speedLimit: DEFAULT_SPEED_LIMIT,
              name: 'Соединение перекрёстка',
            };
          }
        }
      });
    }
  });

  Object.keys(nodeUsageCount).forEach(origNodeId => {
    const origNode = rawNodes[origNodeId];
    if (origNode.isTrafficLight || origNode.isCrossing || origNode.isBusStop) {
      let type: NodeType = 'default';
      let name = '';
      if (origNode.isTrafficLight) {
        type = 'traffic_light';
        name = 'Светофор';
      } else if (origNode.isCrossing) {
        type = 'crossing';
        name = 'Пешеходный переход';
      } else if (origNode.isBusStop) {
        type = 'bus_stop';
        name = 'Остановка';
      }

      finalNodes[origNodeId] = {
        id: origNodeId,
        lat: origNode.lat,
        lng: origNode.lng,
        type,
        name,
      };
    }
  });

  return { nodes: finalNodes, edges: finalEdges };
};

export function parseOSM(xmlString: string): NetworkState {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  if (hasKritibiTags(xmlDoc)) return parseKritibiLaneOsm(xmlDoc);
  return parseGenericOsm(xmlDoc);
}
