import { NetworkState } from '../types';

export type ValidationResult = {
  isValid: boolean;
  warnings: string[];
  errors: string[];
};

export function validateNetwork(state: NetworkState): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  const nodeIds = Object.keys(state.nodes);
  if (nodeIds.length === 0) {
    return { isValid: true, warnings: ["Сеть пустая"], errors: [] };
  }
  
  // Build adjacency list
  const adj: Record<string, string[]> = {};
  nodeIds.forEach(id => adj[id] = []);
  
  Object.values(state.edges).forEach(edge => {
    if (adj[edge.sourceId]) adj[edge.sourceId].push(edge.targetId);
    if (!edge.isOneWay && adj[edge.targetId]) {
      adj[edge.targetId].push(edge.sourceId);
    }
  });
  
  // Check connectivity (BFS from first node)
  const visited = new Set<string>();
  const queue = [nodeIds[0]];
  visited.add(nodeIds[0]);
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    adj[curr]?.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }
  
  if (visited.size < nodeIds.length) {
    warnings.push(`Граф несвязный: достижимо ${visited.size} из ${nodeIds.length} узлов.`);
  }
  
  // Check for isolated nodes (degree 0)
  const degrees: Record<string, number> = {};
  nodeIds.forEach(id => degrees[id] = 0);
  Object.values(state.edges).forEach(edge => {
    degrees[edge.sourceId]++;
    degrees[edge.targetId]++;
  });
  
  const isolated = nodeIds.filter(id => degrees[id] === 0);
  if (isolated.length > 0) {
    warnings.push(`Найдено изолированных узлов: ${isolated.length}.`);
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}
