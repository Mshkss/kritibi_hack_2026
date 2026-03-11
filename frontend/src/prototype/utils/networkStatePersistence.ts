import {
  Edge,
  EdgeValueMode,
  ManeuverType,
  NetworkState,
  Node,
  NodeType,
  ParkingType,
  Point,
  StopType,
  TrafficLightSide,
} from '../types';

export const PERSISTED_EDITOR_STATE_VERSION = 1 as const;
export const NETWORK_EDITOR_STORAGE_KEY = 'lane-network-editor.session.v1';
export const NETWORK_EDITOR_HISTORY_LIMIT = 100;
export const NETWORK_EDITOR_AUTOSAVE_DEBOUNCE_MS = 300;
export const NETWORK_EDITOR_AUTOSAVE_MIN_INTERVAL_MS = 1200;

export type EditorHistoryState = {
  history: NetworkState[];
  currentIndex: number;
};

export type PersistedEditorStateV1 = {
  version: typeof PERSISTED_EDITOR_STATE_VERSION;
  savedAt: string;
  currentIndex: number;
  history: NetworkState[];
};

type LoadPersistedHistoryParams = {
  storageKey: string;
  normalizeState: (networkState: NetworkState) => NetworkState;
};

type PersistHistoryParams = {
  storageKey: string;
  history: NetworkState[];
  currentIndex: number;
};

type AppendHistoryParams = {
  history: NetworkState[];
  currentIndex: number;
  nextState: NetworkState;
  maxHistory: number;
};

const NODE_TYPE_SET: Set<NodeType> = new Set([
  'default',
  'traffic_light',
  'crossing',
  'bus_stop',
  'speed_limit',
]);
const EDGE_VALUE_MODE_SET: Set<EdgeValueMode> = new Set(['auto', 'manual']);
const PARKING_TYPE_SET: Set<ParkingType> = new Set([1, 2, 3]);
const STOP_TYPE_SET: Set<StopType> = new Set([1, 2, 3]);
const MANEUVER_TYPE_SET: Set<ManeuverType> = new Set([1, 2, 3, 4, 5]);
const TRAFFIC_LIGHT_SIDE_SET: Set<TrafficLightSide> = new Set([
  'north',
  'east',
  'south',
  'west',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNodeType = (value: unknown): value is NodeType =>
  typeof value === 'string' && NODE_TYPE_SET.has(value as NodeType);
const isEdgeValueMode = (value: unknown): value is EdgeValueMode =>
  typeof value === 'string' && EDGE_VALUE_MODE_SET.has(value as EdgeValueMode);
const isParkingType = (value: unknown): value is ParkingType =>
  isFiniteNumber(value) && PARKING_TYPE_SET.has(value as ParkingType);
const isStopType = (value: unknown): value is StopType =>
  isFiniteNumber(value) && STOP_TYPE_SET.has(value as StopType);
const isManeuverType = (value: unknown): value is ManeuverType =>
  isFiniteNumber(value) && MANEUVER_TYPE_SET.has(value as ManeuverType);
const isTrafficLightSide = (value: unknown): value is TrafficLightSide =>
  typeof value === 'string' && TRAFFIC_LIGHT_SIDE_SET.has(value as TrafficLightSide);

const isPoint = (value: unknown): value is Point => {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.lat) && isFiniteNumber(value.lng);
};

const isTrafficLightControlConfig = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.timings)) return false;
  if (!isFiniteNumber(value.timings.nsGreenSec) || value.timings.nsGreenSec <= 0) return false;
  if (!isFiniteNumber(value.timings.nsYellowSec) || value.timings.nsYellowSec <= 0) return false;
  if (!isFiniteNumber(value.timings.ewGreenSec) || value.timings.ewGreenSec <= 0) return false;
  if (!isFiniteNumber(value.timings.ewYellowSec) || value.timings.ewYellowSec <= 0) return false;
  if (!isFiniteNumber(value.timings.allRedSec) || value.timings.allRedSec < 0) return false;
  if (!isFiniteNumber(value.cycleOffsetSec)) return false;
  if (!isRecord(value.approachSideOverrides)) return false;

  return Object.entries(value.approachSideOverrides).every(
    ([nodeId, side]) => nodeId.length > 0 && isTrafficLightSide(side),
  );
};

