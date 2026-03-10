import type {Edge, Node, Point, ProjectNetwork} from '@/types/api';
import type {NetworkMaps, ViewBoxState} from '@/types/editor';
import {makeShortId} from '@/utils/id';

export function buildNetworkMaps(network: ProjectNetwork | null): NetworkMaps {
  const nodesById: Record<string, Node> = {};
  const edgesById: Record<string, Edge> = {};
  const incomingByNodeId: Record<string, Edge[]> = {};
  const outgoingByNodeId: Record<string, Edge[]> = {};

  if (!network) {
    return {nodesById, edgesById, incomingByNodeId, outgoingByNodeId};
  }

  for (const node of network.nodes) {
    nodesById[node.id] = node;
    incomingByNodeId[node.id] = [];
    outgoingByNodeId[node.id] = [];
  }

  for (const edge of network.edges) {
    edgesById[edge.id] = edge;
    incomingByNodeId[edge.to_node_id] = incomingByNodeId[edge.to_node_id] || [];
    outgoingByNodeId[edge.from_node_id] = outgoingByNodeId[edge.from_node_id] || [];
    incomingByNodeId[edge.to_node_id].push(edge);
    outgoingByNodeId[edge.from_node_id].push(edge);
  }

  return {nodesById, edgesById, incomingByNodeId, outgoingByNodeId};
}

export function computeBounds(network: ProjectNetwork | null): ViewBoxState {
  if (!network || network.nodes.length === 0) {
    return {x: -100, y: -100, width: 200, height: 200};
  }

  const xs = network.nodes.map((node) => node.x);
  const ys = network.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 200);
  const height = Math.max(maxY - minY, 200);
  const paddingX = width * 0.2;
  const paddingY = height * 0.2;

  return {
    x: minX - paddingX,
    y: minY - paddingY,
    width: width + paddingX * 2,
    height: height + paddingY * 2,
  };
}

export function getEdgeLine(edge: Edge, nodesById: Record<string, Node>): [Point, Point] | null {
  const from = nodesById[edge.from_node_id];
  const to = nodesById[edge.to_node_id];
  if (!from || !to) {
    return null;
  }
  return [
    {x: from.x, y: from.y},
    {x: to.x, y: to.y},
  ];
}

export function getEdgeMidpoint(edge: Edge, nodesById: Record<string, Node>): Point | null {
  const line = getEdgeLine(edge, nodesById);
  if (!line) {
    return null;
  }
  return {
    x: (line[0].x + line[1].x) / 2,
    y: (line[0].y + line[1].y) / 2,
  };
}

export function formatLaneSummary(edge: Edge): string {
  if (edge.lanes.length === 0) {
    return 'Нет данных по полосам';
  }
  return edge.lanes
    .map((lane) => `L${lane.index}${lane.width ? `:${lane.width.toFixed(1)}m` : ''}`)
    .join(', ');
}

export function createEntityCode(prefix: 'N' | 'E' | 'RT'): string {
  return `${prefix}-${makeShortId(8)}`;
}
