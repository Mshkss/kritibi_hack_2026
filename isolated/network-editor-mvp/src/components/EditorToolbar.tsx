import type {RoadType} from '@/types/api';
import type {EditorMode} from '@/types/editor';

interface EditorToolbarProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  bidirectional: boolean;
  setBidirectional: (value: boolean) => void;
  defaultRoadTypeId: string;
  setDefaultRoadTypeId: (value: string) => void;
  roadTypes: RoadType[];
  selectedProjectId: string;
  edgeDraftStartCode?: string;
}

const MODES: Array<{id: EditorMode; label: string}> = [
  {id: 'select', label: 'Выбор'},
  {id: 'add-node', label: 'Добавить узел'},
  {id: 'add-edge', label: 'Добавить ребро'},
  {id: 'connections', label: 'Соединения'},
  {id: 'intersection', label: 'Перекресток'},
];

export function EditorToolbar({
  mode,
  setMode,
  bidirectional,
  setBidirectional,
  defaultRoadTypeId,
  setDefaultRoadTypeId,
  roadTypes,
  selectedProjectId,
  edgeDraftStartCode,
}: EditorToolbarProps) {
  return (
    <section className="toolbar">
      <div className="toolbar__modes">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === mode ? 'tool-button tool-button--active' : 'tool-button'}
            disabled={!selectedProjectId}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="toolbar__meta">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={bidirectional}
            disabled={mode !== 'add-edge' || !selectedProjectId}
            onChange={(event) => setBidirectional(event.target.checked)}
          />
          <span>Двунаправленная дорога</span>
        </label>

        <label className="field">
          <span>Тип дороги</span>
          <select value={defaultRoadTypeId} disabled={!selectedProjectId} onChange={(event) => setDefaultRoadTypeId(event.target.value)}>
            <option value="">Без типа дороги</option>
            {roadTypes.map((roadType) => (
              <option key={roadType.id} value={roadType.id}>
                {roadType.code}
              </option>
            ))}
          </select>
        </label>

        <div className="status-pill">
          {mode === 'add-edge' && edgeDraftStartCode ? `Старт ребра: ${edgeDraftStartCode}` : `Режим: ${MODES.find((item) => item.id === mode)?.label || mode}`}
        </div>
      </div>
    </section>
  );
}
