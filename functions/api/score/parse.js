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
  const noteName = NOTE_NAMES[midi % 12];
  return `${noteName}${octave}`;
}

function fallbackResponse(filename) {
  return {
    source_type: "staff",
    tempo: 120,
    time_signature: "4/4",
    notes: FALLBACK_NOTES.map((note) => ({
      pitch_midi: note.midi,
      pitch_name: midiToPitchName(note.midi),
      start_beat: note.beat,
      duration_beat: note.duration,
      string: null,
      fret: null
    })),
    detected: FALLBACK_NOTES,
    debug: {
      input_file: filename,
      parser: "fallback",
      mode: "placeholder"
    },
    message: "当前为可运行占位识别流程。若配置了 AI 识别密钥，可自动尝试真实图片识别。"
  };
}

async function parseWithOpenAI(file, apiKey) {
  const normalizedApiKey = apiKey?.trim();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64Image = btoa(binary);

  const prompt = [
    "你是专业光学乐谱识别引擎。",
    "请识别这张五线谱图片，并输出严格 JSON。",
    "不要输出 markdown，不要输出解释。",
    "返回格式：",
    "{",
    '  "tempo": number | null,',
    '  "time_signature": string | null,',
    '  "notes": [',
    '    { "pitch_midi": number, "start_beat": number, "duration_beat": number }',
    '  ]',
    "}"
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${normalizedApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
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
                url: `data:${file.type || "image/png"};base64,${base64Image}`
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || "{}");
  const notes = Array.isArray(parsed.notes) ? parsed.notes : [];
  if (!notes.length) {
    throw new Error("No notes returned from AI parser");
  }

  return {
    source_type: "staff",
    tempo: parsed.tempo ?? null,
    time_signature: parsed.time_signature ?? null,
    notes: notes.map((note) => ({
      pitch_midi: Number(note.pitch_midi),
      pitch_name: midiToPitchName(Number(note.pitch_midi)),
      start_beat: Number(note.start_beat ?? 0),
      duration_beat: Number(note.duration_beat ?? 1),
      string: null,
      fret: null
    })),
    detected: notes.map((note) => ({
      midi: Number(note.pitch_midi),
      duration: Number(note.duration_beat ?? 1),
      beat: Number(note.start_beat ?? 0)
    })),
    debug: {
      input_file: file.name || "uploaded-file",
      parser: "openai-gpt-4o"
    },
    message: "乐谱识别完成。"
  };
}

export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ detail: "missing file" }, { status: 400 });
  }

  const apiKey = context.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    const fallback = fallbackResponse(file.name || "uploaded-file");
    fallback.debug.reason = "OPENAI_API_KEY is missing";
    return Response.json(fallback);
  }

  try {
    const result = await parseWithOpenAI(file, apiKey);
    return Response.json(result);
  } catch (error) {
    const fallback = fallbackResponse(file.name || "uploaded-file");
    fallback.message = "AI 识别暂时不可用，已自动切换到占位识别流程。";
    fallback.debug = {
      ...fallback.debug,
      parser: "fallback",
      reason: error instanceof Error ? error.message : "unknown-error"
    };
    return Response.json(fallback);
  }
}
