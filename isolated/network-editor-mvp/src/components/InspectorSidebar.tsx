import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import type {
  Connection,
  ConnectionCandidatesResponse,
  Edge,
  EdgeEditorResponse,
  Intersection,
  IntersectionApproach,
  IntersectionEditorResponse,
  IntersectionValidationResponse,
  Movement,
  Node,
  NodeConnectionsResponse,
  PedestrianCrossing,
  PrioritySchemeValidationResponse,
  ProjectNetwork,
  RoadType,
  TrafficSign,
} from '@/types/api';
import type {EntitySelection, NetworkMaps} from '@/types/editor';
import {
  describeConnection,
  describeCrossing,
  describeEdge,
  describeIntersection,
  describeMovement,
  describeNode,
  describeSign,
  describeValidation,
  formatDate,
  formatJson,
  formatNumber,
  getCrossingKindLabel,
} from '@/utils/format';
import {formatLaneSummary} from '@/utils/graph';

interface InspectorSidebarProps {
  selection: EntitySelection;
  network: ProjectNetwork | null;
  maps: NetworkMaps;
  roadTypes: RoadType[];
  nodeConnections: NodeConnectionsResponse | null;
  connectionCandidates: ConnectionCandidatesResponse | null;
  edgeEditor: EdgeEditorResponse | null;
  edgeConnectionContext: NodeConnectionsResponse | null;
  nodeIntersection: Intersection | null;
  intersectionEditor: IntersectionEditorResponse | null;
  intersectionValidation: IntersectionValidationResponse | null;
  priorityValidation: PrioritySchemeValidationResponse | null;
  busy: boolean;
  onSelect: (selection: EntitySelection) => void;
  onPatchNode: (nodeId: string, payload: {code?: string; x?: number; y?: number; type?: string | null}) => Promise<void>;
  onPatchEdge: (
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
  ) => Promise<void>;
  onReplaceLanes: (
    edgeId: string,
    lanes: Array<{index: number; allow: string | null; disallow: string | null; speed: number | null; width: number | null}>,
  ) => Promise<void>;
  onApplyRoadType: (edgeId: string, roadTypeId: string) => Promise<void>;
  onRecalculateLength: (edgeId: string) => Promise<void>;
  onCreateConnection: (payload: {
    via_node_id: string;
    from_edge_id: string;
    to_edge_id: string;
    from_lane_index: number;
    to_lane_index: number;
    uncontrolled: boolean;
  }) => Promise<void>;
  onAutogenerateConnections: (nodeId: string) => Promise<void>;
  onPatchConnection: (connectionId: string, payload: {uncontrolled?: boolean}) => Promise<void>;
  onCreateIntersection: (nodeId: string) => Promise<void>;
  onSyncApproaches: (intersectionId: string) => Promise<void>;
  onSavePriorityScheme: (
    intersectionId: string,
    items: Array<{approach_id: string; role: 'main' | 'secondary' | null; priority_rank: number | null}>,
  ) => Promise<void>;
  onValidatePriorityScheme: (intersectionId: string) => Promise<void>;
  onGenerateSigns: (intersectionId: string, signType: 'yield' | 'stop') => Promise<void>;
  onSyncMovements: (intersectionId: string) => Promise<void>;
  onPatchMovement: (intersectionId: string, movementId: string, payload: {is_enabled?: boolean; movement_kind?: string | null}) => Promise<void>;
  onValidateIntersection: (intersectionId: string) => Promise<void>;
  onCreateCrossing: (payload: {
    intersectionId: string;
    approach_id: string | null;
    side_key: string;
    is_enabled: boolean;
    name: string | null;
    crossing_kind: 'zebra' | 'signalized' | 'uncontrolled' | null;
  }) => Promise<void>;
  onPatchCrossing: (
    intersectionId: string,
    crossingId: string,
    payload: {
      approach_id?: string | null;
      side_key?: string;
      is_enabled?: boolean;
      name?: string | null;
      crossing_kind?: 'zebra' | 'signalized' | 'uncontrolled' | null;
    },
  ) => Promise<void>;
  onDeleteCrossing: (intersectionId: string, crossingId: string) => Promise<void>;
}

interface LaneDraft {
  index: number;
  allow: string;
  disallow: string;
  speed: string;
  width: string;
}

