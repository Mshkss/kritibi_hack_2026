# JSON Contract (Foundation Stage)

Документ описывает JSON API подготовительного этапа.

Base path: `/`
Content-Type: `application/json`

## Common Entity: Project

### Fields

- `id`: `string (uuid)`
- `name`: `string`, required, `1..255`
- `description`: `string | null`, optional
- `created_at`: `string (date-time)`
- `updated_at`: `string (date-time)`

### Validation errors format

```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "String should have at least 1 character",
      "type": "string_too_short"
    }
  ]
}
```

---

## 1) POST /projects

Создать пустой проект (контейнер модели).

### Request

```json
{
  "name": "Krasnoyarsk Pilot",
  "description": "Foundation project"
}
```

### Response `201 Created`

```json
{
  "id": "11a25c4e-45f9-48f5-a9af-c7199fcf9fce",
  "name": "Krasnoyarsk Pilot",
  "description": "Foundation project",
  "created_at": "2026-03-10T11:30:10.422361Z",
  "updated_at": "2026-03-10T11:30:10.422361Z"
}
```

### Errors

- `422 Unprocessable Entity` — невалидный payload (`name` пустой, неверные типы).

---

## 2) GET /projects

Получить список проектов.

### Query params

- `limit` (optional, default `100`, `1..200`)
- `offset` (optional, default `0`, `>=0`)

### Request example

`GET /projects?limit=20&offset=0`

### Response `200 OK`

```json
[
  {
    "id": "11a25c4e-45f9-48f5-a9af-c7199fcf9fce",
    "name": "Krasnoyarsk Pilot",
    "description": "Foundation project",
    "created_at": "2026-03-10T11:30:10.422361Z",
    "updated_at": "2026-03-10T11:30:10.422361Z"
  }
]
```

### Errors

- `422 Unprocessable Entity` — невалидные `limit/offset`.

---

## 3) GET /projects/{id}

Получить один проект по `id`.

### Request example

`GET /projects/11a25c4e-45f9-48f5-a9af-c7199fcf9fce`

### Response `200 OK`

```json
{
  "id": "11a25c4e-45f9-48f5-a9af-c7199fcf9fce",
  "name": "Krasnoyarsk Pilot",
  "description": "Foundation project",
  "created_at": "2026-03-10T11:30:10.422361Z",
  "updated_at": "2026-03-10T11:30:10.422361Z"
}
```

### Errors

- `404 Not Found` — проект не найден.
- `422 Unprocessable Entity` — `id` не является корректным UUID.

---

## 4) PATCH /projects/{id}

Частичное обновление метаданных проекта.

### Request example

```json
{
  "name": "Krasnoyarsk Pilot v2",
  "description": null
}
```

### Response `200 OK`

```json
{
  "id": "11a25c4e-45f9-48f5-a9af-c7199fcf9fce",
  "name": "Krasnoyarsk Pilot v2",
  "description": null,
  "created_at": "2026-03-10T11:30:10.422361Z",
  "updated_at": "2026-03-10T11:32:01.889420Z"
}
```

### Errors

- `404 Not Found` — проект не найден.
- `422 Unprocessable Entity` — пустой body или невалидные поля.

Пример ошибки пустого PATCH:

```json
{
  "detail": "PATCH payload must include at least one field"
}
```

---

## 5) DELETE /projects/{id}

Удалить проект.

### Request example

`DELETE /projects/11a25c4e-45f9-48f5-a9af-c7199fcf9fce`

### Response `204 No Content`

Тело ответа отсутствует.

### Errors

- `404 Not Found` — проект не найден.
- `422 Unprocessable Entity` — `id` не является корректным UUID.
