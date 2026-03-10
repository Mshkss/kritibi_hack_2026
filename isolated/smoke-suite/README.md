# Isolated Smoke Suite

Изолированный набор для проверки backend API без изменений в основном `frontend`.

## Состав

- `ui/index.html` - минимальный графический smoke-runner
- `scripts/smoke_api.py` - CLI скрипт, который прогоняет все текущие endpoint'ы мок-данными
- `docker-compose.yml` + `nginx/` - отдельный контейнер для UI с proxy `/api` -> backend

Сценарии включают:
- network/editor endpoints (`projects`, `nodes`, `road-types`, `edges`)
- connection endpoints (`create/patch/delete`, `node connections`, `candidates`, `autogenerate`)
- негативные кейсы для `Connection layer` (`invalid topology`, `autogenerate add_missing_only=false`)

## 1) Запуск backend

Backend должен быть поднят локально на `http://127.0.0.1:8000`.

## 2) Запуск UI в отдельном контейнере

```bash
cd isolated/smoke-suite
docker compose up -d
```

Открыть в браузере:
- `http://localhost:8088`

По умолчанию `/api/*` проксируется на `http://host.docker.internal:8000/*`.

Если backend на другом адресе:

```bash
cd isolated/smoke-suite
API_UPSTREAM=http://host.docker.internal:9000 docker compose up -d
```

## 2a) Запуск через общую оркестрацию (`infra/compose.yml`)

Поднять общий стек (`db + backend + smoke-ui`):

```bash
docker compose -f infra/compose.yml up --build -d
```

Открыть UI:
- `http://localhost:8088`

Запустить CLI smoke внутри общей оркестрации:

```bash
docker compose -f infra/compose.yml --profile smoke run --rm smoke-cli
```

## 3) Запуск smoke-скрипта

```bash
cd isolated/smoke-suite
python3 scripts/smoke_api.py --base-url http://127.0.0.1:8000
```

Скрипт падает с ненулевым кодом, если любой шаг вернул неожиданный статус.
