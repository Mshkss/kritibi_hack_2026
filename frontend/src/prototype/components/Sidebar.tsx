import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  MapPin,
  MousePointer2,
  Redo,
  Route,
  Trash2,
  Undo,
  Upload,
} from 'lucide-react';
import { ValidationResult } from '../utils/graphValidation';
import { MAX_EDGE_CAPACITY, NetworkCoefficientSummary } from '../utils/edgeCoefficients';

type IconProps = { className?: string };

function TrafficLightIcon({ className = '' }: IconProps) {
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

function ZebraCrossingIcon({ className = '' }: IconProps) {
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

function BusStopIcon({ className = '' }: IconProps) {
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

function SpeedLimitIcon({ className = '' }: IconProps) {
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
  carCountInput: string;
  onCarCountInputChange: (value: string) => void;
  onApplyCarCount: () => void;
  onClearCars: () => void;
  activeCarCount: number;
  carCountError: string;
  coefficientSummary: NetworkCoefficientSummary;
};

const formatCoefficient = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : '-';

const formatCapacity = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-';

const formatSpeed = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '-';

export function Sidebar({
  mode,
  setMode,
  canUndo,
  canRedo,
  undo,
  redo,
  onFileUpload,
  onExportJson,
  onExportOsm,
  onValidate,
  validationResult,
  carCountInput,
  onCarCountInputChange,
  onApplyCarCount,
  onClearCars,
  activeCarCount,
  carCountError,
  coefficientSummary,
}: SidebarProps) {
  const sortedTrafficLightGroups = [...coefficientSummary.groups].sort((a, b) => {
    const aComplete = a.isComplete && !!a.endLightId;
    const bComplete = b.isComplete && !!b.endLightId;
    if (aComplete !== bComplete) return aComplete ? -1 : 1;

    const startCmp = a.startLightLabel.localeCompare(b.startLightLabel);
    if (startCmp !== 0) return startCmp;

    const endA = a.endLightLabel ?? '';
    const endB = b.endLightLabel ?? '';
    const endCmp = endA.localeCompare(endB);
    if (endCmp !== 0) return endCmp;

    return a.id.localeCompare(b.id);
  });

  const tools = [
    { id: 'SELECT', icon: MousePointer2, label: 'Выбрать и переместить' },
    { id: 'ADD_NODE', icon: MapPin, label: 'Добавить узел полосы' },
    { id: 'ADD_TRAFFIC_LIGHT', icon: TrafficLightIcon, label: 'Добавить светофор' },
    { id: 'ADD_CROSSING', icon: ZebraCrossingIcon, label: 'Добавить переход' },
    { id: 'ADD_BUS_STOP', icon: BusStopIcon, label: 'Добавить остановку' },
    { id: 'ADD_SPEED_LIMIT', icon: SpeedLimitIcon, label: 'Добавить знак скорости' },
    { id: 'ADD_EDGE', icon: Route, label: 'Добавить ребро полосы' },
    { id: 'DELETE', icon: Trash2, label: 'Удаление' },
  ];

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-lg z-10">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h1 className="text-lg font-bold text-gray-800">Сеть полос</h1>
        <p className="text-xs text-gray-500">Интерактивный редактор</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Инструменты</h2>
        <div className="space-y-2 mb-6">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setMode(tool.id)}
              className={`w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
                mode === tool.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
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
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 flex justify-center items-center py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-gray-700"
            title="Отменить"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
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
            Экспорт JSON
          </button>
          <button
            onClick={onExportOsm}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Экспорт OSM
          </button>
        </div>

        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Поток транспорта</h2>
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
            Убрать машины
          </button>
          {carCountError && <p className="mt-2 text-xs text-red-600">{carCountError}</p>}
          <p className="mt-2 text-xs text-gray-600">Активные машины: {activeCarCount}</p>
        </div>

        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Коэффициенты</h2>
        <div className="mb-6 p-3 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-xs font-medium text-blue-900">
            Общий коэффициент: {formatCoefficient(coefficientSummary.overallCoefficient)}
          </p>
          <p className="mt-1 text-xs font-medium text-blue-900">
            Общая пропускная способность: {formatCapacity(coefficientSummary.overallCapacity)} / {MAX_EDGE_CAPACITY}
          </p>
          <p className="mt-1 text-xs font-medium text-blue-900">
            Общее ограничение скорости: {formatSpeed(coefficientSummary.overallSpeedLimit)} км/ч
          </p>
          <p className="mt-1 text-xs font-medium text-blue-900">
            Общая итоговая скорость: {formatSpeed(coefficientSummary.overallFinalSpeed)} км/ч
          </p>
          <p className="mt-1 text-[11px] text-blue-800">Завершённые группы: {coefficientSummary.completeGroups.length}</p>
          <p className="text-[11px] text-blue-800">Незавершённые группы: {coefficientSummary.incompleteGroups.length}</p>

          <div className="mt-2 border-t border-blue-200 pt-2">
            <p className="text-[11px] font-semibold text-blue-900">Группы светофоров</p>
            <div className="mt-1 max-h-48 overflow-auto space-y-1 pr-1">
              {sortedTrafficLightGroups.length === 0 && (
                <p className="text-[11px] text-blue-800">Групп пока нет.</p>
              )}
              {sortedTrafficLightGroups.map((group) => (
                <div key={group.id} className="rounded border border-blue-100 bg-white px-2 py-1">
                  <p className="text-[11px] font-medium text-gray-800">
                    {group.startLightLabel} -&gt; {group.endLightLabel ?? 'не достигнут'}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    {group.isComplete ? 'завершена' : 'не завершена'} | рёбра полос: {group.laneEdgeIds.length}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    k: {formatCoefficient(group.coefficient)} | пропускная способность: {formatCapacity(group.capacity)}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    ограничение: {formatSpeed(group.speedLimit)} км/ч | итоговая скорость: {formatSpeed(group.finalSpeed)} км/ч
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Проверка</h2>
        <button
          onClick={onValidate}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          Проверить граф
        </button>

        {validationResult && (
          <div
            className={`mt-4 p-3 rounded-md text-sm ${
              validationResult.isValid && validationResult.warnings.length === 0
                ? 'bg-green-50 text-green-800'
                : 'bg-yellow-50 text-yellow-800'
            }`}
          >
            {validationResult.isValid && validationResult.warnings.length === 0 ? (
              <p className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-1" /> Граф корректен
              </p>
            ) : (
              <div>
                <p className="flex items-center font-medium mb-1">
                  <AlertTriangle className="w-5 h-5 mr-1" /> Предупреждения:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
