import {
  TrafficLightColor,
  TrafficLightControlConfig,
  TrafficLightPhase,
  TrafficLightSide,
  TrafficLightTimings,
} from '../types';

export type LatLngLike = {
  lat: number;
  lng: number;
};

export type TrafficLightLocalVector = {
  eastMeters: number;
  northMeters: number;
};

export type TrafficLightLocalFrame = {
  axisA: TrafficLightLocalVector;
  axisB: TrafficLightLocalVector;
};

export const TRAFFIC_LIGHT_APPROACH_RADIUS_METERS = 25;
export const TRAFFIC_LIGHT_STOP_BUFFER_METERS = 4;

export const DEFAULT_TRAFFIC_LIGHT_TIMINGS: TrafficLightTimings = {
  nsGreenSec: 20,
  nsYellowSec: 3,
  ewGreenSec: 20,
  ewYellowSec: 3,
  allRedSec: 1,
};

export const DEFAULT_TRAFFIC_LIGHT_CONTROL_CONFIG: TrafficLightControlConfig = {
  timings: DEFAULT_TRAFFIC_LIGHT_TIMINGS,
  cycleOffsetSec: 0,
  approachSideOverrides: {},
};

export type TrafficLightRuntimeState = {
  phase: TrafficLightPhase;
  cycleLengthSec: number;
  cycleTimeSec: number;
  phaseElapsedSec: number;
  phaseRemainingSec: number;
  colorsBySide: Record<TrafficLightSide, TrafficLightColor>;
};

const TRAFFIC_LIGHT_SIDES: TrafficLightSide[] = ['north', 'east', 'south', 'west'];
const TRAFFIC_LIGHT_PHASES: TrafficLightPhase[] = [
  'NS_GREEN',
  'NS_YELLOW',
  'ALL_RED_NS_TO_EW',
  'EW_GREEN',
  'EW_YELLOW',
  'ALL_RED_EW_TO_NS',
];
const EPSILON_LENGTH = 1e-6;
const DEFAULT_AXIS_A: TrafficLightLocalVector = { eastMeters: 0, northMeters: 1 };

const METERS_PER_DEGREE_LAT = 111320;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isTrafficLightSide = (value: unknown): value is TrafficLightSide =>
  typeof value === 'string' && TRAFFIC_LIGHT_SIDES.includes(value as TrafficLightSide);

const isTrafficLightPhase = (value: unknown): value is TrafficLightPhase =>
  typeof value === 'string' && TRAFFIC_LIGHT_PHASES.includes(value as TrafficLightPhase);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const vectorLength = (vector: TrafficLightLocalVector): number =>
  Math.sqrt(vector.eastMeters * vector.eastMeters + vector.northMeters * vector.northMeters);

const dotProduct = (a: TrafficLightLocalVector, b: TrafficLightLocalVector): number =>
  a.eastMeters * b.eastMeters + a.northMeters * b.northMeters;

const normalizeVector = (vector: TrafficLightLocalVector): TrafficLightLocalVector | null => {
  const len = vectorLength(vector);
  if (!Number.isFinite(len) || len <= EPSILON_LENGTH) return null;
  return {
    eastMeters: vector.eastMeters / len,
    northMeters: vector.northMeters / len,
  };
};

const perpendicularAxis = (axisA: TrafficLightLocalVector): TrafficLightLocalVector => ({
  // Clockwise 90° to keep default frame: A+ = north, B+ = east.
  eastMeters: axisA.northMeters,
  northMeters: -axisA.eastMeters,
});

const normalizeModulo = (value: number, modulo: number): number => {
  if (!isFiniteNumber(value) || !isFiniteNumber(modulo) || modulo <= 0) return 0;
  const normalized = value % modulo;
  return normalized >= 0 ? normalized : normalized + modulo;
};

const sanitizeSeconds = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const candidate = isFiniteNumber(value) ? value : fallback;
  return clamp(candidate, min, max);
};

const sanitizeApproachSideOverrides = (
  value: unknown,
  validNodeIds?: Set<string>,
): Record<string, TrafficLightSide> => {
  if (!isRecord(value)) return {};
  const next: Record<string, TrafficLightSide> = {};

  Object.entries(value).forEach(([nodeId, side]) => {
    if (validNodeIds && !validNodeIds.has(nodeId)) return;
    if (!isTrafficLightSide(side)) return;
    next[nodeId] = side;
  });

  return next;
};

export const getTrafficLightCycleLengthSec = (timings: TrafficLightTimings): number =>
  timings.nsGreenSec +
  timings.nsYellowSec +
  timings.allRedSec +
  timings.ewGreenSec +
  timings.ewYellowSec +
  timings.allRedSec;

