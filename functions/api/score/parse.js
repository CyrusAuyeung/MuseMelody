const FALLBACK_NOTES = [
  { midi: 60, duration: 1, beat: 0 },
  { midi: 62, duration: 1, beat: 1 },
  { midi: 64, duration: 1, beat: 2 },
  { midi: 67, duration: 1, beat: 3 },
  { midi: 69, duration: 2, beat: 4 }
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DIATONIC_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiToPitchName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${noteName}${octave}`;
}

function normalizeAccidental(accidental) {
  const raw = String(accidental ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("sharp") || raw.includes("升") || raw === "#" || raw === "♯") return "#";
  if (raw.includes("flat") || raw.includes("降") || raw === "b" || raw === "♭") return "b";
  if (raw.includes("natural") || raw.includes("还原") || raw === "♮") return "natural";
  return null;
}

function accidentalToOffset(accidental) {
  if (accidental === "#") return 1;
  if (accidental === "b") return -1;
  return 0;
}

function pitchNameToMidi(pitchName) {
  const normalized = String(pitchName ?? "")
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/♮/g, "");
  const match = normalized.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;

  const [, rawLetter, accidental = "", rawOctave] = match;
  const letter = rawLetter.toUpperCase();
  const octave = Number(rawOctave);
  if (!Number.isFinite(octave)) return null;

  const basePitchClass = NATURAL_PITCH_CLASS[letter];
  if (!Number.isFinite(basePitchClass)) return null;
  return (octave + 1) * 12 + basePitchClass + accidentalToOffset(accidental || null);
}

function getPitchFromStaffPosition({ clef = "G", staffPosition, accidental = null }) {
  const normalizedPosition = Number(staffPosition);
  if (!Number.isFinite(normalizedPosition)) return null;

  const anchor = clef === "F"
    ? { letter: "G", octave: 2 }
    : { letter: "E", octave: 4 };
  const anchorIndex = anchor.octave * 7 + DIATONIC_NOTES.indexOf(anchor.letter);
  const targetIndex = anchorIndex + normalizedPosition;
  const noteIndex = ((targetIndex % 7) + 7) % 7;
  const octave = Math.floor(targetIndex / 7);
  const noteLetter = DIATONIC_NOTES[noteIndex];
  const normalizedAccidental = normalizeAccidental(accidental);
  const accidentalSuffix = normalizedAccidental === "natural" || normalizedAccidental === null ? "" : normalizedAccidental;
  const pitchName = `${noteLetter}${accidentalSuffix}${octave}`;
  const pitchMidi = (octave + 1) * 12 + NATURAL_PITCH_CLASS[noteLetter] + accidentalToOffset(normalizedAccidental);

  return {
    pitch_name: pitchName,
    pitch_midi: pitchMidi,
    pitch_source: "staff_position"
  };
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function fallbackResponse(filename) {
  const trebleNotes = FALLBACK_NOTES.map((note) => ({
    pitch_midi: note.midi,
    pitch_name: midiToPitchName(note.midi),
    start_beat: note.beat,
    duration_beat: note.duration,
    string: null,
    fret: null,
    staff: "treble",
    clef: "G"
  }));

  return {
    source_type: "staff",
    tempo: 120,
    time_signature: "4/4",
    staves: [
      {
        staff: "treble",
        clef: "G",
        notes: trebleNotes
      }
    ],
    notes: trebleNotes,
    detected: trebleNotes.map((note) => ({
      midi: note.pitch_midi,
      duration: note.duration_beat,
      beat: note.start_beat,
      staff: note.staff,
      clef: note.clef
    })),
    debug: {
      input_file: filename,
      parser: "fallback",
      mode: "placeholder"
    },
    message: "当前为可运行占位识别流程。若配置了 AI 识别密钥，可自动尝试真实图片识别。"
  };
}

async function parseWithOpenAI({ file, apiKey, imageUrl, arrayBuffer, scoreType = "auto" }) {
  const normalizedApiKey = apiKey?.trim();
  const apiBaseUrl = (globalThis.__MUSE_OPENAI_BASE_URL__ || "https://api.openai.com/v1").replace(/\/$/, "");
  const modelName = globalThis.__MUSE_OPENAI_MODEL__ || "gpt-4o";
  const mimeType = file.type && /^image\//.test(file.type) ? file.type : "image/png";
  const dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`;
  const finalImageUrl = dataUrl;
  const normalizedScoreType = String(scoreType || "auto").trim().toLowerCase();
  const grandStaffRequested = normalizedScoreType.includes("grand") || normalizedScoreType.includes("piano");

  const prompt = [
    "你是专业光学乐谱识别引擎。",
    "请识别这张乐谱图片，并输出严格 JSON。",
    "不要输出 markdown，不要输出解释。",
    grandStaffRequested
      ? "当前图片类型已指定为钢琴大谱表，请按 treble + bass 两个谱表识别，绝对不要忽略低音谱表。"
      : "如果图片中存在钢琴大谱表或上下两个谱表，必须同时返回 treble 和 bass 两个谱表，绝对不要忽略低音谱表。",
    "如果只检测到单行五线谱，则只返回一个 staff。",
    "比起直接猜测音名，请优先根据音符在五线谱中的准确位置来判断音高。",
    "每个音符必须尽量返回 staff_position：以该谱表最底线为 0，最底线和第二线之间的空格为 1，第二线为 2，依此类推；下加线区域用负数，上加线区域用大于 8 的整数。",
    "高音谱号 G 的最底线是 E4；低音谱号 F 的最底线是 G2。",
    "如果没有临时记号，accidental 返回 null；有升号返回 #，有降号返回 b，还原记号返回 natural。",
    "请尽量保持从左到右、按拍子递增的 start_beat；duration_beat 用四分音符为 1。",
    "返回格式：",
    "{",
    '  "tempo": number | null,',
    '  "time_signature": string | null,',
    '  "staves": [',
    '    {',
    '      "staff": "treble" | "bass",',
    '      "clef": "G" | "F",',
    '      "notes": [',
    '        { "staff_position": integer, "accidental": "#" | "b" | "natural" | null, "pitch_name": string | null, "pitch_midi": number | null, "start_beat": number, "duration_beat": number }',
    '      ]',
    '    }',
    '  ]',
    "}",
    "如果模型无法稳定分辨节奏，也要优先把高音和低音的音符位置 staff_position 识别出来，并给出尽量合理的 start_beat / duration_beat。"
  ].join("\n");

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${normalizedApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: finalImageUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errorJson = await response.clone().json();
      errorDetail = errorJson?.error?.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`OpenAI request failed: ${response.status}${errorDetail ? ` - ${errorDetail}` : ""}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || "{}");

  const normalizeStaffName = (staff, clef) => {
    const raw = String(staff ?? clef ?? "").toLowerCase();
    if (raw.includes("bass") || raw === "f" || raw.includes("低音")) return "bass";
    if (raw.includes("treble") || raw === "g" || raw.includes("高音")) return "treble";
    return "treble";
  };

  const normalizeClef = (clef, staff) => {
    const raw = String(clef ?? staff ?? "").toLowerCase();
    if (raw === "f" || raw.includes("bass") || raw.includes("低音")) return "F";
    if (raw === "g" || raw.includes("treble") || raw.includes("高音")) return "G";
    return normalizeStaffName(staff, clef) === "bass" ? "F" : "G";
  };

  const normalizeFlatNotes = (notes, fallbackStaff = "treble", fallbackClef = "G") => {
    if (!Array.isArray(notes)) return [];
    return notes
      .map((note) => {
        const staff = normalizeStaffName(note?.staff ?? fallbackStaff, note?.clef ?? fallbackClef);
        const clef = normalizeClef(note?.clef ?? fallbackClef, staff);
        const accidental = normalizeAccidental(note?.accidental);

        const derivedFromPosition = getPitchFromStaffPosition({
          clef,
          staffPosition: note?.staff_position ?? note?.position ?? note?.line_space_index,
          accidental
        });

        const rawPitchName = String(note?.pitch_name ?? "").trim();
        const pitchNameFromModel = rawPitchName || null;
        const pitchMidiFromName = pitchNameFromModel ? pitchNameToMidi(pitchNameFromModel) : null;
        const pitchMidiFromModel = Number(note?.pitch_midi);

        const chosenPitchName = derivedFromPosition?.pitch_name || pitchNameFromModel;
        const chosenPitchMidi = Number.isFinite(derivedFromPosition?.pitch_midi)
          ? derivedFromPosition.pitch_midi
          : Number.isFinite(pitchMidiFromName)
            ? pitchMidiFromName
            : Number.isFinite(pitchMidiFromModel)
              ? pitchMidiFromModel
              : null;

        if (!Number.isFinite(chosenPitchMidi)) return null;

        return {
          pitch_midi: chosenPitchMidi,
          pitch_name: chosenPitchName || midiToPitchName(chosenPitchMidi),
          start_beat: Number(note?.start_beat ?? 0),
          duration_beat: Number(note?.duration_beat ?? 1),
          string: null,
          fret: null,
          staff,
          clef,
          accidental,
          staff_position: Number.isFinite(Number(note?.staff_position ?? note?.position ?? note?.line_space_index))
            ? Number(note?.staff_position ?? note?.position ?? note?.line_space_index)
            : null,
          pitch_source: derivedFromPosition?.pitch_source || (pitchNameFromModel ? "pitch_name" : "pitch_midi")
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start_beat - b.start_beat || a.pitch_midi - b.pitch_midi);
  };

  const normalizeStaves = (rawStaves) => {
    if (!Array.isArray(rawStaves)) return [];
    return rawStaves
      .map((staffBlock) => {
        const staff = normalizeStaffName(staffBlock?.staff, staffBlock?.clef);
        const clef = normalizeClef(staffBlock?.clef, staff);
        const notes = normalizeFlatNotes(staffBlock?.notes, staff, clef);
        if (!notes.length) return null;
        return { staff, clef, notes };
      })
      .filter(Boolean);
  };

  let staves = normalizeStaves(parsed?.staves);
  let flatNotes = staves.flatMap((staffBlock) => staffBlock.notes || []);

  if (!flatNotes.length && Array.isArray(parsed?.notes)) {
    flatNotes = normalizeFlatNotes(parsed.notes, "treble", "G");
    staves = flatNotes.length
      ? [
          {
            staff: "treble",
            clef: "G",
            notes: flatNotes
          }
        ]
      : [];
  }

  if (!flatNotes.length) {
    throw new Error("No notes returned from AI parser");
  }

  const hasBass = staves.some((staffBlock) => staffBlock.staff === "bass");

  return {
    source_type: hasBass ? "grand_staff" : "staff",
    tempo: parsed.tempo ?? null,
    time_signature: parsed.time_signature ?? null,
    staves,
    notes: flatNotes,
    detected: flatNotes.map((note) => ({
      midi: Number(note.pitch_midi),
      duration: Number(note.duration_beat ?? 1),
      beat: Number(note.start_beat ?? 0),
      staff: note.staff ?? "treble",
      clef: note.clef ?? "G"
    })),
    debug: {
      input_file: file.name || "uploaded-file",
      parser: `openai-compatible:${modelName}`,
      base_url: apiBaseUrl,
      image_mode: "data-url",
      score_type: normalizedScoreType,
      pitch_strategy: "prefer-staff-position-then-pitch-name-then-pitch-midi",
      detected_staff_count: staves.length,
      has_bass_staff: hasBass
    },
    message: hasBass ? "乐谱识别完成（已包含高音与低音谱表）。" : "乐谱识别完成。"
  };
}

export async function onRequestPost(context) {
  globalThis.__MUSE_OPENAI_BASE_URL__ = context.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  globalThis.__MUSE_OPENAI_MODEL__ = context.env.OPENAI_MODEL || "gpt-4o";
  const formData = await context.request.formData();
  const file = formData.get("file");
  const scoreType = String(formData.get("score_type") || "auto");

  if (!file || typeof file === "string") {
    return Response.json({ detail: "missing file" }, { status: 400 });
  }

  const apiKey = context.env.OPENAI_API_KEY?.trim();
  const arrayBuffer = await file.arrayBuffer();
  const imageUrl = null;

  if (!apiKey) {
    const fallback = fallbackResponse(file.name || "uploaded-file");
    fallback.debug.reason = "OPENAI_API_KEY is missing";
    fallback.debug.base_url = globalThis.__MUSE_OPENAI_BASE_URL__;
    fallback.debug.model = globalThis.__MUSE_OPENAI_MODEL__;
    return Response.json(fallback);
  }

  try {
    const result = await parseWithOpenAI({ file, apiKey, imageUrl, arrayBuffer, scoreType });
    return Response.json(result);
  } catch (error) {
    const fallback = fallbackResponse(file.name || "uploaded-file");
    fallback.message = "AI 识别暂时不可用，已自动切换到占位识别流程。";
    fallback.debug = {
      ...fallback.debug,
      parser: "fallback",
      base_url: globalThis.__MUSE_OPENAI_BASE_URL__,
      model: globalThis.__MUSE_OPENAI_MODEL__,
      image_mode: "data-url",
      reason: error instanceof Error ? error.message : "unknown-error"
    };
    return Response.json(fallback);
  }
}
