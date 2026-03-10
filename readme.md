# ITS Road Network Backend

Backend для системы проектирования интеллектуальной дорожно-транспортной сети.

Текущий этап: **Network Constructor + Road Segment Editor**.

Реализовано:
- foundation (config/env, DB/session, Alembic, healthcheck, Project CRUD)
- ядро дорожного графа: `Node`, `Edge`, `Lane`, `RoadType`
- API для базового цикла конструктора сети
- editor-операции для параметров участка (`Edge`) и полос (`Lane`)

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment

```bash
cp ../.env.example .env
```

`DATABASE_URL` можно использовать как SQLite для быстрого старта, так и PostgreSQL.

## Migrations

```bash
cd backend
alembic -c alembic.ini upgrade head
```

## Run API

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger:
- `http://localhost:8000/docs`

## Docker Compose

```bash
docker compose -f infra/compose.yml up --build -d
docker compose -f infra/compose.yml exec backend alembic -c alembic.ini upgrade head
```

## Available endpoints (current stage)

- `GET /health`

- `POST /projects`
- `GET /projects`
- `GET /projects/{project_id}`
- `PATCH /projects/{project_id}`
- `DELETE /projects/{project_id}`
- `GET /projects/{project_id}/network`

- `POST /projects/{project_id}/nodes`
- `GET /projects/{project_id}/nodes`
- `PATCH /projects/{project_id}/nodes/{node_id}`
- `DELETE /projects/{project_id}/nodes/{node_id}`

- `POST /projects/{project_id}/road-types`
- `GET /projects/{project_id}/road-types`
- `PATCH /projects/{project_id}/road-types/{road_type_id}`

- `POST /projects/{project_id}/edges`
- `POST /projects/{project_id}/edges/bidirectional`
- `GET /projects/{project_id}/edges`
- `GET /projects/{project_id}/edges/{edge_id}`
- `GET /projects/{project_id}/edges/{edge_id}/editor`
- `PATCH /projects/{project_id}/edges/{edge_id}`
- `PATCH /projects/{project_id}/edges/{edge_id}/shape`
- `POST /projects/{project_id}/edges/{edge_id}/recalculate-length`
- `PUT /projects/{project_id}/edges/{edge_id}/lanes`
- `PATCH /projects/{project_id}/edges/{edge_id}/lanes/{lane_id}`
- `POST /projects/{project_id}/edges/{edge_id}/apply-road-type`

## Contracts

- `docs/domain_contract.md`
- `docs/json_contract.md`