const sanitizeTrafficLightTimings = (value: unknown): TrafficLightTimings => {
  const timings = isRecord(value) ? value : {};
  return {
    nsGreenSec: sanitizeSeconds(timings.nsGreenSec, DEFAULT_TRAFFIC_LIGHT_TIMINGS.nsGreenSec, 1, 300),
    nsYellowSec: sanitizeSeconds(timings.nsYellowSec, DEFAULT_TRAFFIC_LIGHT_TIMINGS.nsYellowSec, 1, 60),
    ewGreenSec: sanitizeSeconds(timings.ewGreenSec, DEFAULT_TRAFFIC_LIGHT_TIMINGS.ewGreenSec, 1, 300),
    ewYellowSec: sanitizeSeconds(timings.ewYellowSec, DEFAULT_TRAFFIC_LIGHT_TIMINGS.ewYellowSec, 1, 60),
    allRedSec: sanitizeSeconds(timings.allRedSec, DEFAULT_TRAFFIC_LIGHT_TIMINGS.allRedSec, 0, 30),
  };
};

export const sanitizeTrafficLightControlConfig = (
  value: unknown,
  validNodeIds?: Set<string>,
): TrafficLightControlConfig => {
  const config = isRecord(value) ? value : {};
  const timings = sanitizeTrafficLightTimings(config.timings);
  const cycleLength = getTrafficLightCycleLengthSec(timings);
  const cycleOffsetRaw = isFiniteNumber(config.cycleOffsetSec)
    ? config.cycleOffsetSec
    : DEFAULT_TRAFFIC_LIGHT_CONTROL_CONFIG.cycleOffsetSec;

  return {
    timings,
    cycleOffsetSec: normalizeModulo(cycleOffsetRaw, cycleLength),
    approachSideOverrides: sanitizeApproachSideOverrides(config.approachSideOverrides, validNodeIds),
  };
};

export const getTrafficLightColorsByPhase = (
  phase: TrafficLightPhase,
): Record<TrafficLightSide, TrafficLightColor> => {
  const nsColor: TrafficLightColor =
    phase === 'NS_GREEN' ? 'green' : phase === 'NS_YELLOW' ? 'yellow' : 'red';
  const ewColor: TrafficLightColor =
    phase === 'EW_GREEN' ? 'green' : phase === 'EW_YELLOW' ? 'yellow' : 'red';

  return {
    north: nsColor,
    south: nsColor,
    east: ewColor,
    west: ewColor,
  };
};

type PhaseDuration = {
  phase: TrafficLightPhase;
  durationSec: number;
};

const buildPhaseDurations = (timings: TrafficLightTimings): PhaseDuration[] => [
  { phase: 'NS_GREEN', durationSec: timings.nsGreenSec },
  { phase: 'NS_YELLOW', durationSec: timings.nsYellowSec },
  { phase: 'ALL_RED_NS_TO_EW', durationSec: timings.allRedSec },
  { phase: 'EW_GREEN', durationSec: timings.ewGreenSec },
  { phase: 'EW_YELLOW', durationSec: timings.ewYellowSec },
  { phase: 'ALL_RED_EW_TO_NS', durationSec: timings.allRedSec },
];

export const getTrafficLightRuntimeState = (
  elapsedSec: number,
  controlInput: unknown,
): TrafficLightRuntimeState => {
  const control = sanitizeTrafficLightControlConfig(controlInput);
  const phases = buildPhaseDurations(control.timings);
  const cycleLengthSec = getTrafficLightCycleLengthSec(control.timings);
  const cycleTimeSec = normalizeModulo(elapsedSec + control.cycleOffsetSec, cycleLengthSec);

  let timeCursor = cycleTimeSec;
  let phase = phases[phases.length - 1].phase;
  let phaseDurationSec = phases[phases.length - 1].durationSec;
  let phaseElapsedSec = phaseDurationSec;

  for (const segment of phases) {
    if (segment.durationSec <= 0) {
      continue;
    }
    if (timeCursor < segment.durationSec) {
      phase = segment.phase;
      phaseDurationSec = segment.durationSec;
      phaseElapsedSec = timeCursor;
      break;
    }
    timeCursor -= segment.durationSec;
  }

  return {
    phase: isTrafficLightPhase(phase) ? phase : 'NS_GREEN',
    cycleLengthSec,
    cycleTimeSec,
    phaseElapsedSec,
    phaseRemainingSec: Math.max(0, phaseDurationSec - phaseElapsedSec),
    colorsBySide: getTrafficLightColorsByPhase(phase),
  };
};

