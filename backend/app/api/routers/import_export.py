"""Import/export routes placeholder."""

from fastapi import APIRouter

router = APIRouter(prefix="/import-export")


@router.get("/ping")
def ping_import_export() -> dict[str, str]:
    return {"module": "import_export", "status": "todo"}
