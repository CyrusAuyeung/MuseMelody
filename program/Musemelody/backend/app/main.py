from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.music_pipeline import (
    generate_improvisation,
    notes_from_json,
    parse_staff_image_stub,
    render_midi,
)

app = FastAPI(title="Inspiration Muse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    notes: list[dict] = Field(default_factory=list)
    style: str = "jazz"
    bars: int = 8
    tempo: int = 120


class MidiExportRequest(BaseModel):
    notes: list[dict] = Field(default_factory=list)
    tempo: int = 120
    filename: str = "improvisation.mid"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/score/parse")
async def parse_score_image(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="missing filename")
    _ = await file.read()
    return parse_staff_image_stub(file.filename)


@app.post("/api/improv/generate")
def generate(data: GenerateRequest):
    parsed_notes = notes_from_json(data.notes)
    if not parsed_notes:
        raise HTTPException(status_code=400, detail="notes cannot be empty")
    result = generate_improvisation(parsed_notes, style=data.style, bars=data.bars, tempo=data.tempo)
    return result


@app.post("/api/midi/export")
def export_midi(data: MidiExportRequest):
    parsed_notes = notes_from_json(data.notes)
    if not parsed_notes:
        raise HTTPException(status_code=400, detail="notes cannot be empty")
    midi_bytes = render_midi(parsed_notes, tempo_bpm=data.tempo)
    headers = {"Content-Disposition": f'attachment; filename="{data.filename}"'}
    return StreamingResponse(iter([midi_bytes]), media_type="audio/midi", headers=headers)
