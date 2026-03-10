"""XML import/export DTOs."""

from pydantic import BaseModel


class XmlExportResponse(BaseModel):
    project_id: str
    nod_xml: str = ""
    edg_xml: str = ""
    typ_xml: str = ""
    con_xml: str = ""
