"""Application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routers import health, projects
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

# TODO(next stage): register nodes/edges/intersections/traffic-lights/import-export routers.
