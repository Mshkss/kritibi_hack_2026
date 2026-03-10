# Isolated Smoke Suite

Изолированный набор для проверки backend API без изменений в основном `frontend`.

## Состав

- `ui/index.html` - минимальный графический smoke-runner
- `scripts/smoke_api.py` - CLI скрипт, который прогоняет все текущие endpoint'ы мок-данными
- `docker-compose.yml` + `nginx/` - отдельный контейнер для UI с proxy `/api` -> backend

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

## 3) Запуск smoke-скрипта

```bash
cd isolated/smoke-suite
python3 scripts/smoke_api.py --base-url http://127.0.0.1:8000
```

Скрипт падает с ненулевым кодом, если любой шаг вернул неожиданный статус.
