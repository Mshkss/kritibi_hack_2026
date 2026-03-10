"""Repository for Node persistence."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.node import NodeModel


class NodeRepository:
    """Persistence operations for nodes."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, node_id: str) -> NodeModel | None:
        return self.session.get(NodeModel, node_id)

    def get_in_project(self, project_id: str, node_id: str) -> NodeModel | None:
        stmt = select(NodeModel).where(NodeModel.project_id == project_id, NodeModel.id == node_id)
        return self.session.scalar(stmt)

    def list_by_project(self, project_id: str) -> list[NodeModel]:
        stmt = select(NodeModel).where(NodeModel.project_id == project_id).order_by(NodeModel.created_at.asc())
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        *,
        project_id: str,
        code: str,
        x: float,
        y: float,
        node_type: str | None,
        commit: bool = True,
    ) -> NodeModel:
        node = NodeModel(
            project_id=project_id,
            code=code,
            x=x,
            y=y,
            type=node_type,
        )
        self.session.add(node)
        self.session.flush()
        if commit:
            self.session.commit()
            self.session.refresh(node)
        return node

    def update(self, node: NodeModel, *, commit: bool = True, **kwargs: object) -> NodeModel:
        for field, value in kwargs.items():
            setattr(node, field, value)
        self.session.add(node)
        self.session.flush()
        if commit:
            self.session.commit()
            self.session.refresh(node)
        return node

    def delete(self, node: NodeModel, *, commit: bool = True) -> None:
        self.session.delete(node)
        self.session.flush()
        if commit:
            self.session.commit()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
