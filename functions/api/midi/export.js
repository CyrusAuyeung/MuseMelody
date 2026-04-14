function encodeVariableLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }
  return bytes;
}

function createMidiBytes(notes, tempoBpm = 120) {
  const ticksPerBeat = 480;
  const tempo = Math.round(60000000 / tempoBpm);
  const events = [];

  for (const note of notes) {
    if (note.isRest || note.midi < 0) continue;
    const startTick = Math.round((note.beat || 0) * ticksPerBeat);
    const durationTick = Math.max(1, Math.round((note.duration || 1) * ticksPerBeat));
    const velocity = Math.max(1, Math.min(127, Math.round((note.velocity || 0.7) * 127)));
    events.push({ tick: startTick, type: "on", note: note.midi, velocity });
    events.push({ tick: startTick + durationTick, type: "off", note: note.midi, velocity: 0 });
  }

  events.sort((left, right) => left.tick - right.tick || (left.type === "off" ? -1 : 1));

  const trackData = [];
  trackData.push(0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff);

  let currentTick = 0;
  for (const event of events) {
    const delta = Math.max(0, event.tick - currentTick);
    trackData.push(...encodeVariableLength(delta));
    if (event.type === "on") {
      trackData.push(0x90, event.note & 0x7f, event.velocity & 0x7f);
    } else {
      trackData.push(0x80, event.note & 0x7f, 0x00);
    }
    currentTick = event.tick;
  }

  trackData.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (ticksPerBeat >> 8) & 0xff, ticksPerBeat & 0xff
  ];

  const trackLength = trackData.length;
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,
    (trackLength >> 24) & 0xff,
    (trackLength >> 16) & 0xff,
    (trackLength >> 8) & 0xff,
    trackLength & 0xff
  ];

  return new Uint8Array([...header, ...trackHeader, ...trackData]);
}

export async function onRequestPost(context) {
  const payload = await context.request.json();
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  if (!notes.length) {
    return Response.json({ detail: "notes cannot be empty" }, { status: 400 });
  }

  const filename = payload.filename || "muse_improv.mid";
  const midiBytes = createMidiBytes(notes, payload.tempo || 120);

  return new Response(midiBytes, {
    headers: {
      "content-type": "audio/midi",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}