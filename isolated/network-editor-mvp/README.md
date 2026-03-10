# Traffic Network Editor MVP

Isolated React/Vite editor UI that talks to the existing FastAPI backend without changing the main `frontend/` app.

## Folder layout

```text
isolated/network-editor-mvp/
  src/
    api/
    components/
    hooks/
    types/
    utils/
  Dockerfile
  package.json
  vite.config.ts
```

## What it does

- Lists and creates backend projects
- Loads the real project network from `GET /projects/{project_id}/network`
- Places nodes by click and moves nodes by drag
- Creates directed or bidirectional edges from selected node pairs
- Edits edge properties and lane lists through the road-segment editor endpoints
- Loads node-level connection diagnostics, creates connections, and autogenerates missing ones
- Creates intersections on nodes, syncs approaches/movements, edits priority roles/ranks, generates signs, and runs validation
- Shows a strong inspector with backend DTO fields and raw JSON payloads
- Keeps the backend as the source of truth for persistence

## Local run

```bash
cd isolated/network-editor-mvp
npm install
npm run dev
```

Defaults:

- app: `http://127.0.0.1:3000`
- API base in browser: `/api`
- Vite proxy target: `http://127.0.0.1:8000`

Override proxy target:

```bash
cd isolated/network-editor-mvp
VITE_API_PROXY_TARGET=http://127.0.0.1:9000 npm run dev
```

## Compose run

From the repository root:

```bash
docker compose -f infra/compose.yml up --build -d backend frontend isolated-editor-ui
```

Open:

- isolated editor UI: `http://localhost:3001`
- existing frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

## Current backend-driven limits

- `NodeRead` exposes `type` but not `name`
- `IntersectionResponse` currently lacks `control_type`
- `EdgeRead` currently lacks `surface`
- No project-wide validation endpoint is exposed yet
- Shape editing is not implemented in this MVP