export const getDefaultTrafficLightControlConfig = (): TrafficLightControlConfig =>
  sanitizeTrafficLightControlConfig(DEFAULT_TRAFFIC_LIGHT_CONTROL_CONFIG);

export const getDefaultTrafficLightLocalFrame = (): TrafficLightLocalFrame => {
  const axisA = { ...DEFAULT_AXIS_A };
  return {
    axisA,
    axisB: perpendicularAxis(axisA),
  };
};

export const toLocalMetersVector = (
  from: LatLngLike,
  to: LatLngLike,
): TrafficLightLocalVector => {
  const avgLatRad = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  return {
    eastMeters: (to.lng - from.lng) * METERS_PER_DEGREE_LAT * Math.cos(avgLatRad),
    northMeters: (to.lat - from.lat) * METERS_PER_DEGREE_LAT,
  };
};

export const buildTrafficLightLocalFrame = (
  light: LatLngLike,
  approachTargets: LatLngLike[],
): TrafficLightLocalFrame => {
  const vectors = approachTargets
    .map((target) => toLocalMetersVector(light, target))
    .map((vector) => ({
      ...vector,
      length: vectorLength(vector),
    }))
    .filter((vector) => Number.isFinite(vector.length) && vector.length > EPSILON_LENGTH);

  if (vectors.length === 0) return getDefaultTrafficLightLocalFrame();

  let axisA: TrafficLightLocalVector | null = null;
  if (vectors.length === 1) {
    axisA = normalizeVector(vectors[0]);
  } else {
    const meanEast = vectors.reduce((sum, vector) => sum + vector.eastMeters, 0) / vectors.length;
    const meanNorth = vectors.reduce((sum, vector) => sum + vector.northMeters, 0) / vectors.length;

    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    vectors.forEach((vector) => {
      const de = vector.eastMeters - meanEast;
      const dn = vector.northMeters - meanNorth;
      sxx += de * de;
      syy += dn * dn;
      sxy += de * dn;
    });

    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    axisA = normalizeVector({
      eastMeters: Math.cos(theta),
      northMeters: Math.sin(theta),
    });

    if (!axisA) {
      axisA = normalizeVector(vectors[0]);
    }
  }

  const normalizedAxisA = axisA ?? { ...DEFAULT_AXIS_A };
  const nearestVector = [...vectors].sort((a, b) => {
    if (Math.abs(a.length - b.length) > EPSILON_LENGTH) return a.length - b.length;
    if (Math.abs(a.eastMeters - b.eastMeters) > EPSILON_LENGTH) return a.eastMeters - b.eastMeters;
    return a.northMeters - b.northMeters;
  })[0];

  const alignedAxisA =
    dotProduct(normalizedAxisA, nearestVector) < 0
      ? {
          eastMeters: -normalizedAxisA.eastMeters,
          northMeters: -normalizedAxisA.northMeters,
        }
      : normalizedAxisA;

  return {
    axisA: alignedAxisA,
    axisB: perpendicularAxis(alignedAxisA),
  };
};

export const getTrafficLightSideUnitVector = (
  frame: TrafficLightLocalFrame,
  side: TrafficLightSide,
): TrafficLightLocalVector => {
  if (side === 'north') return frame.axisA;
  if (side === 'south') {
    return {
      eastMeters: -frame.axisA.eastMeters,
      northMeters: -frame.axisA.northMeters,
    };
  }
  if (side === 'east') return frame.axisB;
  return {
    eastMeters: -frame.axisB.eastMeters,
    northMeters: -frame.axisB.northMeters,
  };
};

export const deriveTrafficLightApproachSide = (
  light: LatLngLike,
  targetNode: LatLngLike,
  frame?: TrafficLightLocalFrame,
): TrafficLightSide => {
  const localFrame = frame ?? getDefaultTrafficLightLocalFrame();
  const vector = toLocalMetersVector(light, targetNode);
  if (vectorLength(vector) <= EPSILON_LENGTH) return 'north';

  const projA = dotProduct(vector, localFrame.axisA);
  const projB = dotProduct(vector, localFrame.axisB);

  if (Math.abs(projA) >= Math.abs(projB)) {
    return projA >= 0 ? 'north' : 'south';
  }
  return projB >= 0 ? 'east' : 'west';
};

export const distanceMeters = (from: LatLngLike, to: LatLngLike): number => {
  const avgLatRad = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const dx = (to.lng - from.lng) * METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);
  const dy = (to.lat - from.lat) * METERS_PER_DEGREE_LAT;
  return Math.sqrt(dx * dx + dy * dy);
};
