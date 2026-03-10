import React from 'react';
import { MousePointer2, MapPin, Route, Trash2, Undo, Redo, Upload, CheckCircle, AlertTriangle, CircleDot, Crosshair } from 'lucide-react';
import { ValidationResult } from '../utils/graphValidation';
import { Edge } from '../types';

type SidebarProps = {
  mode: string;
  setMode: (mode: any) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValidate: () => void;
  validationResult: ValidationResult | null;
  selectedEdge: Edge | null;
  toggleOneWay: (id: string) => void;
};

export function Sidebar({ 
  mode, setMode, canUndo, canRedo, undo, redo, 
  onFileUpload, onValidate, validationResult,
  selectedEdge, toggleOneWay
}: SidebarProps) {
  
  const tools = [
    { id: 'SELECT', icon: MousePointer2, label: 'Select & Move' },
    { id: 'ADD_NODE', icon: MapPin, label: 'Add Lane Node' },
    { id: 'ADD_TRAFFIC_LIGHT', icon: CircleDot, label: 'Add Traffic Light' },
    { id: 'ADD_CROSSING', icon: Crosshair, label: 'Add Crossing' },
    { id: 'ADD_BUS_STOP', icon: MapPin, label: 'Add Bus Stop' },
    { id: 'ADD_EDGE', icon: Route, label: 'Add Lane (Edge)' },
    { id: 'DELETE', icon: Trash2, label: 'Delete' },
  ];

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h1 className="text-lg font-bold text-gray-800">Lane Network</h1>
        <p className="text-xs text-gray-500">Constructor Prototype</p>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tools</h2>
        <div className="space-y-2 mb-6">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setMode(tool.id)}
              className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                mode === tool.id 
                  ? 'bg-blue-100 text-blue-700 font-medium' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tool.icon className="w-4 h-4 mr-3" />
              {tool.label}
            </button>
          ))}
        </div>
        
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Actions</h2>
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={undo} disabled={!canUndo}
            className="flex-1 flex justify-center items-center py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-gray-700"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button 
            onClick={redo} disabled={!canRedo}
            className="flex-1 flex justify-center items-center py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-gray-700"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mb-6">
          <label className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Import OSM
            <input type="file" accept=".osm" className="hidden" onChange={onFileUpload} />
          </label>
        </div>
        
        {selectedEdge && (
          <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Selected Lane</h3>
            <p className="text-xs text-gray-600 mb-2">{selectedEdge.name || 'Unnamed Lane'}</p>
            <label className="flex items-center text-sm text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedEdge.isOneWay}
                onChange={() => toggleOneWay(selectedEdge.id)}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              One-way lane
            </label>
          </div>
        )}
        
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Validation</h2>
        <button
          onClick={onValidate}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Validate Network
        </button>
        
        {validationResult && (
          <div className={`mt-4 p-3 rounded-md text-sm ${validationResult.isValid && validationResult.warnings.length === 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            {validationResult.isValid && validationResult.warnings.length === 0 ? (
              <p className="flex items-center"><CheckCircle className="w-4 h-4 mr-1" /> Network is valid</p>
            ) : (
              <div>
                <p className="flex items-center font-medium mb-1"><AlertTriangle className="w-4 h-4 mr-1" /> Issues found:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
