import { v4 as uuidv4 } from 'uuid';
import { NetworkState, Node, Edge, NodeType } from '../types';

export function parseOSM(xmlString: string): NetworkState {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  
  const rawNodes: Record<string, any> = {};
  const nodeUsageCount: Record<string, number> = {};
  
  const excludedHighways = ['footway', 'path', 'cycleway', 'track', 'service', 'living_street', 'pedestrian'];
  
  const nodeElements = xmlDoc.getElementsByTagName("node");
  for (let i = 0; i < nodeElements.length; i++) {
    const el = nodeElements[i];
    const id = el.getAttribute("id");
    const lat = parseFloat(el.getAttribute("lat") || "0");
    const lng = parseFloat(el.getAttribute("lon") || "0");
    
    let isTrafficLight = false;
    let isCrossing = false;
    let isBusStop = false;
    const tags = el.getElementsByTagName("tag");
    for (let j = 0; j < tags.length; j++) {
      const k = tags[j].getAttribute("k");
      const v = tags[j].getAttribute("v");
      if (k === "highway" && v === "traffic_signals") isTrafficLight = true;
      if (k === "highway" && v === "crossing") isCrossing = true;
      if ((k === "highway" && v === "bus_stop") || (k === "public_transport" && v === "stop_position")) isBusStop = true;
    }
    
    if (id) {
      rawNodes[id] = { id, lat, lng, isTrafficLight, isCrossing, isBusStop };
      nodeUsageCount[id] = 0;
    }
  }
  
  const ways: any[] = [];
  const wayElements = xmlDoc.getElementsByTagName("way");
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i];
    const wayId = way.getAttribute("id") || uuidv4();
    let isHighway = false;
    let isOneWay = false;
    let lanes = 0;
    let lanesForward = 0;
    let lanesBackward = 0;
    let name = "";
    const tagsMap: Record<string, string> = {};
    
    const tags = way.getElementsByTagName("tag");
    for (let j = 0; j < tags.length; j++) {
      const k = tags[j].getAttribute("k");
      const v = tags[j].getAttribute("v");
      if (k) tagsMap[k] = v || "";
      if (k === "highway") {
        if (!excludedHighways.includes(v || '')) isHighway = true;
      }
      if (k === "oneway" && v === "yes") isOneWay = true;
      if (k === "name" && v) name = v;
      if (k === "lanes" && v) lanes = parseInt(v, 10);
      if (k === "lanes:forward" && v) lanesForward = parseInt(v, 10);
      if (k === "lanes:backward" && v) lanesBackward = parseInt(v, 10);
    }
    
    if (isHighway) {
      const nds = way.getElementsByTagName("nd");
      const wayNodeIds: string[] = [];
      for (let j = 0; j < nds.length; j++) {
        const ref = nds[j].getAttribute("ref");
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
    
    const normals: {nx: number, ny: number}[] = [];
    for (let i = 0; i < wayNodeIds.length; i++) {
      const curr = rawNodes[wayNodeIds[i]];
      let dx = 0, dy = 0;
      
      if (i > 0) {
        const prev = rawNodes[wayNodeIds[i-1]];
        dx += (curr.lng - prev.lng) * 111320 * Math.cos(curr.lat * Math.PI / 180);
        dy += (curr.lat - prev.lat) * 111320;
      }
      if (i < wayNodeIds.length - 1) {
        const next = rawNodes[wayNodeIds[i+1]];
        dx += (next.lng - curr.lng) * 111320 * Math.cos(curr.lat * Math.PI / 180);
        dy += (next.lat - curr.lat) * 111320;
      }
      
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0) {
        normals.push({ nx: -dy/len, ny: dx/len });
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
            type: 'default'
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
            name: name ? `${name} (Lane ${laneIdx + 1})` : `Lane ${laneIdx + 1}`,
            laneIndex: laneIdx,
            isForward,
            tags
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
        const laneIdx = parseInt(parts[1], 10);
        if (!nodesByLaneIdx[laneIdx]) nodesByLaneIdx[laneIdx] = [];
        nodesByLaneIdx[laneIdx].push(nodeId);
      });
      
      Object.values(nodesByLaneIdx).forEach(nodesInLane => {
        for (let i = 0; i < nodesInLane.length; i++) {
          for (let j = i + 1; j < nodesInLane.length; j++) {
            const edgeId = uuidv4();
            finalEdges[edgeId] = {
              id: edgeId,
              sourceId: nodesInLane[i],
              targetId: nodesInLane[j],
              points: [],
              isOneWay: false,
              name: 'Intersection Connection'
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
      if (origNode.isTrafficLight) { type = 'traffic_light'; name = 'Traffic Light'; }
      else if (origNode.isCrossing) { type = 'crossing'; name = 'Crossing'; }
      else if (origNode.isBusStop) { type = 'bus_stop'; name = 'Bus Stop'; }
      
      finalNodes[origNodeId] = {
        id: origNodeId,
        lat: origNode.lat,
        lng: origNode.lng,
        type,
        name
      };
    }
  });
  
  return { nodes: finalNodes, edges: finalEdges };
}
