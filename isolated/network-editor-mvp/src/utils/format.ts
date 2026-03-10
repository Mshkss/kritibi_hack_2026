import type {
  Connection,
  Edge,
  IntersectionApproach,
  IntersectionEditorResponse,
  IntersectionValidationResponse,
  Movement,
  Node,
  PedestrianCrossing,
  PrioritySchemeValidationResponse,
  TrafficSign,
} from '@/types/api';

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? 'null';
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'н/д';
  }
  return value.toFixed(digits);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'н/д';
  }
  return new Date(value).toLocaleString();
}

export function describeNode(node: Node, incomingCount: number, outgoingCount: number, hasIntersection: boolean): string {
  const role = node.type || 'без типа';
  return `${node.code} — узел типа ${role}. У него ${incomingCount} входящих и ${outgoingCount} исходящих ребер, ${hasIntersection ? 'есть' : 'нет'} записи редактора пересечения.`;
}

export function describeEdge(edge: Edge): string {
  return `${edge.code} — направленный участок от ${edge.from_node_id} к ${edge.to_node_id}, полос: ${edge.num_lanes}, скорость: ${formatNumber(edge.speed, 1)}.`;
}

export function describeConnection(connection: Connection): string {
  return `${connection.from_edge_code} полоса ${connection.from_lane_index} соединяется с ${connection.to_edge_code} полосой ${connection.to_lane_index} через узел ${connection.via_node_code}.`;
}

export function describeIntersection(editor: IntersectionEditorResponse): string {
  return `${editor.intersection.name || editor.node.code} настроено как ${translateIntersectionKind(editor.intersection.kind)}. Подходов: ${editor.approaches.length}, маневров: ${editor.movements.length}, сгенерированных знаков: ${editor.generated_signs.length}.`;
}

export function describeMovement(movement: Movement): string {
  return `${movement.movement_kind || 'не указан'}: из ${movement.from_edge_id} в ${movement.to_edge_id}, ${movement.is_enabled ? 'разрешен' : 'запрещен'}.`;
}

export function describeSign(sign: TrafficSign): string {
  return `${getRussianSignLabel(sign.sign_type)} ${sign.generated ? 'сгенерирован' : 'создан вручную'} для ребра ${sign.edge_id || 'н/д'}.`;
}

export function describeCrossing(crossing: PedestrianCrossing): string {
  return `${getCrossingKindLabel(crossing.crossing_kind)} на стороне ${crossing.side_key}, ${crossing.is_enabled ? 'включен' : 'отключен'}.`;
}

export function describeValidation(
  validation: IntersectionValidationResponse | PrioritySchemeValidationResponse,
  scope: 'intersection' | 'priority',
): string {
  if (scope === 'intersection') {
    const data = validation as IntersectionValidationResponse;
    return `Проверка пересечения ${data.is_valid ? 'пройдена' : 'не пройдена'}: ошибок ${data.errors.length}, предупреждений ${data.warnings.length}.`;
  }

  const data = validation as PrioritySchemeValidationResponse;
  return `Проверка приоритета ${data.is_valid ? 'пройдена' : 'не пройдена'}, схема ${data.is_complete ? 'полная' : 'неполная'}.`;
}

export function getRussianSignLabel(signType: TrafficSign['sign_type']): string {
  switch (signType) {
    case 'main_road':
      return '2.1 Главная дорога';
    case 'yield':
      return '2.4 Уступите дорогу';
    case 'stop':
      return '2.5 Движение без остановки запрещено';
    default:
      return signType;
  }
}

export function getApproachRoleLabel(role: IntersectionApproach['role']): string {
  switch (role) {
    case 'main':
      return 'Главная';
    case 'secondary':
      return 'Второстепенная';
    default:
      return 'Не задано';
  }
}

export function getCrossingKindLabel(kind: PedestrianCrossing['crossing_kind']): string {
  switch (kind) {
    case 'zebra':
      return 'Нерегулируемый переход';
    case 'signalized':
      return 'Регулируемый переход';
    case 'uncontrolled':
      return 'Переход без отдельного регулирования';
    default:
      return 'Переход';
  }
}

export function translateIntersectionKind(kind: IntersectionEditorResponse['intersection']['kind']): string {
  switch (kind) {
    case 'crossroad':
      return 'перекресток';
    case 'roundabout':
      return 'кольцевое пересечение';
    default:
      return kind;
  }
}