export function InspectorSidebar({
  selection,
  network,
  maps,
  roadTypes,
  nodeConnections,
  connectionCandidates,
  edgeEditor,
  edgeConnectionContext,
  nodeIntersection,
  intersectionEditor,
  intersectionValidation,
  priorityValidation,
  busy,
  onSelect,
  onPatchNode,
  onPatchEdge,
  onReplaceLanes,
  onApplyRoadType,
  onRecalculateLength,
  onCreateConnection,
  onAutogenerateConnections,
  onPatchConnection,
  onCreateIntersection,
  onSyncApproaches,
  onSavePriorityScheme,
  onValidatePriorityScheme,
  onGenerateSigns,
  onSyncMovements,
  onPatchMovement,
  onValidateIntersection,
  onCreateCrossing,
  onPatchCrossing,
  onDeleteCrossing,
}: InspectorSidebarProps) {
  const baseNodeId = selection
    ? selection.kind === 'node'
      ? selection.id
      : 'nodeId' in selection
        ? selection.nodeId
        : null
    : null;
  const selectedNode = baseNodeId ? maps.nodesById[baseNodeId] : null;
  const selectedEdge = selection?.kind === 'edge' ? maps.edgesById[selection.id] : null;
  const selectedConnection =
    selection?.kind === 'connection' ? nodeConnections?.connections.find((item) => item.id === selection.id) || null : null;
  const selectedApproach =
    selection?.kind === 'approach' ? intersectionEditor?.approaches.find((item) => item.id === selection.id) || null : null;
  const selectedSign =
    selection?.kind === 'sign' ? intersectionEditor?.generated_signs.find((item) => item.id === selection.id) || null : null;
  const selectedMovement =
    selection?.kind === 'movement' ? intersectionEditor?.movements.find((item) => item.id === selection.id) || null : null;
  const selectedCrossing =
    selection?.kind === 'crossing' ? intersectionEditor?.pedestrian_crossings.find((item) => item.id === selection.id) || null : null;
  const selectedIntersection =
    selection?.kind === 'intersection' ? intersectionEditor?.intersection || nodeIntersection : selection?.kind !== 'edge' ? nodeIntersection : null;
  const activeIntersectionId = selectedIntersection?.id || intersectionEditor?.intersection.id || null;

  const [nodeDraft, setNodeDraft] = useState({code: '', x: '', y: '', type: ''});
  const [edgeDraft, setEdgeDraft] = useState({
    name: '',
    speed: '',
    priority: '',
    length: '',
    width: '',
    sidewalk_width: '',
    road_type_id: '',
  });
  const [laneDrafts, setLaneDrafts] = useState<LaneDraft[]>([]);
  const [connectionDraft, setConnectionDraft] = useState({
    from_edge_id: '',
    to_edge_id: '',
    from_lane_index: '0',
    to_lane_index: '0',
    uncontrolled: false,
  });
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, {role: 'main' | 'secondary' | ''; priority_rank: string}>>({});
  const [movementDraftKinds, setMovementDraftKinds] = useState<Record<string, string>>({});
  const [signType, setSignType] = useState<'yield' | 'stop'>('yield');
  const [crossingDraft, setCrossingDraft] = useState({
    side_key: '',
    approach_id: '',
    name: '',
    crossing_kind: 'zebra' as 'zebra' | 'signalized' | 'uncontrolled',
    is_enabled: true,
  });
  const [crossingDetailName, setCrossingDetailName] = useState('');

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    setNodeDraft({
      code: selectedNode.code,
      x: String(selectedNode.x),
      y: String(selectedNode.y),
      type: selectedNode.type || '',
    });
  }, [selectedNode]);

  useEffect(() => {
    if (!edgeEditor) {
      return;
    }

    setEdgeDraft({
      name: edgeEditor.edge.name || '',
      speed: edgeEditor.edge.speed?.toString() || '',
      priority: edgeEditor.edge.priority?.toString() || '',
      length: edgeEditor.edge.length?.toString() || '',
      width: edgeEditor.edge.width?.toString() || '',
      sidewalk_width: edgeEditor.edge.sidewalk_width?.toString() || '',
      road_type_id: edgeEditor.edge.road_type_id || '',
    });
    setLaneDrafts(
      edgeEditor.edge.lanes.map((lane) => ({
        index: lane.index,
        allow: lane.allow || '',
        disallow: lane.disallow || '',
        speed: lane.speed?.toString() || '',
        width: lane.width?.toString() || '',
      })),
    );
  }, [edgeEditor]);

  useEffect(() => {
    if (!nodeConnections) {
      return;
    }

    const firstIncoming = nodeConnections.incoming_edges[0];
    const firstOutgoing = nodeConnections.outgoing_edges[0];
    setConnectionDraft({
      from_edge_id: firstIncoming?.id || '',
      to_edge_id: firstOutgoing?.id || '',
      from_lane_index: '0',
      to_lane_index: '0',
      uncontrolled: false,
    });
  }, [nodeConnections]);

  useEffect(() => {
    if (!intersectionEditor) {
      return;
    }

    setPriorityDrafts(
      Object.fromEntries(
        intersectionEditor.approaches.map((approach) => [
          approach.id,
          {
            role: approach.role || '',
            priority_rank: approach.priority_rank === null ? '' : String(approach.priority_rank),
          },
        ]),
      ),
    );
    setMovementDraftKinds(
      Object.fromEntries(intersectionEditor.movements.map((movement) => [movement.id, movement.movement_kind || ''])),
    );
    const firstAvailableSide = intersectionEditor.pedestrian_crossing_sides.candidate_sides.find((item) => !item.already_has_crossing);
    setCrossingDraft({
      side_key: firstAvailableSide?.side_key || '',
      approach_id: firstAvailableSide?.approach_id || '',
      name: '',
      crossing_kind: 'zebra',
      is_enabled: true,
    });
  }, [intersectionEditor]);

  useEffect(() => {
    setCrossingDetailName(selectedCrossing?.name || '');
  }, [selectedCrossing]);

  if (!selection) {
    return (
      <aside className="inspector">
        <div className="eyebrow">Инспектор</div>
        <h2>Ничего не выбрано</h2>
        <p className="muted">Выберите узел или ребро на схеме, чтобы смотреть данные backend и выполнять операции.</p>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <div className="eyebrow">Инспектор</div>
      <h2>{translateSelectionKind(selection.kind)}</h2>

      {selectedNode && (
        <SectionCard title="Узел / точка">
          <p>{describeNode(selectedNode, maps.incomingByNodeId[selectedNode.id]?.length || 0, maps.outgoingByNodeId[selectedNode.id]?.length || 0, Boolean(nodeIntersection))}</p>
          <PropertyTable
            items={[
              ['id', selectedNode.id],
              ['code', selectedNode.code],
              ['project_id', selectedNode.project_id],
              ['x', formatNumber(selectedNode.x, 2)],
              ['y', formatNumber(selectedNode.y, 2)],
              ['тип узла', selectedNode.type || 'null'],
              ['имя', 'недоступно в текущем NodeRead DTO'],
              ['входящих ребер', String(maps.incomingByNodeId[selectedNode.id]?.length || 0)],
              ['исходящих ребер', String(maps.outgoingByNodeId[selectedNode.id]?.length || 0)],
              ['есть пересечение', String(Boolean(nodeIntersection))],
            ]}
          />
          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await onPatchNode(selectedNode.id, {
                code: nodeDraft.code.trim(),
                x: Number(nodeDraft.x),
                y: Number(nodeDraft.y),
                type: nodeDraft.type.trim() || null,
              });
            }}
          >
            <label className="field">
              <span>Код</span>
              <input value={nodeDraft.code} onChange={(event) => setNodeDraft((current) => ({...current, code: event.target.value}))} />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>X</span>
                <input value={nodeDraft.x} onChange={(event) => setNodeDraft((current) => ({...current, x: event.target.value}))} />
              </label>
              <label className="field">
                <span>Y</span>
                <input value={nodeDraft.y} onChange={(event) => setNodeDraft((current) => ({...current, y: event.target.value}))} />
              </label>
            </div>
            <label className="field">
              <span>Тип</span>
              <input value={nodeDraft.type} onChange={(event) => setNodeDraft((current) => ({...current, type: event.target.value}))} />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              Сохранить узел
            </button>
          </form>
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedNode)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedEdge && edgeEditor && (
        <SectionCard title="Ребро / линия">
          <p>{describeEdge(edgeEditor.edge)}</p>
          <PropertyTable
            items={[
              ['id', edgeEditor.edge.id],
              ['code', edgeEditor.edge.code],
              ['from_node_id', edgeEditor.edge.from_node_id],
              ['to_node_id', edgeEditor.edge.to_node_id],
              ['имя', edgeEditor.edge.name || 'null'],
              ['скорость', formatNumber(edgeEditor.edge.speed, 1)],
              ['приоритет', edgeEditor.edge.priority?.toString() || 'null'],
              ['длина', formatNumber(edgeEditor.edge.length, 2)],
              ['road_type_id', edgeEditor.edge.road_type_id || 'null'],
              ['покрытие', 'недоступно в текущем EdgeRead DTO'],
              ['точек в shape', String(edgeEditor.edge.shape.length)],
              ['сводка по полосам', formatLaneSummary(edgeEditor.edge)],
              [
                'связанных соединений',
                String(
                  edgeConnectionContext?.connections.filter(
                    (connection) => connection.from_edge_id === edgeEditor.edge.id || connection.to_edge_id === edgeEditor.edge.id,
                  ).length || 0,
                ),
              ],
            ]}
          />

          <form
            className="stack-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await onPatchEdge(edgeEditor.edge.id, {
                name: edgeDraft.name.trim() || null,
                speed: edgeDraft.speed ? Number(edgeDraft.speed) : null,
                priority: edgeDraft.priority ? Number(edgeDraft.priority) : null,
                length: edgeDraft.length ? Number(edgeDraft.length) : null,
                width: edgeDraft.width ? Number(edgeDraft.width) : null,
                sidewalk_width: edgeDraft.sidewalk_width ? Number(edgeDraft.sidewalk_width) : null,
                road_type_id: edgeDraft.road_type_id || null,
              });
            }}
          >
            <label className="field">
              <span>Имя</span>
              <input value={edgeDraft.name} onChange={(event) => setEdgeDraft((current) => ({...current, name: event.target.value}))} />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Скорость</span>
                <input value={edgeDraft.speed} onChange={(event) => setEdgeDraft((current) => ({...current, speed: event.target.value}))} />
              </label>
              <label className="field">
                <span>Приоритет</span>
                <input value={edgeDraft.priority} onChange={(event) => setEdgeDraft((current) => ({...current, priority: event.target.value}))} />
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Длина</span>
                <input value={edgeDraft.length} onChange={(event) => setEdgeDraft((current) => ({...current, length: event.target.value}))} />
              </label>
              <label className="field">
                <span>Ширина</span>
                <input value={edgeDraft.width} onChange={(event) => setEdgeDraft((current) => ({...current, width: event.target.value}))} />
              </label>
            </div>
            <label className="field">
              <span>Тип дороги</span>
              <select value={edgeDraft.road_type_id} onChange={(event) => setEdgeDraft((current) => ({...current, road_type_id: event.target.value}))}>
                <option value="">Без типа дороги</option>
                {roadTypes.map((roadType) => (
                  <option key={roadType.id} value={roadType.id}>
                    {roadType.code}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={busy}>
                Сохранить ребро
              </button>
              <button className="secondary-button" type="button" disabled={!edgeDraft.road_type_id || busy} onClick={() => onApplyRoadType(edgeEditor.edge.id, edgeDraft.road_type_id)}>
                Применить тип
              </button>
              <button className="secondary-button" type="button" disabled={busy} onClick={() => onRecalculateLength(edgeEditor.edge.id)}>
                Пересчитать длину
              </button>
            </div>
          </form>

          <div className="card card--nested">
            <h4>Полосы</h4>
            <div className="stack-list">
              {laneDrafts.map((lane, index) => (
                <div className="lane-row" key={index}>
                  <div className="field-grid">
                    <label className="field">
                      <span>Индекс</span>
                      <input
                        value={lane.index}
                        onChange={(event) =>
                          setLaneDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? {...item, index: Number(event.target.value)} : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Скорость</span>
                      <input
                        value={lane.speed}
                        onChange={(event) =>
                          setLaneDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? {...item, speed: event.target.value} : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="field-grid">
                    <label className="field">
                      <span>Ширина</span>
                      <input
                        value={lane.width}
                        onChange={(event) =>
                          setLaneDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? {...item, width: event.target.value} : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Разрешено</span>
                      <input
                        value={lane.allow}
                        onChange={(event) =>
                          setLaneDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? {...item, allow: event.target.value} : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Запрещено</span>
                    <input
                      value={lane.disallow}
                      onChange={(event) =>
                        setLaneDrafts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? {...item, disallow: event.target.value} : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() =>
                onReplaceLanes(
                  edgeEditor.edge.id,
                  laneDrafts.map((lane) => ({
                    index: lane.index,
                    allow: lane.allow || null,
                    disallow: lane.disallow || null,
                    speed: lane.speed ? Number(lane.speed) : null,
                    width: lane.width ? Number(lane.width) : null,
                  })),
                )
              }
            >
              Заменить список полос
            </button>
          </div>

          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(edgeEditor)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedConnection && (
        <SectionCard title="Соединение">
          <p>{describeConnection(selectedConnection)}</p>
          <PropertyTable
            items={[
              ['id', selectedConnection.id],
              ['from_edge_id', selectedConnection.from_edge_id],
              ['to_edge_id', selectedConnection.to_edge_id],
              ['from_lane_index', String(selectedConnection.from_lane_index)],
              ['to_lane_index', String(selectedConnection.to_lane_index)],
              ['via_node_id', selectedConnection.via_node_id],
              ['без регулирования', String(selectedConnection.uncontrolled)],
            ]}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={selectedConnection.uncontrolled}
              onChange={(event) => onPatchConnection(selectedConnection.id, {uncontrolled: event.target.checked})}
            />
            <span>Без регулирования</span>
          </label>
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedConnection)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedNode && (
        <SectionCard title="Редактор соединений">
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => onAutogenerateConnections(selectedNode.id)}>
              Автосоздать недостающие
            </button>
          </div>
          {nodeConnections ? (
            <>
              <PropertyTable
                items={[
                  ['узел', nodeConnections.node.code],
                  ['входящих ребер', String(nodeConnections.incoming_edges.length)],
                  ['исходящих ребер', String(nodeConnections.outgoing_edges.length)],
                  ['соединений', String(nodeConnections.connections.length)],
                ]}
              />
              <div className="stack-form">
                <label className="field">
                  <span>Из ребра</span>
                  <select
                    value={connectionDraft.from_edge_id}
                    onChange={(event) => setConnectionDraft((current) => ({...current, from_edge_id: event.target.value}))}
                  >
                    {nodeConnections.incoming_edges.map((edge) => (
                      <option key={edge.id} value={edge.id}>
                        {edge.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>В ребро</span>
                  <select
                    value={connectionDraft.to_edge_id}
                    onChange={(event) => setConnectionDraft((current) => ({...current, to_edge_id: event.target.value}))}
                  >
                    {nodeConnections.outgoing_edges.map((edge) => (
                      <option key={edge.id} value={edge.id}>
                        {edge.code}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-grid">
                  <label className="field">
                    <span>Из полосы</span>
                    <input
                      value={connectionDraft.from_lane_index}
                      onChange={(event) => setConnectionDraft((current) => ({...current, from_lane_index: event.target.value}))}
                    />
                  </label>
                  <label className="field">
                    <span>В полосу</span>
                    <input
                      value={connectionDraft.to_lane_index}
                      onChange={(event) => setConnectionDraft((current) => ({...current, to_lane_index: event.target.value}))}
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={connectionDraft.uncontrolled}
                    onChange={(event) => setConnectionDraft((current) => ({...current, uncontrolled: event.target.checked}))}
                  />
                  <span>Без регулирования</span>
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!connectionDraft.from_edge_id || !connectionDraft.to_edge_id || busy}
                  onClick={() =>
                    onCreateConnection({
                      via_node_id: selectedNode.id,
                      from_edge_id: connectionDraft.from_edge_id,
                      to_edge_id: connectionDraft.to_edge_id,
                      from_lane_index: Number(connectionDraft.from_lane_index),
                      to_lane_index: Number(connectionDraft.to_lane_index),
                      uncontrolled: connectionDraft.uncontrolled,
                    })
                  }
                >
                  Создать соединение
                </button>
              </div>
              <div className="stack-list">
                {nodeConnections.connections.map((connection) => (
                  <button
                    key={connection.id}
                    type="button"
                    className={selection.kind === 'connection' && selection.id === connection.id ? 'list-button list-button--active' : 'list-button'}
                    onClick={() => onSelect({kind: 'connection', id: connection.id, nodeId: selectedNode.id})}
                  >
                    <strong>{connection.from_edge_code}</strong> полоса {connection.from_lane_index} → <strong>{connection.to_edge_code}</strong> полоса {connection.to_lane_index}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Данные соединений загружаются для выбранного узла.</p>
          )}

          {connectionCandidates && (
            <details>
              <summary>Диагностика кандидатов</summary>
              <pre className="json-panel">{formatJson(connectionCandidates)}</pre>
            </details>
          )}
        </SectionCard>
      )}

      {selectedNode && (
        <SectionCard title="Редактор пересечения">
          {!selectedIntersection ? (
            <>
              <p className="muted">Для этого узла еще нет записи пересечения.</p>
              <button className="primary-button" type="button" disabled={busy} onClick={() => onCreateIntersection(selectedNode.id)}>
                Создать пересечение из узла
              </button>
            </>
          ) : (
            <>
              {intersectionEditor && <p>{describeIntersection(intersectionEditor)}</p>}
              <PropertyTable
                items={[
                  ['id', selectedIntersection.id],
                  ['node_id', selectedIntersection.node_id],
                  ['тип', selectedIntersection.kind],
                  ['control_type', 'недоступно в текущем DTO IntersectionResponse'],
                  ['подходов', String(intersectionEditor?.approaches.length || 0)],
                  ['маневров', String(intersectionEditor?.movements.length || 0)],
                  ['сгенерированных знаков', String(intersectionEditor?.generated_signs.length || 0)],
                  ['статус проверки', intersectionValidation?.is_valid ? 'пройдена' : intersectionValidation ? 'ошибки' : 'не загружена'],
                ]}
              />
              <div className="button-row">
                <button className="secondary-button" type="button" disabled={busy} onClick={() => onSyncApproaches(selectedIntersection.id)}>
                  Синхронизировать подходы
                </button>
                <button className="secondary-button" type="button" disabled={busy} onClick={() => onSyncMovements(selectedIntersection.id)}>
                  Синхронизировать маневры
                </button>
                <button className="secondary-button" type="button" disabled={busy} onClick={() => onValidateIntersection(selectedIntersection.id)}>
                  Проверить пересечение
                </button>
                <button className="secondary-button" type="button" disabled={busy} onClick={() => onValidatePriorityScheme(selectedIntersection.id)}>
                  Проверить приоритет
                </button>
              </div>

              {intersectionEditor && (
                <>
                  <div className="card card--nested">
                    <h4>Схема приоритета</h4>
                    <PropertyTable
                      items={[
                        ['главных', String(intersectionEditor.priority_scheme.summary.main_count)],
                        ['второстепенных', String(intersectionEditor.priority_scheme.summary.secondary_count)],
                        ['не назначено', String(intersectionEditor.priority_scheme.summary.unassigned_count)],
                        ['схема полная', String(intersectionEditor.priority_scheme.summary.is_complete)],
                        ['есть конфликты', String(intersectionEditor.priority_scheme.summary.has_conflicts)],
                      ]}
                    />
                    {intersectionEditor.approaches.map((approach) => {
                      const draft = priorityDrafts[approach.id] || {role: '', priority_rank: ''};
                      return (
                        <div key={approach.id} className="lane-row">
                          <button className="text-button" type="button" onClick={() => onSelect({kind: 'approach', id: approach.id, intersectionId: selectedIntersection.id, nodeId: selectedNode.id})}>
                            {approach.incoming_edge_code}
                          </button>
                          <div className="field-grid">
                            <label className="field">
                              <span>Роль</span>
                              <select
                                value={draft.role}
                                onChange={(event) =>
                                  setPriorityDrafts((current) => ({
                                    ...current,
                                    [approach.id]: {
                                      ...draft,
                                      role: event.target.value as 'main' | 'secondary' | '',
                                    },
                                  }))
                                }
                              >
                                <option value="">Не задано</option>
                                <option value="main">Главная</option>
                                <option value="secondary">Второстепенная</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>Ранг приоритета</span>
                              <input
                                value={draft.priority_rank}
                                onChange={(event) =>
                                  setPriorityDrafts((current) => ({
                                    ...current,
                                    [approach.id]: {
                                      ...draft,
                                      priority_rank: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                    <div className="button-row">
                      <button
                        className="primary-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onSavePriorityScheme(
                            selectedIntersection.id,
                            intersectionEditor.approaches.map((approach) => {
                              const draft = priorityDrafts[approach.id] || {role: '', priority_rank: ''};
                              return {
                                approach_id: approach.id,
                                role: draft.role || null,
                                priority_rank: draft.priority_rank ? Number(draft.priority_rank) : null,
                              };
                            }),
                          )
                        }
                      >
                        Сохранить схему
                      </button>
                      <label className="field">
                        <span>Знак для второстепенной</span>
                        <select value={signType} onChange={(event) => setSignType(event.target.value as 'yield' | 'stop')}>
                          <option value="yield">2.4 Уступите дорогу</option>
                          <option value="stop">2.5 STOP</option>
                        </select>
                      </label>
                      <button className="secondary-button" type="button" disabled={busy} onClick={() => onGenerateSigns(selectedIntersection.id, signType)}>
                        Сгенерировать знаки
                      </button>
                    </div>
                  </div>

                  <div className="card card--nested">
                    <h4>Маневры</h4>
                    <div className="stack-list">
                      {intersectionEditor.movements.map((movement) => (
                        <div className="lane-row" key={movement.id}>
                          <button className="text-button" type="button" onClick={() => onSelect({kind: 'movement', id: movement.id, intersectionId: selectedIntersection.id, nodeId: selectedNode.id})}>
                            {movement.from_edge_id} → {movement.to_edge_id}
                          </button>
                          <div className="field-grid">
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={movement.is_enabled}
                                onChange={(event) => onPatchMovement(selectedIntersection.id, movement.id, {is_enabled: event.target.checked})}
                              />
                              <span>Разрешен</span>
                            </label>
                            <label className="field">
                              <span>Тип</span>
                              <input
                                value={movementDraftKinds[movement.id] || ''}
                                onChange={(event) =>
                                  setMovementDraftKinds((current) => ({
                                    ...current,
                                    [movement.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onPatchMovement(selectedIntersection.id, movement.id, {
                                movement_kind: (movementDraftKinds[movement.id] || '').trim() || null,
                              })
                            }
                          >
                            Обновить маневр
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card card--nested">
                    <h4>Сгенерированные знаки</h4>
                    <div className="stack-list">
                      {intersectionEditor.generated_signs.map((sign) => (
                        <button
                          key={sign.id}
                          type="button"
                          className={selection.kind === 'sign' && selection.id === sign.id ? 'list-button list-button--active' : 'list-button'}
                          onClick={() => onSelect({kind: 'sign', id: sign.id, intersectionId: selectedIntersection.id, nodeId: selectedNode.id})}
                        >
                          {sign.sign_type} на {sign.edge_id || 'н/д'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card card--nested">
                    <h4>Пешеходные переходы</h4>
                    <PropertyTable
                      items={[
                        ['переходов', String(intersectionEditor.pedestrian_crossings.length)],
                        ['доступных сторон', String(intersectionEditor.pedestrian_crossing_sides.candidate_sides.length)],
                        ['предупреждения', intersectionEditor.pedestrian_crossing_sides.warnings.join('; ') || 'нет'],
                        ['ошибки', intersectionEditor.pedestrian_crossing_sides.errors.join('; ') || 'нет'],
                      ]}
                    />
                    <div className="stack-form">
                      <label className="field">
                        <span>Сторона</span>
                        <select
                          value={crossingDraft.side_key}
                          onChange={(event) => {
                            const candidate = intersectionEditor.pedestrian_crossing_sides.candidate_sides.find((item) => item.side_key === event.target.value);
                            setCrossingDraft((current) => ({
                              ...current,
                              side_key: event.target.value,
                              approach_id: candidate?.approach_id || '',
                            }));
                          }}
                        >
                          <option value="">Выберите сторону</option>
                          {intersectionEditor.pedestrian_crossing_sides.candidate_sides.map((side) => (
                            <option key={side.side_key} value={side.side_key} disabled={side.already_has_crossing}>
                              {side.incoming_edge_code || side.side_key} {side.already_has_crossing ? '· уже занят' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="field-grid">
                        <label className="field">
                          <span>Название</span>
                          <input value={crossingDraft.name} onChange={(event) => setCrossingDraft((current) => ({...current, name: event.target.value}))} />
                        </label>
                        <label className="field">
                          <span>Тип перехода</span>
                          <select
                            value={crossingDraft.crossing_kind}
                            onChange={(event) =>
                              setCrossingDraft((current) => ({
                                ...current,
                                crossing_kind: event.target.value as 'zebra' | 'signalized' | 'uncontrolled',
                              }))
                            }
                          >
                            <option value="zebra">Зебра</option>
                            <option value="signalized">Регулируемый</option>
                            <option value="uncontrolled">Нерегулируемый</option>
                          </select>
                        </label>
                      </div>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={crossingDraft.is_enabled}
                          onChange={(event) => setCrossingDraft((current) => ({...current, is_enabled: event.target.checked}))}
                        />
                        <span>Сразу включить</span>
                      </label>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={busy || !crossingDraft.side_key}
                        onClick={() =>
                          onCreateCrossing({
                            intersectionId: selectedIntersection.id,
                            approach_id: crossingDraft.approach_id || null,
                            side_key: crossingDraft.side_key,
                            is_enabled: crossingDraft.is_enabled,
                            name: crossingDraft.name.trim() || null,
                            crossing_kind: crossingDraft.crossing_kind,
                          })
                        }
                      >
                        Создать переход
                      </button>
                    </div>

                    <div className="stack-list">
                      {intersectionEditor.pedestrian_crossings.map((crossing) => (
                        <div className="lane-row" key={crossing.id}>
                          <button
                            type="button"
                            className={selection.kind === 'crossing' && selection.id === crossing.id ? 'list-button list-button--active' : 'list-button'}
                            onClick={() => onSelect({kind: 'crossing', id: crossing.id, intersectionId: selectedIntersection.id, nodeId: selectedNode.id})}
                          >
                            {(crossing.incoming_edge_code || crossing.side_key) + ' · ' + getCrossingKindLabel(crossing.crossing_kind)}
                          </button>
                          <div className="field-grid">
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={crossing.is_enabled}
                                onChange={(event) =>
                                  onPatchCrossing(selectedIntersection.id, crossing.id, {
                                    is_enabled: event.target.checked,
                                  })
                                }
                              />
                              <span>Включен</span>
                            </label>
                            <label className="field">
                              <span>Тип</span>
                              <select
                                value={crossing.crossing_kind || 'zebra'}
                                onChange={(event) =>
                                  onPatchCrossing(selectedIntersection.id, crossing.id, {
                                    crossing_kind: event.target.value as 'zebra' | 'signalized' | 'uncontrolled',
                                  })
                                }
                              >
                                <option value="zebra">Зебра</option>
                                <option value="signalized">Регулируемый</option>
                                <option value="uncontrolled">Нерегулируемый</option>
                              </select>
                            </label>
                          </div>
                          <div className="button-row">
                            <button className="secondary-button" type="button" disabled={busy} onClick={() => onDeleteCrossing(selectedIntersection.id, crossing.id)}>
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <details>
                    <summary>Сырой JSON backend</summary>
                    <pre className="json-panel">{formatJson(intersectionEditor)}</pre>
                  </details>
                </>
              )}
            </>
          )}
        </SectionCard>
      )}

      {selectedApproach && (
        <SectionCard title="Детали подхода">
          <PropertyTable
            items={[
              ['id', selectedApproach.id],
              ['id входящего ребра', selectedApproach.incoming_edge_id],
              ['код входящего ребра', selectedApproach.incoming_edge_code],
              ['роль', selectedApproach.role || 'null'],
              ['ранг приоритета', selectedApproach.priority_rank?.toString() || 'null'],
            ]}
          />
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedApproach)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedSign && (
        <SectionCard title="Детали знака">
          <p>{describeSign(selectedSign)}</p>
          <PropertyTable
            items={[
              ['id', selectedSign.id],
              ['тип знака', selectedSign.sign_type],
              ['связь с пересечением', selectedSign.intersection_id || 'null'],
              ['связь с ребром', selectedSign.edge_id || 'null'],
              ['данные размещения', selectedSign.metadata ? JSON.stringify(selectedSign.metadata) : 'null'],
            ]}
          />
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedSign)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedMovement && (
        <SectionCard title="Детали маневра">
          <p>{describeMovement(selectedMovement)}</p>
          <PropertyTable
            items={[
              ['id', selectedMovement.id],
              ['из ребра', selectedMovement.from_edge_id],
              ['в ребро', selectedMovement.to_edge_id],
              ['тип поворота', selectedMovement.movement_kind || 'null'],
              ['разрешен', String(selectedMovement.is_enabled)],
            ]}
          />
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedMovement)}</pre>
          </details>
        </SectionCard>
      )}

      {selectedCrossing && (
        <SectionCard title="Детали перехода">
          <p>{describeCrossing(selectedCrossing)}</p>
          <PropertyTable
            items={[
              ['id', selectedCrossing.id],
              ['side_key', selectedCrossing.side_key],
              ['approach_id', selectedCrossing.approach_id || 'null'],
              ['incoming_edge_code', selectedCrossing.incoming_edge_code || 'null'],
              ['включен', String(selectedCrossing.is_enabled)],
              ['тип', selectedCrossing.crossing_kind || 'null'],
              ['имя', selectedCrossing.name || 'null'],
            ]}
          />
          <div className="stack-form">
            <label className="field">
              <span>Имя</span>
              <input value={crossingDetailName} onChange={(event) => setCrossingDetailName(event.target.value)} />
            </label>
            <div className="button-row">
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={() => onPatchCrossing(selectedCrossing.intersection_id, selectedCrossing.id, {name: crossingDetailName.trim() || null})}
              >
                Сохранить имя
              </button>
              <button className="secondary-button" type="button" disabled={busy} onClick={() => onDeleteCrossing(selectedCrossing.intersection_id, selectedCrossing.id)}>
                Удалить переход
              </button>
            </div>
          </div>
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selectedCrossing)}</pre>
          </details>
        </SectionCard>
      )}

      {selection.kind === 'validation' && activeIntersectionId && (
        <SectionCard title="Детали проверки">
          {selection.scope === 'intersection' && intersectionValidation && <p>{describeValidation(intersectionValidation, 'intersection')}</p>}
          {selection.scope === 'priority' && priorityValidation && <p>{describeValidation(priorityValidation, 'priority')}</p>}
          <PropertyTable
            items={[
              ['endpoint проверки', selection.scope === 'intersection' ? `/projects/:id/intersections/${activeIntersectionId}/validation` : `/projects/:id/intersections/${activeIntersectionId}/priority-validation`],
              ['последняя загрузка', selection.scope === 'intersection' ? formatDate(intersectionValidation ? new Date().toISOString() : null) : formatDate(priorityValidation ? new Date().toISOString() : null)],
            ]}
          />
          <details>
            <summary>Сырой JSON backend</summary>
            <pre className="json-panel">{formatJson(selection.scope === 'intersection' ? intersectionValidation : priorityValidation)}</pre>
          </details>
        </SectionCard>
      )}
    </aside>
  );
}

function SectionCard({title, children}: {title: string; children: ReactNode}) {
  return (
    <section className="card inspector-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function PropertyTable({items}: {items: Array<[string, string]>}) {
  return (
    <dl className="property-table">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function translateSelectionKind(kind: NonNullable<EntitySelection>['kind']): string {
  switch (kind) {
    case 'node':
      return 'узел';
    case 'edge':
      return 'ребро';
    case 'connection':
      return 'соединение';
    case 'intersection':
      return 'пересечение';
    case 'approach':
      return 'подход';
    case 'sign':
      return 'знак';
    case 'movement':
      return 'маневр';
    case 'validation':
      return 'проверка';
    case 'crossing':
      return 'переход';
    default:
      return String(kind);
  }
}