const isNode = (value: unknown): value is Node => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (!isFiniteNumber(value.lat) || !isFiniteNumber(value.lng)) return false;
  if (value.name !== undefined && typeof value.name !== 'string') return false;
  if (value.speedLimit !== undefined && !isFiniteNumber(value.speedLimit)) return false;
  if (value.type !== undefined && !isNodeType(value.type)) return false;
  if (value.trafficLightControl !== undefined && !isTrafficLightControlConfig(value.trafficLightControl)) {
    return false;
  }
  return true;
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
};

const isEdge = (value: unknown): value is Edge => {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.sourceId !== 'string') return false;
  if (typeof value.targetId !== 'string') return false;
  if (!Array.isArray(value.points) || !value.points.every(isPoint)) return false;
  if (typeof value.isOneWay !== 'boolean') return false;
  if (typeof value.crossroad !== 'boolean') return false;
  if (typeof value.busStop !== 'boolean') return false;
  if (!isFiniteNumber(value.speedLimit)) return false;
  if (value.laneWidth !== undefined && (!isFiniteNumber(value.laneWidth) || value.laneWidth <= 0)) return false;
  if (value.turnRadius !== undefined && (!isFiniteNumber(value.turnRadius) || value.turnRadius < 0)) return false;
  if (
    value.pedestrianIntensity !== undefined &&
    (!isFiniteNumber(value.pedestrianIntensity) || value.pedestrianIntensity < 0)
  ) {
    return false;
  }
  if (value.pedestrianIntensityMode !== undefined && !isEdgeValueMode(value.pedestrianIntensityMode)) {
    return false;
  }
  if (value.roadSlope !== undefined && !isFiniteNumber(value.roadSlope)) return false;
  if (value.parkingType !== undefined && !isParkingType(value.parkingType)) return false;
  if (value.stopType !== undefined && !isStopType(value.stopType)) return false;
  if (value.stopTypeMode !== undefined && !isEdgeValueMode(value.stopTypeMode)) return false;
  if (value.maneuverType !== undefined && !isManeuverType(value.maneuverType)) return false;
  if (value.turnPercentage !== undefined && (!isFiniteNumber(value.turnPercentage) || value.turnPercentage < 0)) {
    return false;
  }
  if (value.name !== undefined && typeof value.name !== 'string') return false;
  if (value.laneIndex !== undefined && !isFiniteNumber(value.laneIndex)) return false;
  if (value.isForward !== undefined && typeof value.isForward !== 'boolean') return false;
  if (value.tags !== undefined && !isStringRecord(value.tags)) return false;
  return true;
};

const isNetworkState = (value: unknown): value is NetworkState => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.nodes) || !isRecord(value.edges)) return false;
  return Object.values(value.nodes).every(isNode) && Object.values(value.edges).every(isEdge);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const persistedPayloadCacheByStorageKey = new Map<
  string,
  {
    fingerprint: string;
    serialized: string;
  }
>();
const networkStateRefIds = new WeakMap<NetworkState, number>();
let nextNetworkStateRefId = 1;

const getNetworkStateRefId = (state: NetworkState): number => {
  const existing = networkStateRefIds.get(state);
  if (existing !== undefined) return existing;
  const next = nextNetworkStateRefId++;
  networkStateRefIds.set(state, next);
  return next;
};

const buildHistoryFingerprint = (history: NetworkState[], currentIndex: number): string => {
  const safeIndex = clamp(currentIndex, 0, history.length - 1);
  const currentState = history[safeIndex];
  const firstState = history[0];
  const lastState = history[history.length - 1];
  return [
    history.length,
    safeIndex,
    getNetworkStateRefId(firstState),
    getNetworkStateRefId(currentState),
    getNetworkStateRefId(lastState),
  ].join('|');
};

const isQuotaExceededError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
};

const toPersistedPayload = (history: NetworkState[], currentIndex: number): PersistedEditorStateV1 => ({
  version: PERSISTED_EDITOR_STATE_VERSION,
  savedAt: new Date().toISOString(),
  currentIndex,
  history,
});

