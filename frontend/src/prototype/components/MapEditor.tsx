import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import { NetworkState, Node, Edge, NodeType } from '../types';
import { Sidebar } from './Sidebar';
import { parseOSM } from '../utils/osmParser';
import { validateNetwork, ValidationResult } from '../utils/graphValidation';

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
  html: '<div style="background-color: #3b82f6; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
  iconSize: [8, 8],
  iconAnchor: [4, 4]
});

const selectedNodeIcon = L.divIcon({
  className: 'custom-node-icon-selected',
  html: '<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const trafficLightIcon = L.divIcon({
  className: 'custom-tl-icon',
  html: '<div style="background-color: #333; width: 14px; height: 24px; border-radius: 4px; border: 1px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;"><div style="background: #ef4444; width: 6px; height: 6px; border-radius: 50%"></div><div style="background: #eab308; width: 6px; height: 6px; border-radius: 50%"></div><div style="background: #22c55e; width: 6px; height: 6px; border-radius: 50%"></div></div>',
  iconSize: [14, 24],
  iconAnchor: [7, 12]
});

const crossingIcon = L.divIcon({
  className: 'custom-cross-icon',
  html: '<div style="background-color: #ffffff; width: 16px; height: 16px; border: 2px solid #333; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; font-size: 10px; font-weight: bold;">=</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const busStopIcon = L.divIcon({
  className: 'custom-bus-icon',
  html: '<div style="background-color: #007bff; width: 16px; height: 16px; border-radius: 4px; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; color: white; font-size: 10px; font-weight: bold;">B</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const getIconForNode = (node: Node, isSelected: boolean) => {
  if (isSelected) return selectedNodeIcon;
  if (node.type === 'traffic_light') return trafficLightIcon;
  if (node.type === 'crossing') return crossingIcon;
  if (node.type === 'bus_stop') return busStopIcon;
  return nodeIcon;
};

type Mode = 'SELECT' | 'ADD_NODE' | 'ADD_TRAFFIC_LIGHT' | 'ADD_CROSSING' | 'ADD_BUS_STOP' | 'ADD_EDGE' | 'DELETE';

export function MapEditor() {
  const [history, setHistory] = useState<NetworkState[]>([{ nodes: {}, edges: {} }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  const state = history[currentIndex];
  
  const pushState = (newState: NetworkState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setCurrentIndex(prev => prev + 1);
  };
  
  const undo = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const redo = () => setCurrentIndex(prev => Math.min(history.length - 1, prev + 1));
  
  const [mode, setMode] = useState<Mode>('SELECT');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  const handleMapClick = (e: L.LeafletMouseEvent) => {
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
          isOneWay: true // Lanes are one-way by default
        };
        pushState({
          ...state,
          edges: { ...state.edges, [newEdge.id]: newEdge }
        });
        setSelectedNodeId(null);
      }
    }
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
  
  const handleEdgeAddPoint = (edgeId: string, e: L.LeafletMouseEvent) => {
    if (mode !== 'SELECT' || selectedEdgeId !== edgeId) return;
    e.originalEvent.stopPropagation();
    
    const edge = state.edges[edgeId];
    const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
    
    pushState({
      ...state,
      edges: {
        ...state.edges,
        [edgeId]: {
          ...edge,
          points: [...edge.points, newPoint]
        }
      }
    });
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
        alert("Error parsing OSM file");
      }
    };
    reader.readAsText(file);
  };
  
  const runValidation = () => {
    const result = validateNetwork(state);
    setValidationResult(result);
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
        onValidate={runValidation}
        validationResult={validationResult}
        selectedEdge={selectedEdgeId ? state.edges[selectedEdgeId] : null}
        toggleOneWay={toggleOneWay}
      />
      
      <div className="flex-1 relative">
        <MapContainer 
          center={[55.7558, 37.6173]} 
          zoom={13} 
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterer center={mapCenter} />
          <MapEvents />
          
          {(Object.values(state.edges) as Edge[]).map(edge => {
            const source = state.nodes[edge.sourceId];
            const target = state.nodes[edge.targetId];
            if (!source || !target) return null;
            
            // Check for nearby crossings (10m) and bus stops (15m)
            const nearbyCrossings = (Object.values(state.nodes) as Node[]).filter(node => 
              node.type === 'crossing' &&
              (L.latLng(source.lat, source.lng).distanceTo(L.latLng(node.lat, node.lng)) < 10 ||
               L.latLng(target.lat, target.lng).distanceTo(L.latLng(node.lat, node.lng)) < 10)
            );
            const nearbyBusStops = (Object.values(state.nodes) as Node[]).filter(node => 
              node.type === 'bus_stop' &&
              (L.latLng(source.lat, source.lng).distanceTo(L.latLng(node.lat, node.lng)) < 15 ||
               L.latLng(target.lat, target.lng).distanceTo(L.latLng(node.lat, node.lng)) < 15)
            );
            const hasCrossing = nearbyCrossings.length > 0;
            const hasBusStop = nearbyBusStops.length > 0;
            const hasNearby = hasCrossing || hasBusStop;
            
            const positions: [number, number][] = [
              [source.lat, source.lng],
              ...edge.points.map(p => [p.lat, p.lng] as [number, number]),
              [target.lat, target.lng]
            ];
            
            const isSelected = selectedEdgeId === edge.id;
            
            return (
              <React.Fragment key={edge.id}>
                <Polyline
                  positions={positions}
                  color={isSelected ? '#3b82f6' : (hasNearby ? '#f59e0b' : '#4b5563')}
                  weight={isSelected ? 6 : (hasNearby ? 5 : 3)}
                  opacity={0.8}
                  eventHandlers={{
                    click: (e) => handleEdgeClick(edge.id, e),
                    contextmenu: (e) => handleEdgeAddPoint(edge.id, e)
                  }}
                  pathOptions={{
                    dashArray: edge.isOneWay ? '10, 10' : undefined
                  }}
                >
                  <Tooltip sticky direction="center">
                    <div className="font-bold">{edge.name || 'Edge'}</div>
                    {hasCrossing && <div className="text-xs text-amber-700 font-bold">Near Crossing (10m)</div>}
                    {hasBusStop && <div className="text-xs text-blue-700 font-bold">Near Bus Stop (15m)</div>}
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
                      click: (e) => handlePointClick(edge.id, idx, e)
                    }}
                  />
                ))}
              </React.Fragment>
            );
          })}
          
          {(Object.values(state.nodes) as Node[]).map(node => (
            <Marker
              key={node.id}
              position={[node.lat, node.lng]}
              draggable={mode === 'SELECT'}
              icon={getIconForNode(node, selectedNodeId === node.id)}
              eventHandlers={{
                click: (e) => handleNodeClick(node.id, e),
                dragend: (e) => handleNodeDragEnd(node.id, e)
              }}
            >
              {node.name && <Tooltip>{node.name}</Tooltip>}
            </Marker>
          ))}
        </MapContainer>
        
        <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000] pointer-events-none">
          <p className="text-sm font-medium text-gray-700">
            {mode === 'SELECT' && "Click nodes/edges to select. Drag to move. Right-click edge to add point."}
            {mode === 'ADD_NODE' && "Click on map to add lane nodes."}
            {mode === 'ADD_TRAFFIC_LIGHT' && "Click on map to add a traffic light."}
            {mode === 'ADD_EDGE' && "Click a node, then another to connect them."}
            {mode === 'DELETE' && "Click nodes/edges/points to delete."}
          </p>
        </div>
      </div>
    </div>
  );
}
