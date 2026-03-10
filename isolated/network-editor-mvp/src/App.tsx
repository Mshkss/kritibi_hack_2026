import {startTransition, useEffect, useRef, useState} from 'react';
import {ApiClient, ApiRequestError} from '@/api/client';
import {EditorToolbar} from '@/components/EditorToolbar';
import {InspectorSidebar} from '@/components/InspectorSidebar';
import {NetworkCanvas} from '@/components/NetworkCanvas';
import {ProjectBar} from '@/components/ProjectBar';
import {ValidationPanel} from '@/components/ValidationPanel';
import {useApiLog} from '@/hooks/useApiLog';
import type {
  ConnectionCandidatesResponse,
  Edge,
  EdgeEditorResponse,
  Intersection,
  IntersectionEditorResponse,
  IntersectionValidationResponse,
  Node,
  NodeConnectionsResponse,
  PrioritySchemeValidationResponse,
  Project,
  ProjectNetwork,
} from '@/types/api';
import type {EditorMode, EntitySelection, ViewBoxState} from '@/types/editor';
import {buildNetworkMaps, computeBounds, createEntityCode} from '@/utils/graph';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const UNSUPPORTED_NOTES = [
  'Текущий DTO IntersectionResponse не отдает control_type, поэтому поле помечено как недоступное.',
  'NodeRead отдает type, но не отдает name; интерфейс явно показывает этот пробел.',
  'EdgeRead сейчас не отдает surface, поэтому редактирование покрытия не включено.',
  'Общего endpoint проверки проекта пока нет; в этом MVP диагностика сфокусирована на пересечениях.',
  'Редактирование shape не включено: backend дает низкоуровневый patch, а MVP оставлен простым.',
  'Двунаправленное создание есть только в отдельном endpoint создания пары ребер; конвертации уже созданного ребра API не дает.',
];

