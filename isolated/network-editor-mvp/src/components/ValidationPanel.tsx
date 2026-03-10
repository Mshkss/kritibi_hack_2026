import {useState} from 'react';
import type {IntersectionValidationResponse, PrioritySchemeValidationResponse} from '@/types/api';
import type {ApiLogEntry} from '@/types/editor';
import {formatJson} from '@/utils/format';

interface ValidationPanelProps {
  intersectionValidation: IntersectionValidationResponse | null;
  priorityValidation: PrioritySchemeValidationResponse | null;
  logs: ApiLogEntry[];
  selectedRawJson: unknown;
  unsupportedNotes: string[];
}

type PanelTab = 'validation' | 'logs' | 'raw';

const TAB_LABELS: Record<PanelTab, string> = {
  validation: 'Проверки',
  logs: 'Запросы',
  raw: 'JSON',
};

export function ValidationPanel({
  intersectionValidation,
  priorityValidation,
  logs,
  selectedRawJson,
  unsupportedNotes,
}: ValidationPanelProps) {
  const [tab, setTab] = useState<PanelTab>('validation');

  return (
    <section className="diagnostics-panel">
      <div className="diagnostics-panel__header">
        <div>
          <div className="eyebrow">Диагностика</div>
          <h2>Проверки и журнал запросов</h2>
        </div>

        <div className="tab-strip">
          {(['validation', 'logs', 'raw'] as PanelTab[]).map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => setTab(item)}
            >
              {TAB_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'validation' && (
        <div className="diagnostics-grid">
          <article className="card">
            <h3>Проверка пересечения</h3>
            {intersectionValidation ? (
              <>
                <div className={intersectionValidation.is_valid ? 'banner banner--success' : 'banner banner--danger'}>
                  {intersectionValidation.is_valid ? 'Проверка пройдена' : 'Есть ошибки'}
                </div>
                <ul className="compact-list">
                  {intersectionValidation.errors.map((item) => (
                    <li key={`e-${item}`}>{item}</li>
                  ))}
                  {intersectionValidation.warnings.map((item) => (
                    <li key={`w-${item}`}>{item}</li>
                  ))}
                  {intersectionValidation.empty_approaches.map((item) => (
                    <li key={`a-${item}`}>Пустой подход: {item}</li>
                  ))}
                  {intersectionValidation.missing_movements.map((item) => (
                    <li key={`m-${item}`}>Отсутствует маневр: {item}</li>
                  ))}
                  {intersectionValidation.stale_movements.map((item) => (
                    <li key={`s-${item}`}>Устаревший маневр: {item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Выберите узел с пересечением, чтобы загрузить диагностику.</p>
            )}
          </article>

          <article className="card">
            <h3>Проверка приоритета</h3>
            {priorityValidation ? (
              <>
                <div className={priorityValidation.is_valid ? 'banner banner--success' : 'banner banner--warning'}>
                  {priorityValidation.is_valid ? 'Готово к использованию' : 'Нужно исправить'}
                </div>
                <ul className="compact-list">
                  <li>Схема полная: {String(priorityValidation.is_complete)}</li>
                  <li>Экспорт с приоритетом: {String(priorityValidation.exportable_as_priority_controlled)}</li>
                  {priorityValidation.missing_roles.map((item) => (
                    <li key={`r-${item}`}>Не назначена роль: {item}</li>
                  ))}
                  {priorityValidation.errors.map((item) => (
                    <li key={`pe-${item}`}>{item}</li>
                  ))}
                  {priorityValidation.warnings.map((item) => (
                    <li key={`pw-${item}`}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Проверка приоритета загружается для активного пересечения.</p>
            )}
          </article>

          <article className="card">
            <h3>Ограничения backend</h3>
            <ul className="compact-list">
              {unsupportedNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {tab === 'logs' && (
        <div className="log-list">
          {logs.length === 0 && <p className="muted">Запросов пока нет.</p>}
          {logs.map((entry) => (
            <article key={entry.id} className="log-entry">
              <div className="log-entry__top">
                <strong>{entry.method}</strong>
                <span>{entry.path}</span>
                <span className={entry.status === 'error' || (typeof entry.status === 'number' && entry.status >= 400) ? 'status-badge status-badge--danger' : 'status-badge'}>
                  {entry.status}
                </span>
                <span>{Math.round(entry.durationMs)} ms</span>
              </div>
              {entry.errorMessage && <p className="log-entry__error">{entry.errorMessage}</p>}
            </article>
          ))}
        </div>
      )}

      {tab === 'raw' && (
        <pre className="json-panel">{selectedRawJson ? formatJson(selectedRawJson) : 'Выберите сущность, чтобы посмотреть сырой ответ backend.'}</pre>
      )}
    </section>
  );
}
