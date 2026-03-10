# ITS Road Network Backend (Foundation)

Подготовительный backend-этап для системы проектирования интеллектуальной дорожно-транспортной сети.

Реализовано на этом этапе:
- FastAPI skeleton
- конфигурация через env
- SQLAlchemy session/engine слой
- Alembic миграции
- healthcheck
- CRUD для `Project`

## 1. Быстрый старт локально

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Создай `.env` (можно скопировать из `.env.example`) и при необходимости задай `DATABASE_URL`.
По умолчанию пример настроен на SQLite для быстрого локального старта.

```bash
cd backend
cp ../.env.example .env
```

## 2. Применение миграций

```bash
cd backend
alembic upgrade head
```

## 3. Запуск сервера

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger:
- `http://localhost:8000/docs`

## 4. Запуск через Docker Compose

```bash
docker compose -f infra/compose.yml up --build
```

## 5. Доступные endpoints на foundation-этапе

- `GET /health`
- `POST /projects`
- `GET /projects`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `DELETE /projects/{id}`

## 6. Контракты

- Доменный контракт: `docs/domain_contract.md`
- JSON-контракт подготовительного этапа: `docs/json_contract.md`
