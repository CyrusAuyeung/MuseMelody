const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10]
};

function midiToName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12 - 1)}`;
}

function analyzeMelody(notes) {
  if (!notes.length) {
    return { key: "C", scale: "major", tempo: 120, density: 0 };
  }

  const pitchClasses = notes.filter((note) => !note.isRest && note.midi >= 0).map((note) => note.midi % 12);
  const histogram = new Array(12).fill(0);
  for (const pc of pitchClasses) histogram[pc] += 1;

  let bestKey = 0;
  let bestScale = "major";
  let bestScore = -1;

  for (const [scaleName, pattern] of Object.entries(SCALE_PATTERNS)) {
    for (let root = 0; root < 12; root += 1) {
      const score = pattern.reduce((sum, interval) => sum + histogram[(root + interval) % 12], 0);
      if (score > bestScore) {
        bestScore = score;
        bestKey = root;
        bestScale = scaleName;
      }
    }
  }

  const totalBeats = Math.max(...notes.map((note) => note.beat + note.duration), 1);
  const density = notes.length / totalBeats;
  return { key: NOTE_NAMES[bestKey], scale: bestScale, tempo: 120, density: Number(density.toFixed(3)) };
}

function getScaleNotes(root, scaleName, octave = 4) {
  const rootMidi = NOTE_NAMES.indexOf(root) + (octave + 1) * 12;
  const pattern = SCALE_PATTERNS[scaleName] || SCALE_PATTERNS.major;
  const notes = [];
  for (let octaveShift = -1; octaveShift <= 1; octaveShift += 1) {
    for (const interval of pattern) {
      notes.push(rootMidi + interval + octaveShift * 12);
    }
  }
  return notes.filter((value) => value >= 48 && value <= 84).sort((left, right) => left - right);
}

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

function noteToJson(note) {
  return {
    midi: note.midi,
    name: note.midi >= 0 ? midiToName(note.midi) : "REST",
    duration: note.duration,
    beat: note.beat,
    velocity: note.velocity,
    isRest: note.isRest
  };
}

function generateImprovisation(notes, style = "jazz", bars = 8, tempo = 120) {
  const analysis = analyzeMelody(notes);
  const scaleNotes = getScaleNotes(analysis.key, analysis.scale);
  const transitions = new Map();

  for (let index = 0; index < notes.length - 1; index += 1) {
    const from = notes[index].midi % 12;
    const to = notes[index + 1].midi % 12;
    if (!transitions.has(from)) transitions.set(from, new Map());
    transitions.get(from).set(to, (transitions.get(from).get(to) || 0) + 1);
  }

  const styleConfig = {
    jazz: { restProb: 0.1, leapProb: 0.3 },
    classical: { restProb: 0.05, leapProb: 0.15 },
    blues: { restProb: 0.14, leapProb: 0.25 },
    experimental: { restProb: 0.2, leapProb: 0.5 }
  }[style] || { restProb: 0.1, leapProb: 0.3 };

  const random = createRandom(createSeed(JSON.stringify({ notes, style, bars, tempo })));
  const totalBeats = bars * 4;
  const generated = [];
  let beat = 0;
  let currentMidi = scaleNotes[Math.floor(scaleNotes.length / 2)];

  while (beat < totalBeats) {
    if (random() < styleConfig.restProb) {
      const duration = random() < 0.5 ? 0.5 : 1;
      generated.push({ midi: -1, duration, beat, isRest: true, velocity: 0.5 });
      beat += duration;
      continue;
    }

    const pitchClass = currentMidi % 12;
    let nextMidi = currentMidi;
    const transitionMap = transitions.get(pitchClass);

    if (transitionMap && random() < 0.6) {
      const options = Array.from(transitionMap.entries());
      let total = options.reduce((sum, [, count]) => sum + count, 0);
      let pick = random() * total;
      let chosen = options[0][0];
      for (const [note, count] of options) {
        pick -= count;
        if (pick <= 0) {
          chosen = note;
          break;
        }
      }
      const octave = Math.floor(currentMidi / 12);
      nextMidi = chosen + octave * 12;
      if (Math.abs(nextMidi - currentMidi) > 12) {
        nextMidi -= 12 * Math.sign(nextMidi - currentMidi);
      }
    } else {
      const nearest = scaleNotes.reduce((best, value) => Math.abs(value - currentMidi) < Math.abs(best - currentMidi) ? value : best, scaleNotes[0]);
      const index = scaleNotes.indexOf(nearest);
      const leap = random() < styleConfig.leapProb;
      const step = leap ? Math.floor(random() * 5) - 2 : Math.floor(random() * 3) - 1;
      const nextIndex = Math.max(0, Math.min(scaleNotes.length - 1, index + step));
      nextMidi = scaleNotes[nextIndex];
    }

    const durations = [0.5, 1, 1.5];
    const duration = durations[Math.floor(random() * durations.length)];
    const velocity = 0.55 + random() * 0.35;
    generated.push({ midi: nextMidi, duration, beat, velocity, isRest: false });
    currentMidi = nextMidi;
    beat += duration;
  }

  return {
    analysis: { ...analysis, tempo },
    improvisation: generated.map(noteToJson)
  };
}

export async function onRequestPost(context) {
  const payload = await context.request.json();
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  if (!notes.length) {
    return Response.json({ detail: "notes cannot be empty" }, { status: 400 });
  }

  return Response.json(generateImprovisation(notes, payload.style, payload.bars, payload.tempo));
}
