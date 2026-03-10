По слоям

backend/app/api/routers/: только HTTP-слой. Принимает/возвращает DTO, вызывает сервисы, без бизнес-логики.
backend/app/api/deps.py: DI-зависимости (get_db, сервисы, auth контекст).
backend/app/services/: вся прикладная логика и use-cases (CRUD-правила, editor operations, snapshot, XML export/import).
backend/app/repositories/: доступ к БД (запросы SQLAlchemy), без бизнес-правил.
backend/app/models/: SQLAlchemy ORM-таблицы и связи.
backend/app/schemas/: Pydantic DTO (Create/Update/Read, snapshot/xml DTO).
backend/app/domain/: термины предметной области (entities/enums, инварианты как язык домена).
backend/app/core/: инфраструктурные вещи (config, logging, db helpers).
backend/app/db/: база и сессии, миграции (migrations/).
backend/app/tests/: тесты по слоям (api/, services/, repositories/).
backend/app/main.py: сборка приложения (lifespan, подключение роутеров).
Что где имплементировать

CRUD/валидации: в services/* + repositories/*.
Инварианты (edge↔node project, lane index и т.д.): в services/validation_service.py и точечно в сервисах use-case.
Editor operations: graph_service.py, edge_service.py, intersection_service.py, snapshot_service.py.
XML: xml_export_service.py, xml_import_service.py + DTO в schemas/xml.py.
Роуты только маршрутизируют вызовы сервисов и маппят DTO.
Инфра

infra/compose.yml: запуск Postgres + backend контейнера.
docs/domain_contract.md: фикс доменных сущностей и инвариантов.
docs/api_contract.md: контракты endpoint/DTO.
docs/backlog.md: этапы внедрения.