"""Application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routers import (
    edges,
    health,
    import_export,
    intersections,
    nodes,
    projects,
    traffic_lights,
)
from app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    yield


app = FastAPI(title="Road Network API", lifespan=lifespan)
app.include_router(health.router, tags=["health"])
app.include_router(projects.router, tags=["projects"])
app.include_router(nodes.router, tags=["nodes"])
app.include_router(edges.router, tags=["edges"])
app.include_router(intersections.router, tags=["intersections"])
app.include_router(traffic_lights.router, tags=["traffic-lights"])
app.include_router(import_export.router, tags=["import-export"])
