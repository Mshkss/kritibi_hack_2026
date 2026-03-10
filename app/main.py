from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import Base, engine, get_db
from app.schemas import NoteCreate, NoteUpdate, NoteResponse
from app import crud

app = FastAPI(title="Notes API")

Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"message": "Notes API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/notes", response_model=NoteResponse, status_code=201)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    return crud.create_note(db, payload)


@app.get("/notes", response_model=list[NoteResponse])
def list_notes(db: Session = Depends(get_db)):
    return crud.get_notes(db)


@app.get("/notes/{note_id}", response_model=NoteResponse)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@app.patch("/notes/{note_id}", response_model=NoteResponse)
def patch_note(note_id: int, payload: NoteUpdate, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return crud.update_note(db, note, payload)


@app.delete("/notes/{note_id}", status_code=204)
def remove_note(note_id: int, db: Session = Depends(get_db)):
    note = crud.get_note(db, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    crud.delete_note(db, note)
    return None
