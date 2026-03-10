"""Repository for Edge and Lane persistence."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.edge import EdgeModel
from app.models.lane import LaneModel


class EdgeRepository:
    """Persistence operations for edges and nested lanes."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, edge_id: str) -> EdgeModel | None:
        stmt = select(EdgeModel).options(selectinload(EdgeModel.lanes)).where(EdgeModel.id == edge_id)
        return self.session.scalar(stmt)

    def get_in_project(self, project_id: str, edge_id: str) -> EdgeModel | None:
        stmt = (
            select(EdgeModel)
            .options(selectinload(EdgeModel.lanes))
            .where(EdgeModel.project_id == project_id, EdgeModel.id == edge_id)
        )
        return self.session.scalar(stmt)

    def list_by_project(self, project_id: str) -> list[EdgeModel]:
        stmt = (
            select(EdgeModel)
            .options(selectinload(EdgeModel.lanes))
            .where(EdgeModel.project_id == project_id)
            .order_by(EdgeModel.created_at.asc())
        )
        return list(self.session.scalars(stmt).all())

    def list_connected_to_node(self, project_id: str, node_id: str) -> list[EdgeModel]:
        stmt = (
            select(EdgeModel)
            .options(selectinload(EdgeModel.lanes))
            .where(
                EdgeModel.project_id == project_id,
                or_(EdgeModel.from_node_id == node_id, EdgeModel.to_node_id == node_id),
            )
        )
        return list(self.session.scalars(stmt).all())

    def list_incoming_for_node(self, project_id: str, node_id: str) -> list[EdgeModel]:
        stmt = (
            select(EdgeModel)
            .options(selectinload(EdgeModel.lanes))
            .where(EdgeModel.project_id == project_id, EdgeModel.to_node_id == node_id)
            .order_by(EdgeModel.code.asc())
        )
        return list(self.session.scalars(stmt).all())

    def list_outgoing_for_node(self, project_id: str, node_id: str) -> list[EdgeModel]:
        stmt = (
            select(EdgeModel)
            .options(selectinload(EdgeModel.lanes))
            .where(EdgeModel.project_id == project_id, EdgeModel.from_node_id == node_id)
            .order_by(EdgeModel.code.asc())
        )
        return list(self.session.scalars(stmt).all())

    def exists_for_node(self, project_id: str, node_id: str) -> bool:
        stmt = select(EdgeModel.id).where(
            EdgeModel.project_id == project_id,
            or_(EdgeModel.from_node_id == node_id, EdgeModel.to_node_id == node_id),
        )
        return self.session.scalar(stmt) is not None

    def create(
        self,
        *,
        project_id: str,
        code: str,
        from_node_id: str,
        to_node_id: str,
        road_type_id: str | None,
        name: str | None,
        speed: float | None,
        priority: int | None,
        length: float | None,
        width: float | None,
        sidewalk_width: float | None,
        shape: list[dict[str, float]],
        lanes: list[dict[str, object]],
        commit: bool = True,
    ) -> EdgeModel:
        edge = EdgeModel(
            project_id=project_id,
            code=code,
            from_node_id=from_node_id,
            to_node_id=to_node_id,
            road_type_id=road_type_id,
            name=name,
            speed=speed,
            priority=priority,
            length=length,
            width=width,
            sidewalk_width=sidewalk_width,
            shape=shape,
        )
        self.session.add(edge)
        self.session.flush()

        lane_models = [
            LaneModel(
                edge_id=edge.id,
                index=int(lane["index"]),
                allow=lane.get("allow"),
                disallow=lane.get("disallow"),
                speed=lane.get("speed"),
                width=lane.get("width"),
            )
            for lane in lanes
        ]
        self.session.add_all(lane_models)
        self.session.flush()

        if commit:
            self.session.commit()
            return self.get(edge.id)  # type: ignore[return-value]

        return edge

    def update(self, edge: EdgeModel, *, commit: bool = True, **kwargs: object) -> EdgeModel:
        for field, value in kwargs.items():
            setattr(edge, field, value)
        self.session.add(edge)
        self.session.flush()
        if commit:
            self.session.commit()
            return self.get(edge.id)  # type: ignore[return-value]
        return edge

    def replace_lanes(self, edge: EdgeModel, lanes: list[dict[str, object]], *, commit: bool = True) -> EdgeModel:
        for lane_model in list(edge.lanes):
            self.session.delete(lane_model)
        self.session.flush()

        new_lanes: list[LaneModel] = []
        for lane in lanes:
            lane_model = LaneModel(
                edge_id=edge.id,
                index=int(lane["index"]),
                allow=lane.get("allow"),
                disallow=lane.get("disallow"),
                speed=lane.get("speed"),
                width=lane.get("width"),
            )
            self.session.add(lane_model)
            new_lanes.append(lane_model)
        self.session.flush()
        edge.lanes = new_lanes

        if commit:
            self.session.commit()
            self.session.refresh(edge)
        return edge

    def delete(self, edge: EdgeModel, *, commit: bool = True) -> None:
        self.session.delete(edge)
        self.session.flush()
        if commit:
            self.session.commit()

    def get_lane_in_edge(self, edge_id: str, lane_id: str) -> LaneModel | None:
        stmt = select(LaneModel).where(LaneModel.edge_id == edge_id, LaneModel.id == lane_id)
        return self.session.scalar(stmt)

    def update_lane(self, lane: LaneModel, *, commit: bool = True, **kwargs: object) -> LaneModel:
        for field, value in kwargs.items():
            setattr(lane, field, value)
        self.session.add(lane)
        self.session.flush()
        if commit:
            self.session.commit()
            self.session.refresh(lane)
        return lane

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
