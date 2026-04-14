from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any
import base64
import requests

from music21 import chord, converter, meter, note, tempo

from core.utils import midi_to_pitch_name

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def _image_to_musicxml(image_path: Path) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Please configure it in the environment before running staff parsing."
        )

    # 1. 读取图片并 base64
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    # 2. 调用 GPT-4o 识别五线谱 → 输出纯 MusicXML
    prompt = """
你是专业光学乐谱识别引擎（OMR）。
请识别这张五线谱图片，输出标准 MusicXML 格式。
规则：
- 只输出 MusicXML 文本，不要任何解释、说明、markdown、引号、多余文字
- 必须是完整可解析的 MusicXML
- 拍号、速度、音符要准确
- 钢琴双行谱请正确输出为 Part 1（高音）、Part 2（低音）
"""

    resp = requests.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": OPENAI_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{img_b64}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.0
        },
        timeout=60
    )

    resp.raise_for_status()
    xml = resp.json()["choices"][0]["message"]["content"].strip()
    return xml


def _run_omr_cloud(input_path: Path) -> Path:
    # 1. 调用 GPT 得到 MusicXML
    xml_content = _image_to_musicxml(input_path)

    # 2. 存为临时 xml 文件
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xml", mode="w", encoding="utf-8")
    tmp.write(xml_content)
    tmp.close()

    return Path(tmp.name)


def _extract_time_signature(score) -> str | None:
    for item in score.recurse().getElementsByClass(meter.TimeSignature):
        return item.ratioString
    return None


def _extract_tempo(score) -> float | None:
    for item in score.recurse().getElementsByClass(tempo.MetronomeMark):
        value = item.getQuarterBPM()
        if value:
            return float(value)
    return None


def _score_to_events(score) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    # 只取高音谱表主旋律
    if len(score.parts) > 0:
        score = score.parts[0]

    flat_stream = score.flatten()

    for element in flat_stream.notesAndRests:
        start_beat = float(element.offset)
        duration_beat = float(element.quarterLength)

        if duration_beat <= 0:
            continue
        if element.isRest:
            continue

        if isinstance(element, note.Note):
            midi_value = int(element.pitch.midi)
            events.append({
                "pitch_midi": midi_value,
                "pitch_name": midi_to_pitch_name(midi_value),
                "start_beat": start_beat,
                "duration_beat": duration_beat,
                "string": None,
                "fret": None,
            })
        elif isinstance(element, chord.Chord):
            for pitch_obj in element.pitches:
                midi_value = int(pitch_obj.midi)
                events.append({
                    "pitch_midi": midi_value,
                    "pitch_name": midi_to_pitch_name(midi_value),
                    "start_beat": start_beat,
                    "duration_beat": duration_beat,
                    "string": None,
                    "fret": None,
                })

    events.sort(key=lambda item: (item["start_beat"], item["pitch_midi"]))
    return events


def convert_staff_image(image_path: str | Path) -> dict[str, Any]:
    image_path = Path(image_path)
    if not image_path.exists():
        raise FileNotFoundError(f"图片不存在: {image_path}")

    # 重点：这里换成 GPT API 识别
    musicxml_path = _run_omr_cloud(image_path)
    score = converter.parse(str(musicxml_path))

    return {
        "source_type": "staff",
        "tempo": _extract_tempo(score),
        "time_signature": _extract_time_signature(score),
        "notes": _score_to_events(score),
        "debug": {
            "input_file": image_path.name,
        },
    }