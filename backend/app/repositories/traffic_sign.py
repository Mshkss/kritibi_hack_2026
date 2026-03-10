"""Repository for TrafficSign persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.traffic_sign import TrafficSignModel


class TrafficSignRepository:
    """Persistence operations for generated/manual traffic signs."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, sign_id: str) -> TrafficSignModel | None:
        stmt = (
            select(TrafficSignModel)
            .options(
                selectinload(TrafficSignModel.approach),
                selectinload(TrafficSignModel.edge),
                selectinload(TrafficSignModel.node),
            )
            .where(TrafficSignModel.id == sign_id)
        )
        return self.session.scalar(stmt)

    def list_by_intersection(
        self,
        project_id: str,
        intersection_id: str,
        *,
        generated: bool | None = None,
    ) -> list[TrafficSignModel]:
        stmt = (
            select(TrafficSignModel)
            .options(
                selectinload(TrafficSignModel.approach),
                selectinload(TrafficSignModel.edge),
                selectinload(TrafficSignModel.node),
            )
            .where(
                TrafficSignModel.project_id == project_id,
                TrafficSignModel.intersection_id == intersection_id,
            )
            .order_by(TrafficSignModel.created_at.asc())
        )
        if generated is not None:
            stmt = stmt.where(TrafficSignModel.generated == generated)
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        intersection_id: str | None,
        approach_id: str | None,
        node_id: str | None,
        edge_id: str | None,
        sign_type: str,
        generated: bool,
        payload: dict[str, object] | None = None,
        commit: bool = True,
    ) -> TrafficSignModel:
        sign = TrafficSignModel(
            project_id=project_id,
            intersection_id=intersection_id,
            approach_id=approach_id,
            node_id=node_id,
            edge_id=edge_id,
            sign_type=sign_type,
            generated=generated,
            payload=payload,
        )
        self.session.add(sign)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(sign.id)  # type: ignore[return-value]
        return sign

    def bulk_create(self, items: list[dict[str, object]], *, commit: bool = True) -> list[TrafficSignModel]:
        created: list[TrafficSignModel] = []
        for item in items:
            created.append(
                self.create(
                    project_id=str(item["project_id"]),
                    intersection_id=str(item["intersection_id"]) if item.get("intersection_id") is not None else None,
                    approach_id=str(item["approach_id"]) if item.get("approach_id") is not None else None,
                    node_id=str(item["node_id"]) if item.get("node_id") is not None else None,
                    edge_id=str(item["edge_id"]) if item.get("edge_id") is not None else None,
                    sign_type=str(item["sign_type"]),
                    generated=bool(item.get("generated", False)),
                    payload=dict(item["payload"]) if item.get("payload") is not None else None,
                    commit=False,
                )
            )

        if commit:
            self.session.commit()
            ids = [item.id for item in created]
            if not ids:
                return []
            stmt = (
                select(TrafficSignModel)
                .options(
                    selectinload(TrafficSignModel.approach),
                    selectinload(TrafficSignModel.edge),
                    selectinload(TrafficSignModel.node),
                )
                .where(TrafficSignModel.id.in_(ids))
                .order_by(TrafficSignModel.created_at.asc())
            )
            return list(self.session.scalars(stmt).all())
        return created

    def update(self, sign: TrafficSignModel, *, commit: bool = True, **kwargs: object) -> TrafficSignModel:
        for field, value in kwargs.items():
            setattr(sign, field, value)
        self.session.add(sign)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(sign.id)  # type: ignore[return-value]
        return sign

    def delete_many(self, sign_ids: list[str], *, commit: bool = True) -> int:
        if not sign_ids:
            return 0
        stmt = select(TrafficSignModel).where(TrafficSignModel.id.in_(sign_ids))
        entities = list(self.session.scalars(stmt).all())
        for entity in entities:
            self.session.delete(entity)
        self.session.flush()
        if commit:
            self.session.commit()
        return len(entities)

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
