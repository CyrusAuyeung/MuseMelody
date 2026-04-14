from __future__ import annotations

import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List

import mido

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
SCALE_PATTERNS = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "pentatonic": [0, 2, 4, 7, 9],
    "blues": [0, 3, 5, 6, 7, 10],
}


@dataclass
class NoteEvent:
    midi: int
    duration: float
    beat: float
    velocity: float = 0.7
    is_rest: bool = False


def midi_to_name(midi: int) -> str:
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def analyze_melody(notes: List[NoteEvent]) -> Dict:
    if not notes:
        return {"key": "C", "scale": "major", "tempo": 120, "density": 0}

    pcs = [n.midi % 12 for n in notes if not n.is_rest]
    hist = Counter(pcs)
    best_key, best_scale, best_score = 0, "major", -1

    for scale_name, pattern in SCALE_PATTERNS.items():
        for root in range(12):
            score = sum(hist[(root + interval) % 12] for interval in pattern)
            if score > best_score:
                best_score = score
                best_key = root
                best_scale = scale_name

    total_beats = max((n.beat + n.duration for n in notes), default=1)
    density = len(notes) / total_beats
    return {"key": NOTE_NAMES[best_key], "scale": best_scale, "tempo": 120, "density": round(density, 3)}


def _scale_notes(root: str, scale_name: str, octave: int = 4) -> List[int]:
    root_idx = NOTE_NAMES.index(root)
    root_midi = root_idx + (octave + 1) * 12
    pattern = SCALE_PATTERNS.get(scale_name, SCALE_PATTERNS["major"])
    vals = []
    for oct_shift in [-1, 0, 1]:
        for interval in pattern:
            vals.append(root_midi + interval + 12 * oct_shift)
    return sorted([v for v in vals if 48 <= v <= 84])


def generate_improvisation(notes: List[NoteEvent], style: str = "jazz", bars: int = 8, tempo: int = 120) -> Dict:
    analysis = analyze_melody(notes)
    scale_notes = _scale_notes(analysis["key"], analysis["scale"])

    transitions: Dict[int, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for i in range(len(notes) - 1):
        frm = notes[i].midi % 12
        to = notes[i + 1].midi % 12
        transitions[frm][to] += 1

    style_cfg = {
        "jazz": {"rest_prob": 0.1, "leap_prob": 0.3},
        "classical": {"rest_prob": 0.05, "leap_prob": 0.15},
        "blues": {"rest_prob": 0.14, "leap_prob": 0.25},
        "experimental": {"rest_prob": 0.2, "leap_prob": 0.5},
    }.get(style, {"rest_prob": 0.1, "leap_prob": 0.3})

    total_beats = bars * 4
    beat = 0.0
    current_midi = scale_notes[len(scale_notes) // 2]
    generated: List[NoteEvent] = []

    while beat < total_beats:
        if random.random() < style_cfg["rest_prob"]:
            dur = random.choice([0.5, 1.0])
            generated.append(NoteEvent(midi=-1, duration=dur, beat=beat, is_rest=True))
            beat += dur
            continue

        pc = current_midi % 12
        if transitions.get(pc) and random.random() < 0.6:
            opts = list(transitions[pc].items())
            total = sum(c for _, c in opts)
            r = random.random() * total
            chosen = opts[0][0]
            for note, count in opts:
                r -= count
                if r <= 0:
                    chosen = note
                    break
            octave = current_midi // 12
            next_midi = chosen + octave * 12
        else:
            nearest = min(scale_notes, key=lambda x: abs(x - current_midi))
            idx = scale_notes.index(nearest)
            jump = random.randint(-2, 2) if random.random() < style_cfg["leap_prob"] else random.randint(-1, 1)
            next_midi = scale_notes[max(0, min(len(scale_notes) - 1, idx + jump))]

        duration = random.choice([0.5, 1.0, 1.5])
        velocity = 0.55 + random.random() * 0.35
        generated.append(NoteEvent(midi=next_midi, duration=duration, beat=beat, velocity=velocity))
        current_midi = next_midi
        beat += duration

    return {
        "analysis": analysis | {"tempo": tempo},
        "improvisation": [note_to_json(n) for n in generated],
    }


def note_to_json(note: NoteEvent) -> Dict:
    return {
        "midi": note.midi,
        "name": midi_to_name(note.midi) if note.midi >= 0 else "REST",
        "duration": note.duration,
        "beat": note.beat,
        "velocity": note.velocity,
        "isRest": note.is_rest,
    }


def notes_from_json(notes: List[Dict]) -> List[NoteEvent]:
    return [
        NoteEvent(
            midi=n.get("midi", 60),
            duration=float(n.get("duration", 1)),
            beat=float(n.get("beat", i)),
            velocity=float(n.get("velocity", 0.7)),
            is_rest=bool(n.get("isRest", False)),
        )
        for i, n in enumerate(notes)
    ]


def render_midi(notes: List[NoteEvent], tempo_bpm: int = 120) -> bytes:
    mid = mido.MidiFile()
    track = mido.MidiTrack()
    mid.tracks.append(track)
    tempo = mido.bpm2tempo(tempo_bpm)
    track.append(mido.MetaMessage("set_tempo", tempo=tempo, time=0))

    ticks_per_beat = mid.ticks_per_beat
    current_tick = 0

    for note in notes:
        start_tick = int(note.beat * ticks_per_beat)
        dur_tick = int(note.duration * ticks_per_beat)
        if note.is_rest or note.midi < 0:
            continue
        delta = max(0, start_tick - current_tick)
        velocity = max(1, min(127, int(note.velocity * 127)))
        track.append(mido.Message("note_on", note=note.midi, velocity=velocity, time=delta))
        track.append(mido.Message("note_off", note=note.midi, velocity=0, time=max(1, dur_tick)))
        current_tick = start_tick + dur_tick

    buf = BytesIO()
    mid.save(file=buf)
    return buf.getvalue()


def parse_staff_image_stub(filename: str) -> Dict:
    """
    Placeholder for OMR model integration.
    Next step: replace with CNN/CRNN pipeline output.
    """
    example = [
        {"midi": 60, "duration": 1, "beat": 0},
        {"midi": 62, "duration": 1, "beat": 1},
        {"midi": 64, "duration": 1, "beat": 2},
        {"midi": 67, "duration": 1, "beat": 3},
        {"midi": 69, "duration": 2, "beat": 4},
    ]
    return {
        "filename": filename,
        "detected": example,
        "message": "当前为可运行占位 OMR 流程，请在此接入 CNN/Transformer 乐谱识别模型。",
    }
