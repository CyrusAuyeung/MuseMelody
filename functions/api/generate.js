const STYLE_LIBRARY = {
  "neo-soul": {
    chords: ["Cmaj9", "A7sus4", "Dm9", "G13", "Em7", "A13"],
    notes: ["C4", "D4", "E4", "G4", "A4", "B4", "D5"],
    contours: ["lift", "float", "turn", "resolve"]
  },
  "city-pop": {
    chords: ["Fmaj7", "G6", "Em7", "A7", "Dm7", "Cmaj7"],
    notes: ["A3", "C4", "D4", "E4", "G4", "A4", "C5"],
    contours: ["glide", "bounce", "rise", "flash"]
  },
  "jazz-waltz": {
    chords: ["Dm9", "G13", "Cmaj9", "A7alt", "Fmaj7", "E7#9"],
    notes: ["D4", "F4", "A4", "C5", "E5", "G5"],
    contours: ["arc", "spiral", "lean", "drop"]
  },
  "film-score": {
    chords: ["Am(add9)", "Fmaj7", "C/E", "Gsus2", "Dm11", "E7"],
    notes: ["A3", "C4", "E4", "G4", "B4", "C5", "E5"],
    contours: ["swell", "hover", "expand", "fade"]
  }
};

const STYLE_LABELS = {
  "neo-soul": "Neo Soul",
  "city-pop": "City Pop",
  "jazz-waltz": "Jazz Waltz",
  "film-score": "Film Score"
};

function createSeed(input) {
  return Array.from(input).reduce((total, char) => total + char.charCodeAt(0), 0) || 1;
}

function createRandom(seedStart) {
  let seed = seedStart;

  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function buildResponse(payload) {
  const style = STYLE_LIBRARY[payload.style] || STYLE_LIBRARY["neo-soul"];
  const styleLabel = STYLE_LABELS[payload.style] || "Neo Soul";
  const bars = Math.min(Math.max(Number(payload.bars) || 8, 4), 16);
  const random = createRandom(
    createSeed(`${payload.prompt}|${payload.inputType}|${payload.style}|${payload.temperature}|${payload.density}|${payload.fileName || "none"}`)
  );

  const phrases = Array.from({ length: bars }, (_, index) => {
    const notes = Array.from({ length: 3 + Math.floor(random() * 3) }, () => {
      return {
        pitch: style.notes[Math.floor(random() * style.notes.length)],
        duration: [0.25, 0.5, 0.75, 1][Math.floor(random() * 4)]
      };
    });

    return {
      bar: index + 1,
      contour: style.contours[Math.floor(random() * style.contours.length)],
      notes,
      motif: notes.map((note) => `${note.pitch}/${note.duration}`).join(" · ")
    };
  });

  return {
    requestId: `mm-${Date.now().toString(36)}`,
    title: `${styleLabel} 风格旋律草稿`,
    overview: `已根据 ${payload.inputType || "text"} 输入生成 ${bars} 小节 ${styleLabel} 风格片段。你可以直接查看和声建议、旋律轮廓与试听结果，并继续调整生成方向。`,
    bpm: 88 + Math.round(random() * 36),
    harmony: Array.from({ length: Math.max(4, Math.ceil(bars / 2)) }, (_, index) => {
      return style.chords[(index + Math.floor(random() * 2)) % style.chords.length];
    }),
    phrases,
    waveform: Array.from({ length: 20 }, () => 0.15 + random() * 0.82),
    nextSteps: [
      "导出当前旋律片段。",
      "继续生成下一段发展。",
      "切换风格重新比较结果。"
    ]
  };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export async function onRequestGet() {
  return json({
    service: "MuseMelody demo API",
    status: "ok",
    message: "Use POST /api/generate to request a mock generation result."
  });
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    if (!payload || typeof payload.prompt !== "string") {
      return json({ error: "Invalid payload" }, { status: 400 });
    }

    return json(buildResponse(payload));
  } catch (error) {
    return json(
      {
        error: "Failed to generate demo response",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}