import React from 'react';
import { MousePointer2, MapPin, Route, Trash2, Undo, Redo, Upload, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { ValidationResult } from '../utils/graphValidation';
import { Edge } from '../types';

type IconProps = { className?: string };

function TrafficLightIconV1({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="3.5" width="10" height="17" rx="3" />
      <circle cx="12" cy="7.2" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="12" cy="16.8" r="1.25" />
    </svg>
  );
}

function TrafficLightIconV2({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="15" rx="2.2" />
      <circle cx="12" cy="6" r="1.3" fill="currentColor" opacity="0.95" />
      <circle cx="12" cy="10" r="1.3" fill="currentColor" opacity="0.65" />
      <circle cx="12" cy="14" r="1.3" fill="currentColor" opacity="0.35" />
      <path d="M12 17.5v4" />
    </svg>
  );
}

function TrafficLightIconV3({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="8" y="2.5" width="8" height="15" rx="2" />
      <circle cx="12" cy="6" r="1.15" />
      <circle cx="12" cy="10" r="1.15" />
      <circle cx="12" cy="14" r="1.15" />
      <path d="M10 6h4M10 10h4M10 14h4" />
      <path d="M12 17.5v4" />
    </svg>
  );
}

function TrafficLightIconV4({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="15" rx="2.4" />
      <path d="M6.5 8h11M6.5 12h11" />
      <circle cx="12" cy="5.2" r="1.05" />
      <circle cx="12" cy="9.9" r="1.05" />
      <circle cx="12" cy="14.6" r="1.05" />
      <path d="M12 17.5v4" />
    </svg>
  );
}

function TrafficLightIconV5({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="15" rx="2" />
      <circle cx="12" cy="6" r="1.2" />
      <circle cx="12" cy="10" r="1.2" />
      <circle cx="12" cy="14" r="1.2" />
      <path d="M9.5 2.5V1M14.5 2.5V1" />
      <path d="M12 17.5v4" />
      <path d="M10.5 21h3" />
    </svg>
  );
}

const TRAFFIC_LIGHT_ICON_VARIANT = 1;
const trafficLightIconByVariant: Record<number, React.ComponentType<IconProps>> = {
  1: TrafficLightIconV1,
  2: TrafficLightIconV2,
  3: TrafficLightIconV3,
  4: TrafficLightIconV4,
  5: TrafficLightIconV5,
};
const TrafficLightIcon = trafficLightIconByVariant[TRAFFIC_LIGHT_ICON_VARIANT] || TrafficLightIconV1;

function ZebraCrossingIconV1({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="6.5" width="16" height="11" rx="2.5" />
      <path d="M6.8 16.5 9.2 7.5" />
      <path d="M10.4 16.5 12.8 7.5" />
      <path d="M14 16.5 16.4 7.5" />
      <path d="M17.6 16.5 19.2 10.5" />
    </svg>
  );
}

function ZebraCrossingIconV2({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4.5" y="6.5" width="15" height="11" rx="2.2" />
      <path d="M6.8 16.5 8.6 7.5" />
      <path d="M10.2 16.5 12 7.5" />
      <path d="M13.6 16.5 15.4 7.5" />
      <path d="M17 16.5 18.8 7.5" />
    </svg>
  );
}

function ZebraCrossingIconV3({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="7" width="16" height="10" rx="2.8" />
      <path d="M6 15.5h2.2L10 8.5H7.8Z" />
      <path d="M10 15.5h2.2L14 8.5H11.8Z" />
      <path d="M14 15.5h2.2L18 8.5H15.8Z" />
    </svg>
  );
}

function ZebraCrossingIconV4({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="6.5" width="16" height="11" rx="2.2" />
      <path d="M7 16.2 9.1 7.8" />
      <path d="M9.9 16.2 12 7.8" />
      <path d="M12.8 16.2 14.9 7.8" />
      <path d="M15.7 16.2 17.8 7.8" />
      <path d="M5 12h14" opacity="0.35" />
    </svg>
  );
}

function ZebraCrossingIconV5({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 8.5h14" />
      <path d="M5 15.5h14" />
      <path d="M6.8 15.5 8.8 8.5" />
      <path d="M10.3 15.5 12.3 8.5" />
      <path d="M13.8 15.5 15.8 8.5" />
      <path d="M17.3 15.5 18.7 10.6" />
      <rect x="4" y="6.5" width="16" height="11" rx="2.4" />
    </svg>
  );
}

const ZEBRA_ICON_VARIANT = 1;
const zebraCrossingIconByVariant: Record<number, React.ComponentType<IconProps>> = {
  1: ZebraCrossingIconV1,
  2: ZebraCrossingIconV2,
  3: ZebraCrossingIconV3,
  4: ZebraCrossingIconV4,
  5: ZebraCrossingIconV5,
};
const ZebraCrossingIcon = zebraCrossingIconByVariant[ZEBRA_ICON_VARIANT] || ZebraCrossingIconV1;

function BusStopMonoIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 16l3-8 3 8" />
      <path d="M10.3 13h3.4" />
    </svg>
  );
}

