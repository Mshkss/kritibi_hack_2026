from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = ""
    is_done: bool = False


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    is_done: bool | None = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    is_done: bool

    model_config = {"from_attributes": True}
