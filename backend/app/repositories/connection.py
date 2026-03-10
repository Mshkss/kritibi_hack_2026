"""Repository for Connection persistence."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.connection import ConnectionModel


class ConnectionRepository:
    """Persistence operations for lane-level node connections."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, connection_id: str) -> ConnectionModel | None:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(ConnectionModel.id == connection_id)
        )
        return self.session.scalar(stmt)

    def get_in_project(self, project_id: str, connection_id: str) -> ConnectionModel | None:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(ConnectionModel.project_id == project_id, ConnectionModel.id == connection_id)
        )
        return self.session.scalar(stmt)

    def list_by_project(self, project_id: str) -> list[ConnectionModel]:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(ConnectionModel.project_id == project_id)
            .order_by(ConnectionModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def list_by_node(self, project_id: str, node_id: str) -> list[ConnectionModel]:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(ConnectionModel.project_id == project_id, ConnectionModel.via_node_id == node_id)
            .order_by(
                ConnectionModel.from_edge_id.asc(),
                ConnectionModel.to_edge_id.asc(),
                ConnectionModel.from_lane_index.asc(),
                ConnectionModel.to_lane_index.asc(),
            )
        )
        return list(self.session.scalars(stmt).all())

    def list_for_pair(
        self,
        project_id: str,
        *,
        from_edge_id: str,
        to_edge_id: str,
        via_node_id: str | None = None,
    ) -> list[ConnectionModel]:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(
                ConnectionModel.project_id == project_id,
                ConnectionModel.from_edge_id == from_edge_id,
                ConnectionModel.to_edge_id == to_edge_id,
            )
            .order_by(ConnectionModel.from_lane_index.asc(), ConnectionModel.to_lane_index.asc())
        )
        if via_node_id is not None:
            stmt = stmt.where(ConnectionModel.via_node_id == via_node_id)
        return list(self.session.scalars(stmt).all())

    def list_for_edge(self, project_id: str, edge_id: str) -> list[ConnectionModel]:
        stmt = (
            select(ConnectionModel)
            .options(
                selectinload(ConnectionModel.via_node),
                selectinload(ConnectionModel.from_edge),
                selectinload(ConnectionModel.to_edge),
            )
            .where(
                ConnectionModel.project_id == project_id,
                or_(ConnectionModel.from_edge_id == edge_id, ConnectionModel.to_edge_id == edge_id),
            )
            .order_by(ConnectionModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def exists_duplicate(
        self,
        *,
        project_id: str,
        from_edge_id: str,
        to_edge_id: str,
        from_lane_index: int,
        to_lane_index: int,
    ) -> bool:
        stmt = select(ConnectionModel.id).where(
            ConnectionModel.project_id == project_id,
            ConnectionModel.from_edge_id == from_edge_id,
            ConnectionModel.to_edge_id == to_edge_id,
            ConnectionModel.from_lane_index == from_lane_index,
            ConnectionModel.to_lane_index == to_lane_index,
        )
        return self.session.scalar(stmt) is not None

    def create(
        self,
        *,
        project_id: str,
        via_node_id: str,
        from_edge_id: str,
        to_edge_id: str,
        from_lane_index: int,
        to_lane_index: int,
        uncontrolled: bool = False,
        commit: bool = True,
    ) -> ConnectionModel:
        connection = ConnectionModel(
            project_id=project_id,
            via_node_id=via_node_id,
            from_edge_id=from_edge_id,
            to_edge_id=to_edge_id,
            from_lane_index=from_lane_index,
            to_lane_index=to_lane_index,
            uncontrolled=uncontrolled,
        )
        self.session.add(connection)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(connection.id)  # type: ignore[return-value]
        return connection

    def bulk_create(self, items: list[dict[str, object]], *, commit: bool = True) -> list[ConnectionModel]:
        created: list[ConnectionModel] = []
        for item in items:
            created.append(
                self.create(
                    project_id=str(item["project_id"]),
                    via_node_id=str(item["via_node_id"]),
                    from_edge_id=str(item["from_edge_id"]),
                    to_edge_id=str(item["to_edge_id"]),
                    from_lane_index=int(item["from_lane_index"]),
                    to_lane_index=int(item["to_lane_index"]),
                    uncontrolled=bool(item.get("uncontrolled", False)),
                    commit=False,
                )
            )
        if commit:
            self.session.commit()
            created_ids = [item.id for item in created]
            if not created_ids:
                return []
            stmt = (
                select(ConnectionModel)
                .options(
                    selectinload(ConnectionModel.via_node),
                    selectinload(ConnectionModel.from_edge),
                    selectinload(ConnectionModel.to_edge),
                )
                .where(ConnectionModel.id.in_(created_ids))
                .order_by(ConnectionModel.created_at.asc())
            )
            return list(self.session.scalars(stmt).all())
        return created

    def update(self, connection: ConnectionModel, *, commit: bool = True, **kwargs: object) -> ConnectionModel:
        for field, value in kwargs.items():
            setattr(connection, field, value)
        self.session.add(connection)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(connection.id)  # type: ignore[return-value]
        return connection

    def delete(self, connection: ConnectionModel, *, commit: bool = True) -> None:
        self.session.delete(connection)
        self.session.flush()
        if commit:
            self.session.commit()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