function SpeedLimitMonoIcon({ className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v4.8" strokeWidth="2" />
      <circle cx="12" cy="16.3" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

type SidebarProps = {
  mode: string;
  setMode: (mode: any) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportJson: () => void;
  onExportOsm: () => void;
  onValidate: () => void;
  validationResult: ValidationResult | null;
  selectedEdge: Edge | null;
  toggleOneWay: (id: string) => void;
  carCountInput: string;
  onCarCountInputChange: (value: string) => void;
  onApplyCarCount: () => void;
  onClearCars: () => void;
  activeCarCount: number;
  carCountError: string;
};

export function Sidebar({ 
  mode, setMode, canUndo, canRedo, undo, redo, 
  onFileUpload, onExportJson, onExportOsm, onValidate, validationResult,
  selectedEdge, toggleOneWay,
  carCountInput, onCarCountInputChange, onApplyCarCount, onClearCars, activeCarCount, carCountError
}: SidebarProps) {
  
  const tools = [
    { id: 'SELECT', icon: MousePointer2, label: 'Выбрать и переместить' },
    { id: 'ADD_NODE', icon: MapPin, label: 'Добавить узел полосы' },
    { id: 'ADD_TRAFFIC_LIGHT', icon: TrafficLightIcon, label: 'Добавить светофор' },
    { id: 'ADD_CROSSING', icon: ZebraCrossingIcon, label: 'Добавить переход' },
    { id: 'ADD_BUS_STOP', icon: BusStopMonoIcon, label: 'Добавить остановку' },
    { id: 'ADD_SPEED_LIMIT', icon: SpeedLimitMonoIcon, label: 'Добавить предел скорости' },
    { id: 'ADD_EDGE', icon: Route, label: 'Добавить полосу (ребро)' },
    { id: 'DELETE', icon: Trash2, label: 'Удалить' },
  ];

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h1 className="text-lg font-bold text-gray-800">Сеть полос</h1>
        <p className="text-xs text-gray-500">Прототип конструктора</p>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Инструменты</h2>
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
              <tool.icon
                className={`w-5 h-5 mr-3 ${
                  tool.id === 'ADD_TRAFFIC_LIGHT'
                    ? 'scale-130 opacity-90'
                    : tool.id === 'ADD_CROSSING'
                      ? 'scale-130 opacity-90'
                      : tool.id === 'ADD_BUS_STOP'
                        ? 'scale-125 opacity-90'
                        : tool.id === 'ADD_SPEED_LIMIT'
                          ? 'scale-150 opacity-90'
                      : ''
                }`}
              />
              {tool.label}
            </button>
          ))}
        </div>
        
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Действия</h2>
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={undo} disabled={!canUndo}
            className="flex-1 flex justify-center items-center py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-gray-700"
            title="Отменить"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button 
            onClick={redo} disabled={!canRedo}
            className="flex-1 flex justify-center items-center py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-gray-700"
            title="Повторить"
          >
            <Redo className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <label className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
            <Upload className="w-5 h-5 mr-2" />
            Импорт OSM
            <input type="file" accept=".osm" className="hidden" onChange={onFileUpload} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2 mb-6">
          <button
            onClick={onExportJson}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Export JSON
          </button>
          <button
            onClick={onExportOsm}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Export OSM
          </button>
        </div>

        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Поток машин</h2>
        <div className="mb-6 p-3 bg-slate-50 rounded-md border border-slate-200">
          <label className="block text-xs font-medium text-gray-600 mb-2">Количество машин (1-100)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={carCountInput}
              onChange={(e) => onCarCountInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onApplyCarCount();
              }}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="например, 25"
            />
            <button
              onClick={onApplyCarCount}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Применить
            </button>
          </div>
          <button
            onClick={onClearCars}
            className="mt-2 w-full px-3 py-1.5 rounded-md text-sm font-medium text-white bg-rose-600 hover:bg-rose-700"
          >
            Удалить машины
          </button>
          {carCountError && (
            <p className="mt-2 text-xs text-red-600">{carCountError}</p>
          )}
          <p className="mt-2 text-xs text-gray-600">Сейчас машин: {activeCarCount}</p>
        </div>
        
        {selectedEdge && (
          <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Выбранная полоса</h3>
            <p className="text-xs text-gray-600 mb-2">{selectedEdge.name || 'Без названия'}</p>
            <label className="flex items-center text-sm text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedEdge.isOneWay}
                onChange={() => toggleOneWay(selectedEdge.id)}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Односторонняя полоса
            </label>
          </div>
        )}
        
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Проверка</h2>
        <button
          onClick={onValidate}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          Проверить граф
        </button>
        
        {validationResult && (
          <div className={`mt-4 p-3 rounded-md text-sm ${validationResult.isValid && validationResult.warnings.length === 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            {validationResult.isValid && validationResult.warnings.length === 0 ? (
              <p className="flex items-center"><CheckCircle className="w-5 h-5 mr-1" /> Сеть корректна</p>
            ) : (
              <div>
                <p className="flex items-center font-medium mb-1"><AlertTriangle className="w-5 h-5 mr-1" /> Найдены проблемы:</p>
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
