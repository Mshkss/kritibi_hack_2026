import {useState} from 'react';
import type {FormEvent} from 'react';
import type {Project} from '@/types/api';

interface ProjectBarProps {
  projects: Project[];
  selectedProjectId: string;
  loading: boolean;
  busy: boolean;
  onSelectProject: (projectId: string) => void;
  onReload: () => void;
  onCreateProject: (payload: {name: string; description: string}) => Promise<void>;
}

export function ProjectBar({
  projects,
  selectedProjectId,
  loading,
  busy,
  onSelectProject,
  onReload,
  onCreateProject,
}: ProjectBarProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setCreating(true);
    try {
      await onCreateProject({name: name.trim(), description: description.trim()});
      setName('');
      setDescription('');
    } finally {
      setCreating(false);
    }
  }

  return (
    <header className="project-bar">
      <div>
        <div className="eyebrow">Изолированный MVP</div>
        <h1>Редактор дорожной сети</h1>
      </div>

      <div className="project-bar__controls">
        <label className="field">
          <span>Проект</span>
          <select value={selectedProjectId} disabled={loading || busy} onChange={(event) => onSelectProject(event.target.value)}>
            <option value="">Выберите проект</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <button className="secondary-button" type="button" disabled={!selectedProjectId || loading || busy} onClick={onReload}>
          Обновить сеть
        </button>
      </div>

      <form className="project-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Новый проект</span>
          <input value={name} placeholder="Демо Красноярск" onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="field field--wide">
          <span>Описание</span>
          <input value={description} placeholder="Необязательно" onChange={(event) => setDescription(event.target.value)} />
        </label>

        <button className="primary-button" type="submit" disabled={creating || busy}>
          Создать проект
        </button>
      </form>
    </header>
  );
}