const sanitizePersistedHistory = (
  raw: unknown,
  normalizeState: (networkState: NetworkState) => NetworkState,
): EditorHistoryState | null => {
  if (!isRecord(raw)) return null;
  if (raw.version !== PERSISTED_EDITOR_STATE_VERSION) return null;
  if (!Array.isArray(raw.history)) return null;

  const normalizedHistory = raw.history
    .filter(isNetworkState)
    .map((networkState) => normalizeState(networkState));

  if (normalizedHistory.length === 0) return null;

  const boundedHistory =
    normalizedHistory.length > NETWORK_EDITOR_HISTORY_LIMIT
      ? normalizedHistory.slice(-NETWORK_EDITOR_HISTORY_LIMIT)
      : normalizedHistory;
  const droppedCount = normalizedHistory.length - boundedHistory.length;

  const rawIndex = Number.isInteger(raw.currentIndex) ? Number(raw.currentIndex) : normalizedHistory.length - 1;
  const currentIndex = clamp(rawIndex - droppedCount, 0, boundedHistory.length - 1);

  return {
    history: boundedHistory,
    currentIndex,
  };
};

export function createInitialHistoryState(
  storageKey: string,
  fallbackState: NetworkState,
  normalizeState: (networkState: NetworkState) => NetworkState,
): EditorHistoryState {
  const persisted = loadPersistedHistoryState({ storageKey, normalizeState });
  if (persisted) return persisted;
  return {
    history: [fallbackState],
    currentIndex: 0,
  };
}

export function appendHistoryState({
  history,
  currentIndex,
  nextState,
  maxHistory,
}: AppendHistoryParams): EditorHistoryState {
  const historyWithBranchCut = history.slice(0, currentIndex + 1);
  historyWithBranchCut.push(nextState);

  const boundedMaxHistory = Math.max(1, Math.floor(maxHistory));
  const overflow = Math.max(0, historyWithBranchCut.length - boundedMaxHistory);
  const boundedHistory = overflow > 0 ? historyWithBranchCut.slice(overflow) : historyWithBranchCut;

  return {
    history: boundedHistory,
    currentIndex: boundedHistory.length - 1,
  };
}

export function loadPersistedHistoryState({
  storageKey,
  normalizeState,
}: LoadPersistedHistoryParams): EditorHistoryState | null {
  if (typeof window === 'undefined') return null;

  const rawText = window.localStorage.getItem(storageKey);
  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const sanitized = sanitizePersistedHistory(parsed, normalizeState);
    if (sanitized) {
      persistedPayloadCacheByStorageKey.set(storageKey, {
        fingerprint: buildHistoryFingerprint(sanitized.history, sanitized.currentIndex),
        serialized: rawText,
      });
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function persistHistoryStateWithFallback({
  storageKey,
  history,
  currentIndex,
}: PersistHistoryParams): void {
  if (typeof window === 'undefined') return;
  if (history.length === 0) return;

  let candidateLength = history.length;

  while (candidateLength >= 1) {
    const startIndex = history.length - candidateLength;
    const candidateHistory = history.slice(startIndex);
    const candidateIndex = clamp(currentIndex - startIndex, 0, candidateHistory.length - 1);
    const candidateFingerprint = buildHistoryFingerprint(candidateHistory, candidateIndex);
    const cached = persistedPayloadCacheByStorageKey.get(storageKey);
    if (cached && cached.fingerprint === candidateFingerprint) {
      return;
    }

    const payload = toPersistedPayload(candidateHistory, candidateIndex);
    const serializedPayload = JSON.stringify(payload);

    try {
      window.localStorage.setItem(storageKey, serializedPayload);
      persistedPayloadCacheByStorageKey.set(storageKey, {
        fingerprint: candidateFingerprint,
        serialized: serializedPayload,
      });
      return;
    } catch (error) {
      if (isQuotaExceededError(error) && candidateLength > 1) {
        candidateLength = Math.max(1, Math.floor(candidateLength / 2));
        continue;
      }
      console.warn('Failed to persist editor state in localStorage.', error);
      return;
    }
  }
}
