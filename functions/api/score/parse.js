const FALLBACK_NOTES = [
  { midi: 60, duration: 1, beat: 0 },
  { midi: 62, duration: 1, beat: 1 },
  { midi: 64, duration: 1, beat: 2 },
  { midi: 67, duration: 1, beat: 3 },
  { midi: 69, duration: 2, beat: 4 }
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToPitchName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${noteName}${octave}`;
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

async function parseWithOpenAI({ file, apiKey, imageUrl, arrayBuffer }) {
  const normalizedApiKey = apiKey?.trim();
  const apiBaseUrl = (globalThis.__MUSE_OPENAI_BASE_URL__ || "https://api.openai.com/v1").replace(/\/$/, "");
  const modelName = globalThis.__MUSE_OPENAI_MODEL__ || "gpt-4o";
  const mimeType = file.type && /^image\//.test(file.type) ? file.type : "image/png";
  const dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(arrayBuffer)}`;
  const finalImageUrl = dataUrl;

  const prompt = [
    "你是专业光学乐谱识别引擎。",
    "请识别这张乐谱图片，并输出严格 JSON。",
    "不要输出 markdown，不要输出解释。",
    "如果图片中存在钢琴大谱表或上下两个谱表，必须同时返回 treble 和 bass 两个谱表，绝对不要忽略低音谱表。",
    "如果只检测到单行五线谱，则只返回一个 staff。",
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
    '        { "pitch_midi": number, "start_beat": number, "duration_beat": number }',
    '      ]',
    '    }',
    '  ]',
    "}",
    "如果模型无法稳定分辨节奏，也要优先把高音和低音的音高识别出来，并给出尽量合理的 start_beat / duration_beat。"
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
        const pitchMidi = Number(note?.pitch_midi);
        if (!Number.isFinite(pitchMidi)) return null;

        const staff = normalizeStaffName(note?.staff ?? fallbackStaff, note?.clef ?? fallbackClef);
        const clef = normalizeClef(note?.clef ?? fallbackClef, staff);

        return {
          pitch_midi: pitchMidi,
          pitch_name: midiToPitchName(pitchMidi),
          start_beat: Number(note?.start_beat ?? 0),
          duration_beat: Number(note?.duration_beat ?? 1),
          string: null,
          fret: null,
          staff,
          clef
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
    const result = await parseWithOpenAI({ file, apiKey, imageUrl, arrayBuffer });
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
