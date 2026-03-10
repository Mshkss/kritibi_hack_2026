import {useEffect, useRef} from 'react';
import type {MouseEvent, PointerEvent as ReactPointerEvent, WheelEvent} from 'react';
import type {Edge, IntersectionEditorResponse, Node, Point} from '@/types/api';
import type {EditorMode, EntitySelection, ViewBoxState} from '@/types/editor';
import {getEdgeMidpoint} from '@/utils/graph';
import {getApproachRoleLabel, getRussianSignLabel} from '@/utils/format';

interface NetworkCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodesById: Record<string, Node>;
  selection: EntitySelection;
  mode: EditorMode;
  edgeDraftStartNodeId: string | null;
  viewBox: ViewBoxState;
  onViewBoxChange: (value: ViewBoxState) => void;
  onWorldClick: (point: Point) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onDragNode: (nodeId: string, point: Point, phase: 'start' | 'move' | 'end') => void;
  validationNodeIds: string[];
  intersectionEditor: IntersectionEditorResponse | null;
  onPrioritySignClick: (approachId: string) => void;
  onSelectCrossing: (crossingId: string) => void;
}

interface InteractionState {
  type: 'pan' | 'node';
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  nodeId?: string;
  startViewBox: ViewBoxState;
}

export function NetworkCanvas({
  nodes,
  edges,
  nodesById,
  selection,
  mode,
  edgeDraftStartNodeId,
  viewBox,
  onViewBoxChange,
  onWorldClick,
  onSelectNode,
  onSelectEdge,
  onDragNode,
  validationNodeIds,
  intersectionEditor,
  onPrioritySignClick,
  onSelectCrossing,
}: NetworkCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const svg = svgRef.current;
      const interaction = interactionRef.current;
      if (!svg || !interaction) {
        return;
      }

      const point = toWorldPoint(svg, viewBox, event.clientX, event.clientY);
      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        interaction.moved = true;
      }

      if (interaction.type === 'pan') {
        const rect = svg.getBoundingClientRect();
        onViewBoxChange({
          x: interaction.startViewBox.x - (deltaX / rect.width) * interaction.startViewBox.width,
          y: interaction.startViewBox.y - (deltaY / rect.height) * interaction.startViewBox.height,
          width: interaction.startViewBox.width,
          height: interaction.startViewBox.height,
        });
      }

      if (interaction.type === 'node' && interaction.nodeId) {
        onDragNode(interaction.nodeId, point, 'move');
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const svg = svgRef.current;
      const interaction = interactionRef.current;
      if (!svg || !interaction) {
        return;
      }

      if (interaction.type === 'node' && interaction.nodeId) {
        const point = toWorldPoint(svg, viewBox, event.clientX, event.clientY);
        onDragNode(interaction.nodeId, point, 'end');
      }

      interactionRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onDragNode, onViewBoxChange, viewBox]);

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const point = toWorldPoint(svg, viewBox, event.clientX, event.clientY);
    const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
    const nextWidth = viewBox.width * zoomFactor;
    const nextHeight = viewBox.height * zoomFactor;
    const offsetX = ((point.x - viewBox.x) / viewBox.width) * (nextWidth - viewBox.width);
    const offsetY = ((point.y - viewBox.y) / viewBox.height) * (nextHeight - viewBox.height);

    onViewBoxChange({
      x: viewBox.x - offsetX,
      y: viewBox.y - offsetY,
      width: nextWidth,
      height: nextHeight,
    });
  }

  function handleBackgroundClick(event: MouseEvent<SVGRectElement>) {
    if (mode !== 'add-node') {
      return;
    }

    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    onWorldClick(toWorldPoint(svg, viewBox, event.clientX, event.clientY));
  }

  function handlePanStart(event: ReactPointerEvent<SVGRectElement>) {
    if (mode !== 'select') {
      return;
    }

    interactionRef.current = {
      type: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      startViewBox: viewBox,
    };
  }

  const nodeRadius = Math.max(viewBox.width * 0.012, 5);
  const signOverlays = buildPrioritySignOverlays(intersectionEditor, nodesById);
  const crossingOverlays = buildCrossingOverlays(intersectionEditor, nodesById);

  return (
    <section className="canvas-shell">
      <div className="canvas-shell__meta">
        <div className="eyebrow">Полотно редактора</div>
        <h2>Схема сети</h2>
        <p>
          Клик по пустому месту добавляет узел. В режиме выбора можно перетаскивать узлы. Знаки приоритета у активного
          пересечения показываются прямо на линиях: клик по знаку переключает приоритет подхода.
        </p>
      </div>

      <svg ref={svgRef} className="network-canvas" viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`} onWheel={handleWheel}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(92, 106, 121, 0.2)" strokeWidth="0.8" />
          </pattern>
        </defs>

        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid)" onClick={handleBackgroundClick} onPointerDown={handlePanStart} />

        {edges.map((edge) => {
          const from = nodesById[edge.from_node_id];
          const to = nodesById[edge.to_node_id];
          if (!from || !to) {
            return null;
          }

          const selected = selection?.kind === 'edge' && selection.id === edge.id;
          const midpoint = getEdgeMidpoint(edge, nodesById);

          return (
            <g key={edge.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={selected ? '#ef7f45' : '#355c7d'}
                strokeWidth={selected ? nodeRadius * 0.55 : nodeRadius * 0.35}
                strokeLinecap="round"
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="transparent"
                strokeWidth={nodeRadius * 1.4}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectEdge(edge.id);
                }}
              />
              {midpoint && (
                <text x={midpoint.x} y={midpoint.y - nodeRadius * 0.8} className="canvas-label">
                  {edge.code}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((node) => {
          const selected = selection?.kind === 'node' && selection.id === node.id;
          const hasValidationIssue = validationNodeIds.includes(node.id);
          const pendingEdgeStart = edgeDraftStartNodeId === node.id;

          return (
            <g key={node.id}>
              {hasValidationIssue && <circle cx={node.x} cy={node.y} r={nodeRadius * 1.9} fill="rgba(202, 72, 72, 0.18)" />}
              <circle
                cx={node.x}
                cy={node.y}
                r={pendingEdgeStart ? nodeRadius * 1.55 : nodeRadius * 1.3}
                fill={selected ? '#f2d16b' : pendingEdgeStart ? '#ef7f45' : '#f4f0e5'}
                stroke={hasValidationIssue ? '#ca4848' : '#15212d'}
                strokeWidth={selected ? 2.8 : 1.6}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNode(node.id);
                }}
                onPointerDown={(event) => {
                  if (mode !== 'select') {
                    return;
                  }
                  event.stopPropagation();
                  interactionRef.current = {
                    type: 'node',
                    pointerId: event.pointerId,
                    nodeId: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                    startViewBox: viewBox,
                  };
                  onDragNode(node.id, {x: node.x, y: node.y}, 'start');
                }}
              />
              <text x={node.x + nodeRadius * 1.5} y={node.y - nodeRadius * 1.5} className="canvas-label">
                {node.code}
              </text>
            </g>
          );
        })}

        {signOverlays.map((overlay) => (
          <g
            key={overlay.approachId}
            className="priority-sign"
            transform={`translate(${overlay.anchor.x}, ${overlay.anchor.y})`}
            onClick={(event) => {
              event.stopPropagation();
              onPrioritySignClick(overlay.approachId);
            }}
          >
            {overlay.signType === 'main_road' && (
              <g>
                <rect x={-13} y={-13} width={26} height={26} transform="rotate(45)" rx={3} fill="#ffffff" stroke="#101820" strokeWidth={1.5} />
                <rect x={-9} y={-9} width={18} height={18} transform="rotate(45)" rx={2} fill="#f4c542" stroke="#101820" strokeWidth={1.2} />
              </g>
            )}
            {overlay.signType === 'yield' && (
              <g>
                <polygon points="0,14 -14,-10 14,-10" fill="#ffffff" stroke="#c62828" strokeWidth={2.5} />
                <polygon points="0,7 -8,-6 8,-6" fill="#ffffff" />
              </g>
            )}
            {overlay.signType === 'stop' && (
              <g>
                <polygon points="-10,-14 10,-14 14,-10 14,10 10,14 -10,14 -14,10 -14,-10" fill="#c62828" stroke="#ffffff" strokeWidth={1.6} />
                <text x="0" y="4" textAnchor="middle" className="canvas-stop-label">
                  STOP
                </text>
              </g>
            )}
            <text x="18" y="-2" className="canvas-sign-label">
              {overlay.edgeCode}
            </text>
            <text x="18" y="10" className="canvas-sign-subtitle">
              {getRussianSignLabel(overlay.signType)} · {getApproachRoleLabel(overlay.role)}
            </text>
          </g>
        ))}

        {crossingOverlays.map((overlay) => (
          <g
            key={overlay.id}
            className="ped-crossing"
            transform={`translate(${overlay.center.x}, ${overlay.center.y}) rotate(${overlay.angle})`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectCrossing(overlay.id);
            }}
          >
            <rect
              x={-15}
              y={-6}
              width={30}
              height={12}
              rx={3}
              fill={overlay.isEnabled ? 'rgba(255,255,255,0.9)' : 'rgba(180,180,180,0.6)'}
              stroke={overlay.isEnabled ? '#0f1a24' : '#6c757d'}
              strokeWidth={1.2}
            />
            {Array.from({length: 5}).map((_, index) => (
              <rect
                key={index}
                x={-12 + index * 6}
                y={-4}
                width={3}
                height={8}
                fill={overlay.isEnabled ? '#0f1a24' : '#6c757d'}
              />
            ))}
            <text x="0" y="-9" textAnchor="middle" className="canvas-crossing-label">
              {overlay.edgeCode || overlay.sideKey}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function buildPrioritySignOverlays(
  intersectionEditor: IntersectionEditorResponse | null,
  nodesById: Record<string, Node>,
): Array<{
  approachId: string;
  edgeCode: string;
  signType: 'main_road' | 'yield' | 'stop';
  role: 'main' | 'secondary' | null;
  anchor: Point;
}> {
  if (!intersectionEditor) {
    return [];
  }

  const center = nodesById[intersectionEditor.node.id];
  if (!center) {
    return [];
  }

  return intersectionEditor.approaches
    .map((approach) => {
      const edge = intersectionEditor.incoming_edges.find((item) => item.id === approach.incoming_edge_id);
      if (!edge) {
        return null;
      }

      const from = nodesById[edge.from_node_id];
      if (!from) {
        return null;
      }

      const dx = center.x - from.x;
      const dy = center.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const offset = Math.min(52, length * 0.35);
      const anchor = {
        x: center.x - (dx / length) * offset,
        y: center.y - (dy / length) * offset,
      };
      const sign = intersectionEditor.generated_signs.find((item) => item.approach_id === approach.id);

      return {
        approachId: approach.id,
        edgeCode: approach.incoming_edge_code,
        signType: sign?.sign_type || (approach.role === 'main' ? 'main_road' : approach.role === 'secondary' ? 'yield' : 'yield'),
        role: approach.role,
        anchor,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function buildCrossingOverlays(
  intersectionEditor: IntersectionEditorResponse | null,
  nodesById: Record<string, Node>,
): Array<{
  id: string;
  sideKey: string;
  edgeCode: string | null;
  isEnabled: boolean;
  center: Point;
  angle: number;
}> {
  if (!intersectionEditor) {
    return [];
  }

  const centerNode = nodesById[intersectionEditor.node.id];
  if (!centerNode) {
    return [];
  }

  return intersectionEditor.pedestrian_crossings
    .map((crossing) => {
      const edgeId =
        crossing.incoming_edge_id ||
        intersectionEditor.approaches.find((approach) => approach.id === crossing.approach_id)?.incoming_edge_id;
      if (!edgeId) {
        return null;
      }

      const edge = intersectionEditor.incoming_edges.find((item) => item.id === edgeId);
      if (!edge) {
        return null;
      }

      const from = nodesById[edge.from_node_id];
      if (!from) {
        return null;
      }

      const dx = centerNode.x - from.x;
      const dy = centerNode.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const offset = Math.min(32, length * 0.2);

      return {
        id: crossing.id,
        sideKey: crossing.side_key,
        edgeCode: crossing.incoming_edge_code,
        isEnabled: crossing.is_enabled,
        center: {
          x: centerNode.x - (dx / length) * offset,
          y: centerNode.y - (dy / length) * offset,
        },
        angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function toWorldPoint(svg: SVGSVGElement, viewBox: ViewBoxState, clientX: number, clientY: number): Point {
  const rect = svg.getBoundingClientRect();
  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}
