"""Application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routers import edges, health, nodes, projects, road_types
from app.core.config import settings
from app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)
app.include_router(health.router, tags=["health"])
app.include_router(projects.router, tags=["projects"])
app.include_router(nodes.router, tags=["nodes"])
app.include_router(road_types.router, tags=["road-types"])
app.include_router(edges.router, tags=["edges"])

# TODO(next stage): register intersections/connections/traffic-lights/import-export routers.