export default function App() {
  const {logs, pushLog} = useApiLog();
  const api = new ApiClient(API_BASE, pushLog);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [network, setNetwork] = useState<ProjectNetwork | null>(null);
  const [selection, setSelection] = useState<EntitySelection>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [viewBox, setViewBox] = useState<ViewBoxState>({x: -100, y: -100, width: 200, height: 200});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edgeDraftStartNodeId, setEdgeDraftStartNodeId] = useState<string | null>(null);
  const [edgeBidirectional, setEdgeBidirectional] = useState(false);
  const [defaultRoadTypeId, setDefaultRoadTypeId] = useState('');
  const [nodeConnections, setNodeConnections] = useState<NodeConnectionsResponse | null>(null);
  const [connectionCandidates, setConnectionCandidates] = useState<ConnectionCandidatesResponse | null>(null);
  const [edgeEditor, setEdgeEditor] = useState<EdgeEditorResponse | null>(null);
  const [edgeConnectionContext, setEdgeConnectionContext] = useState<NodeConnectionsResponse | null>(null);
  const [nodeIntersection, setNodeIntersection] = useState<Intersection | null>(null);
  const [intersectionEditor, setIntersectionEditor] = useState<IntersectionEditorResponse | null>(null);
  const [intersectionValidation, setIntersectionValidation] = useState<IntersectionValidationResponse | null>(null);
  const [priorityValidation, setPriorityValidation] = useState<PrioritySchemeValidationResponse | null>(null);

  const dragOriginRef = useRef<{nodeId: string; x: number; y: number} | null>(null);
  const maps = buildNetworkMaps(network);
  const currentNodeId =
    selection && (selection.kind === 'node' ? selection.id : 'nodeId' in selection ? selection.nodeId : intersectionEditor?.node.id || null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const projectList = await api.get<Project[]>('/projects');
      setProjects(projectList);
      if (projectList.length > 0) {
        const firstProjectId = projectList[0].id;
        setSelectedProjectId(firstProjectId);
        await loadProject(firstProjectId);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadProject(projectId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    clearEntityContexts();
    try {
      const nextNetwork = await api.get<ProjectNetwork>(`/projects/${projectId}/network`);
      startTransition(() => {
        setNetwork(nextNetwork);
        setViewBox(computeBounds(nextNetwork));
        setDefaultRoadTypeId(nextNetwork.road_types[0]?.id || '');
      });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function clearEntityContexts() {
    setSelection(null);
    setNodeConnections(null);
    setConnectionCandidates(null);
    setEdgeEditor(null);
    setEdgeConnectionContext(null);
    setNodeIntersection(null);
    setIntersectionEditor(null);
    setIntersectionValidation(null);
    setPriorityValidation(null);
    setEdgeDraftStartNodeId(null);
  }

  async function loadNodeContext(projectId: string, nodeId: string) {
    setEdgeEditor(null);
    setEdgeConnectionContext(null);
    try {
      const [connectionsData, candidatesData, maybeIntersection] = await Promise.all([
        api.get<NodeConnectionsResponse>(`/projects/${projectId}/nodes/${nodeId}/connections`),
        api.get<ConnectionCandidatesResponse>(`/projects/${projectId}/nodes/${nodeId}/connection-candidates`),
        tryLoadIntersectionByNode(projectId, nodeId),
      ]);

      setNodeConnections(connectionsData);
      setConnectionCandidates(candidatesData);
      setNodeIntersection(maybeIntersection);

      if (maybeIntersection) {
        await loadIntersectionContext(projectId, maybeIntersection.id);
      } else {
        setIntersectionEditor(null);
        setIntersectionValidation(null);
        setPriorityValidation(null);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  async function tryLoadIntersectionByNode(projectId: string, nodeId: string) {
    try {
      return await api.get<Intersection>(`/projects/${projectId}/nodes/${nodeId}/intersection`);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 404) {
        return null;
      }
      throw caught;
    }
  }

  async function loadIntersectionContext(projectId: string, intersectionId: string) {
    const [editorData, validationData, priorityData] = await Promise.all([
      api.get<IntersectionEditorResponse>(`/projects/${projectId}/intersections/${intersectionId}/editor`),
      api.get<IntersectionValidationResponse>(`/projects/${projectId}/intersections/${intersectionId}/validation`),
      api.get<PrioritySchemeValidationResponse>(`/projects/${projectId}/intersections/${intersectionId}/priority-validation`),
    ]);

    setIntersectionEditor(editorData);
    setIntersectionValidation(validationData);
    setPriorityValidation(priorityData);
  }

  async function loadEdgeContext(projectId: string, edgeId: string) {
    setNodeConnections(null);
    setConnectionCandidates(null);
    setNodeIntersection(null);
    setIntersectionEditor(null);
    setIntersectionValidation(null);
    setPriorityValidation(null);

    try {
      const editorData = await api.get<EdgeEditorResponse>(`/projects/${projectId}/edges/${edgeId}/editor`);
      setEdgeEditor(editorData);
      try {
        const connectionData = await api.get<NodeConnectionsResponse>(
          `/projects/${projectId}/nodes/${editorData.edge.to_node_id}/connections`,
        );
        setEdgeConnectionContext(connectionData);
      } catch (caught) {
        if (!(caught instanceof ApiRequestError && caught.status === 404)) {
          throw caught;
        }
        setEdgeConnectionContext(null);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  function updateNodeInNetwork(nextNode: Node) {
    setNetwork((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) => (node.id === nextNode.id ? nextNode : node)),
          }
        : current,
    );
  }

  function appendNodeToNetwork(nextNode: Node) {
    setNetwork((current) => (current ? {...current, nodes: [...current.nodes, nextNode]} : current));
  }

  function upsertEdgeInNetwork(nextEdge: Edge) {
    setNetwork((current) => {
      if (!current) {
        return current;
      }

      const existing = current.edges.some((edge) => edge.id === nextEdge.id);
      return {
        ...current,
        edges: existing ? current.edges.map((edge) => (edge.id === nextEdge.id ? nextEdge : edge)) : [...current.edges, nextEdge],
      };
    });
  }

  async function handleProjectSelect(projectId: string) {
    setSelectedProjectId(projectId);
    if (!projectId) {
      clearEntityContexts();
      setNetwork(null);
      return;
    }
    await loadProject(projectId);
  }

  async function handleCreateProject(payload: {name: string; description: string}) {
    setBusy(true);
    setError(null);
    try {
      const project = await api.post<Project>('/projects', payload);
      const projectList = await api.get<Project[]>('/projects');
      setProjects(projectList);
      setSelectedProjectId(project.id);
      await loadProject(project.id);
      setMessage(`Создан проект «${project.name}».`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateNode(point: {x: number; y: number}) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const node = await api.post<Node>(`/projects/${selectedProjectId}/nodes`, {
        code: createEntityCode('N'),
        x: point.x,
        y: point.y,
        type: 'junction',
      });
      appendNodeToNetwork(node);
      setSelection({kind: 'node', id: node.id});
      await loadNodeContext(selectedProjectId, node.id);
      setMessage(`Создан узел ${node.code}.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectNode(nodeId: string) {
    if (!selectedProjectId) {
      return;
    }

    if (mode === 'add-edge') {
      if (!edgeDraftStartNodeId) {
        setEdgeDraftStartNodeId(nodeId);
        setSelection({kind: 'node', id: nodeId});
        return;
      }

      if (edgeDraftStartNodeId === nodeId) {
        setEdgeDraftStartNodeId(null);
        return;
      }

      await handleCreateEdge(edgeDraftStartNodeId, nodeId);
      return;
    }

    setSelection({kind: 'node', id: nodeId});
    await loadNodeContext(selectedProjectId, nodeId);
  }

  async function handleCreateEdge(fromNodeId: string, toNodeId: string) {
    if (!selectedProjectId) {
      return;
    }

    const fromNode = maps.nodesById[fromNodeId];
    const toNode = maps.nodesById[toNodeId];
    if (!fromNode || !toNode) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (edgeBidirectional) {
        const created = await api.post<Edge[]>(`/projects/${selectedProjectId}/edges/bidirectional`, {
          forward_code: createEntityCode('E'),
          reverse_code: createEntityCode('E'),
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          road_type_id: defaultRoadTypeId || null,
          shape: [
            {x: fromNode.x, y: fromNode.y},
            {x: toNode.x, y: toNode.y},
          ],
        });
        created.forEach(upsertEdgeInNetwork);
        const first = created[0];
        setSelection({kind: 'edge', id: first.id});
        await loadEdgeContext(selectedProjectId, first.id);
        setMessage(`Создана двунаправленная пара ребер: ${created.map((item) => item.code).join(', ')}.`);
      } else {
        const created = await api.post<Edge>(`/projects/${selectedProjectId}/edges`, {
          code: createEntityCode('E'),
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          road_type_id: defaultRoadTypeId || null,
          shape: [
            {x: fromNode.x, y: fromNode.y},
            {x: toNode.x, y: toNode.y},
          ],
        });
        upsertEdgeInNetwork(created);
        setSelection({kind: 'edge', id: created.id});
        await loadEdgeContext(selectedProjectId, created.id);
        setMessage(`Создано ребро ${created.code}.`);
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
      setEdgeDraftStartNodeId(null);
    }
  }

  async function handleSelectEdge(edgeId: string) {
    if (!selectedProjectId) {
      return;
    }
    setSelection({kind: 'edge', id: edgeId});
    await loadEdgeContext(selectedProjectId, edgeId);
  }

  function handleInspectorSelection(nextSelection: EntitySelection) {
    setSelection(nextSelection);
  }

  async function handlePatchNode(nodeId: string, payload: {code?: string; x?: number; y?: number; type?: string | null}) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Node>(`/projects/${selectedProjectId}/nodes/${nodeId}`, payload);
      updateNodeInNetwork(updated);
      await loadNodeContext(selectedProjectId, nodeId);
      setMessage(`Узел ${updated.code} обновлен.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchEdge(
    edgeId: string,
    payload: {
      name?: string | null;
      speed?: number | null;
      priority?: number | null;
      length?: number | null;
      width?: number | null;
      sidewalk_width?: number | null;
      road_type_id?: string | null;
    },
  ) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<Edge>(`/projects/${selectedProjectId}/edges/${edgeId}`, payload);
      upsertEdgeInNetwork(updated);
      await loadEdgeContext(selectedProjectId, edgeId);
      setMessage(`Ребро ${updated.code} обновлено.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceLanes(
    edgeId: string,
    lanes: Array<{index: number; allow: string | null; disallow: string | null; speed: number | null; width: number | null}>,
  ) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.put<Edge>(`/projects/${selectedProjectId}/edges/${edgeId}/lanes`, {lanes});
      upsertEdgeInNetwork(updated);
      await loadEdgeContext(selectedProjectId, edgeId);
      setMessage(`Список полос для ${updated.code} обновлен.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyRoadType(edgeId: string, roadTypeId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<Edge>(`/projects/${selectedProjectId}/edges/${edgeId}/apply-road-type`, {
        road_type_id: roadTypeId,
      });
      upsertEdgeInNetwork(updated);
      await loadEdgeContext(selectedProjectId, edgeId);
      setMessage(`Тип дороги применен к ${updated.code}.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleRecalculateLength(edgeId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<Edge>(`/projects/${selectedProjectId}/edges/${edgeId}/recalculate-length`);
      upsertEdgeInNetwork(updated);
      await loadEdgeContext(selectedProjectId, edgeId);
      setMessage(`Длина ${updated.code} пересчитана.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateConnection(payload: {
    via_node_id: string;
    from_edge_id: string;
    to_edge_id: string;
    from_lane_index: number;
    to_lane_index: number;
    uncontrolled: boolean;
  }) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/connections`, payload);
      await loadNodeContext(selectedProjectId, payload.via_node_id);
      setSelection({kind: 'node', id: payload.via_node_id});
      setMessage('Соединение создано.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleAutogenerateConnections(nodeId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/nodes/${nodeId}/connections/autogenerate`, {
        add_missing_only: true,
        allow_u_turns: false,
        uncontrolled: false,
      });
      await loadNodeContext(selectedProjectId, nodeId);
      setMessage('Недостающие соединения сгенерированы.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchConnection(connectionId: string, payload: {uncontrolled?: boolean}) {
    if (!selectedProjectId || !selection || !('nodeId' in selection)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/projects/${selectedProjectId}/connections/${connectionId}`, payload);
      await loadNodeContext(selectedProjectId, selection.nodeId);
      setMessage('Соединение обновлено.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateIntersection(nodeId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<Intersection>(`/projects/${selectedProjectId}/intersections`, {
        node_id: nodeId,
        kind: 'crossroad',
        auto_sync: true,
      });
      setSelection({kind: 'intersection', id: created.id, nodeId});
      await loadNodeContext(selectedProjectId, nodeId);
      setMessage(`Создано пересечение ${created.id}.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncApproaches(intersectionId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/intersections/${intersectionId}/approaches/sync`, {
        add_missing_only: true,
        remove_stale: false,
      });
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage('Подходы синхронизированы.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePriorityScheme(
    intersectionId: string,
    items: Array<{approach_id: string; role: 'main' | 'secondary' | null; priority_rank: number | null}>,
  ) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.put(`/projects/${selectedProjectId}/intersections/${intersectionId}/priority-scheme`, {
        items,
        reset_missing: false,
      });
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage('Схема приоритета сохранена.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidatePriorityScheme(intersectionId: string) {
    if (!selectedProjectId || !currentNodeId) {
      return;
    }
    setError(null);
    try {
      const validation = await api.get<PrioritySchemeValidationResponse>(
        `/projects/${selectedProjectId}/intersections/${intersectionId}/priority-validation`,
      );
      setPriorityValidation(validation);
      setSelection({kind: 'validation', id: intersectionId, scope: 'priority', intersectionId, nodeId: currentNodeId});
      setMessage('Проверка приоритета загружена.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  async function handleGenerateSigns(intersectionId: string, signType: 'yield' | 'stop') {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/intersections/${intersectionId}/signs/generate`, {
        secondary_sign_type: signType,
      });
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage(`Знаки с политикой ${signType === 'yield' ? '«Уступите дорогу»' : '«STOP»'} сгенерированы.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncMovements(intersectionId: string) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/intersections/${intersectionId}/movements/sync`, {
        add_missing_only: true,
        remove_stale: false,
        default_is_enabled: true,
      });
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage('Маневры синхронизированы.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchMovement(
    intersectionId: string,
    movementId: string,
    payload: {is_enabled?: boolean; movement_kind?: string | null},
  ) {
    if (!selectedProjectId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/projects/${selectedProjectId}/intersections/${intersectionId}/movements/${movementId}`, payload);
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage('Маневр обновлен.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleValidateIntersection(intersectionId: string) {
    if (!selectedProjectId || !currentNodeId) {
      return;
    }
    setError(null);
    try {
      const validation = await api.get<IntersectionValidationResponse>(
        `/projects/${selectedProjectId}/intersections/${intersectionId}/validation`,
      );
      setIntersectionValidation(validation);
      setSelection({kind: 'validation', id: intersectionId, scope: 'intersection', intersectionId, nodeId: currentNodeId});
      setMessage('Проверка пересечения загружена.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  function handleDragNode(nodeId: string, point: {x: number; y: number}, phase: 'start' | 'move' | 'end') {
    const node = maps.nodesById[nodeId];
    if (!node) {
      return;
    }

    if (phase === 'start') {
      dragOriginRef.current = {nodeId, x: node.x, y: node.y};
      return;
    }

    updateNodeInNetwork({...node, x: point.x, y: point.y});

    if (phase === 'end' && selectedProjectId) {
      void (async () => {
        try {
          await api.patch<Node>(`/projects/${selectedProjectId}/nodes/${nodeId}`, {x: point.x, y: point.y});
          if (selection?.kind === 'node' && selection.id === nodeId) {
            await loadNodeContext(selectedProjectId, nodeId);
          }
        } catch (caught) {
          if (dragOriginRef.current?.nodeId === nodeId) {
            updateNodeInNetwork({...node, x: dragOriginRef.current.x, y: dragOriginRef.current.y});
          }
          setError(getErrorMessage(caught));
        } finally {
          dragOriginRef.current = null;
        }
      })();
    }
  }

  async function handlePrioritySignClick(approachId: string) {
    if (!selectedProjectId || !intersectionEditor) {
      return;
    }

    const target = intersectionEditor.approaches.find((item) => item.id === approachId);
    if (!target) {
      return;
    }

    const nextRole = target.role === 'main' ? 'secondary' : 'main';
    const nextItems = intersectionEditor.approaches.map((approach, index) => {
      if (approach.id === approachId) {
        return {
          approach_id: approach.id,
          role: nextRole,
          priority_rank: nextRole === 'main' ? 0 : approach.priority_rank ?? index,
        };
      }

      if (nextRole === 'main' && approach.role === 'main') {
        return {
          approach_id: approach.id,
          role: 'secondary' as const,
          priority_rank: approach.priority_rank ?? index,
        };
      }

      return {
        approach_id: approach.id,
        role: approach.role,
        priority_rank: approach.priority_rank,
      };
    });

    setBusy(true);
    setError(null);
    try {
      await api.put(`/projects/${selectedProjectId}/intersections/${intersectionEditor.intersection.id}/priority-scheme`, {
        items: nextItems,
        reset_missing: false,
      });
      await loadIntersectionContext(selectedProjectId, intersectionEditor.intersection.id);
      setMessage(`Приоритет подхода ${target.incoming_edge_code} переключен на «${nextRole === 'main' ? 'главная' : 'второстепенная'}».`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCrossing(payload: {
    intersectionId: string;
    approach_id: string | null;
    side_key: string;
    is_enabled: boolean;
    name: string | null;
    crossing_kind: 'zebra' | 'signalized' | 'uncontrolled' | null;
  }) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.post(`/projects/${selectedProjectId}/intersections/${payload.intersectionId}/pedestrian-crossings`, {
        approach_id: payload.approach_id,
        side_key: payload.side_key,
        is_enabled: payload.is_enabled,
        name: payload.name,
        crossing_kind: payload.crossing_kind,
      });
      await loadIntersectionContext(selectedProjectId, payload.intersectionId);
      setMessage(`Пешеходный переход на стороне ${payload.side_key} создан.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchCrossing(
    intersectionId: string,
    crossingId: string,
    payload: {
      approach_id?: string | null;
      side_key?: string;
      is_enabled?: boolean;
      name?: string | null;
      crossing_kind?: 'zebra' | 'signalized' | 'uncontrolled' | null;
    },
  ) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/projects/${selectedProjectId}/intersections/${intersectionId}/pedestrian-crossings/${crossingId}`, payload);
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setMessage('Пешеходный переход обновлен.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCrossing(intersectionId: string, crossingId: string) {
    if (!selectedProjectId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.delete(`/projects/${selectedProjectId}/intersections/${intersectionId}/pedestrian-crossings/${crossingId}`);
      await loadIntersectionContext(selectedProjectId, intersectionId);
      setSelection((current) => (current?.kind === 'crossing' && current.id === crossingId ? {kind: 'intersection', id: intersectionId, nodeId: current.nodeId} : current));
      setMessage('Пешеходный переход удален.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const validationNodeIds =
    intersectionEditor && ((intersectionValidation && !intersectionValidation.is_valid) || (priorityValidation && !priorityValidation.is_valid))
      ? [intersectionEditor.node.id]
      : [];

  const selectedRawJson = getSelectedRawJson({
    selection,
    maps,
    nodeConnections,
    edgeEditor,
    nodeIntersection,
    intersectionEditor,
    intersectionValidation,
    priorityValidation,
  });

  return (
    <div className="app-shell">
      <ProjectBar
        projects={projects}
        selectedProjectId={selectedProjectId}
        loading={loading}
        busy={busy}
        onSelectProject={(projectId) => {
          void handleProjectSelect(projectId);
        }}
        onReload={() => {
          void loadProject(selectedProjectId);
        }}
        onCreateProject={handleCreateProject}
      />

      <EditorToolbar
        mode={mode}
        setMode={(nextMode) => {
          setMode(nextMode);
          if (nextMode !== 'add-edge') {
            setEdgeDraftStartNodeId(null);
          }
        }}
        bidirectional={edgeBidirectional}
        setBidirectional={setEdgeBidirectional}
        defaultRoadTypeId={defaultRoadTypeId}
        setDefaultRoadTypeId={setDefaultRoadTypeId}
        roadTypes={network?.road_types || []}
        selectedProjectId={selectedProjectId}
        edgeDraftStartCode={edgeDraftStartNodeId ? maps.nodesById[edgeDraftStartNodeId]?.code : undefined}
      />

      {(message || error) && (
        <div className={error ? 'message-banner message-banner--error' : 'message-banner'}>
          {error || message}
        </div>
      )}

      <main className="workspace">
        <NetworkCanvas
          nodes={network?.nodes || []}
          edges={network?.edges || []}
          nodesById={maps.nodesById}
          selection={selection}
          mode={mode}
          edgeDraftStartNodeId={edgeDraftStartNodeId}
          viewBox={viewBox}
          onViewBoxChange={setViewBox}
          onWorldClick={(point) => {
            void handleCreateNode(point);
          }}
          onSelectNode={(nodeId) => {
            void handleSelectNode(nodeId);
          }}
          onSelectEdge={(edgeId) => {
            void handleSelectEdge(edgeId);
          }}
          onDragNode={handleDragNode}
          validationNodeIds={validationNodeIds}
          intersectionEditor={intersectionEditor}
          onPrioritySignClick={(approachId) => {
            void handlePrioritySignClick(approachId);
          }}
          onSelectCrossing={(crossingId) => {
            if (intersectionEditor) {
              setSelection({kind: 'crossing', id: crossingId, intersectionId: intersectionEditor.intersection.id, nodeId: intersectionEditor.node.id});
            }
          }}
        />

        <InspectorSidebar
          selection={selection}
          network={network}
          maps={maps}
          roadTypes={network?.road_types || []}
          nodeConnections={nodeConnections}
          connectionCandidates={connectionCandidates}
          edgeEditor={edgeEditor}
          edgeConnectionContext={edgeConnectionContext}
          nodeIntersection={nodeIntersection}
          intersectionEditor={intersectionEditor}
          intersectionValidation={intersectionValidation}
          priorityValidation={priorityValidation}
          busy={busy}
          onSelect={handleInspectorSelection}
          onPatchNode={handlePatchNode}
          onPatchEdge={handlePatchEdge}
          onReplaceLanes={handleReplaceLanes}
          onApplyRoadType={handleApplyRoadType}
          onRecalculateLength={handleRecalculateLength}
          onCreateConnection={handleCreateConnection}
          onAutogenerateConnections={handleAutogenerateConnections}
          onPatchConnection={handlePatchConnection}
          onCreateIntersection={handleCreateIntersection}
          onSyncApproaches={handleSyncApproaches}
          onSavePriorityScheme={handleSavePriorityScheme}
          onValidatePriorityScheme={handleValidatePriorityScheme}
          onGenerateSigns={handleGenerateSigns}
          onSyncMovements={handleSyncMovements}
          onPatchMovement={handlePatchMovement}
          onValidateIntersection={handleValidateIntersection}
          onCreateCrossing={handleCreateCrossing}
          onPatchCrossing={handlePatchCrossing}
          onDeleteCrossing={handleDeleteCrossing}
        />
      </main>

      <ValidationPanel
        intersectionValidation={intersectionValidation}
        priorityValidation={priorityValidation}
        logs={logs}
        selectedRawJson={selectedRawJson}
        unsupportedNotes={UNSUPPORTED_NOTES}
      />
    </div>
  );
}

function getErrorMessage(caught: unknown): string {
  if (caught instanceof ApiRequestError) {
    const detail =
      typeof caught.payload === 'object' && caught.payload && 'detail' in (caught.payload as Record<string, unknown>)
        ? String((caught.payload as Record<string, unknown>).detail)
        : caught.message;
    return `${caught.status}: ${detail}`;
  }

  if (caught instanceof Error) {
    return caught.message;
  }

  return 'Unknown error';
}

function getSelectedRawJson({
  selection,
  maps,
  nodeConnections,
  edgeEditor,
  nodeIntersection,
  intersectionEditor,
  intersectionValidation,
  priorityValidation,
}: {
  selection: EntitySelection;
  maps: ReturnType<typeof buildNetworkMaps>;
  nodeConnections: NodeConnectionsResponse | null;
  edgeEditor: EdgeEditorResponse | null;
  nodeIntersection: Intersection | null;
  intersectionEditor: IntersectionEditorResponse | null;
  intersectionValidation: IntersectionValidationResponse | null;
  priorityValidation: PrioritySchemeValidationResponse | null;
}) {
  if (!selection) {
    return null;
  }

  switch (selection.kind) {
    case 'node':
      return maps.nodesById[selection.id] || null;
    case 'edge':
      return edgeEditor?.edge.id === selection.id ? edgeEditor : maps.edgesById[selection.id] || null;
    case 'connection':
      return nodeConnections?.connections.find((item) => item.id === selection.id) || null;
    case 'intersection':
      return intersectionEditor?.intersection.id === selection.id ? intersectionEditor : nodeIntersection;
    case 'approach':
      return intersectionEditor?.approaches.find((item) => item.id === selection.id) || null;
    case 'sign':
      return intersectionEditor?.generated_signs.find((item) => item.id === selection.id) || null;
    case 'movement':
      return intersectionEditor?.movements.find((item) => item.id === selection.id) || null;
    case 'crossing':
      return intersectionEditor?.pedestrian_crossings.find((item) => item.id === selection.id) || null;
    case 'validation':
      return selection.scope === 'intersection' ? intersectionValidation : priorityValidation;
    default:
      return null;
  }
}
