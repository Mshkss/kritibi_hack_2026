from sqlalchemy.orm import Session

from app.models import Note
from app.schemas import NoteCreate, NoteUpdate


def create_note(db: Session, payload: NoteCreate) -> Note:
    note = Note(
        title=payload.title,
        content=payload.content,
        is_done=payload.is_done,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_notes(db: Session) -> list[Note]:
    return db.query(Note).order_by(Note.id.desc()).all()


def get_note(db: Session, note_id: int) -> Note | None:
    return db.query(Note).filter(Note.id == note_id).first()


def update_note(db: Session, note: Note, payload: NoteUpdate) -> Note:
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.is_done is not None:
        note.is_done = payload.is_done

    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note: Note) -> None:
    db.delete(note)
    db.commit()
