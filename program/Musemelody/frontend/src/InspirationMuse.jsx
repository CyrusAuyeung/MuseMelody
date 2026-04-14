import { useState, useRef, useCallback, useEffect } from "react";

/* ─────────────────────────────────────────────
   靈感繆斯 — AI Music Improvisation Generator
   ───────────────────────────────────────────── */

// ══════════════════════════════════════════════
//  MUSIC THEORY UTILITIES
// ══════════════════════════════════════════════

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALE_PATTERNS = {
  major:          [0,2,4,5,7,9,11],
  minor:          [0,2,3,5,7,8,10],
  dorian:         [0,2,3,5,7,9,10],
  mixolydian:     [0,2,4,5,7,9,10],
  pentatonic:     [0,2,4,7,9],
  blues:          [0,3,5,6,7,10],
  harmonicMinor:  [0,2,3,5,7,8,11],
  melodicMinor:   [0,2,3,5,7,9,11],
  wholeTone:      [0,2,4,6,8,10],
  diminished:     [0,2,3,5,6,8,9,11],
};

const CHORD_TYPES = {
  maj:  [0,4,7],
  min:  [0,3,7],
  dom7: [0,4,7,10],
  min7: [0,3,7,10],
  maj7: [0,4,7,11],
  dim:  [0,3,6],
  aug:  [0,4,8],
  sus4: [0,5,7],
};

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function midiToName(midi) { return NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1); }
function nameToMidi(name) {
  const m = name.match(/^([A-G]#?)(\d)$/);
  if (!m) return 60;
  return NOTE_NAMES.indexOf(m[1]) + (parseInt(m[2]) + 1) * 12;
}

function getScaleNotes(root, scaleName, octave = 4) {
  const rootMidi = NOTE_NAMES.indexOf(root) + (octave + 1) * 12;
  const pattern = SCALE_PATTERNS[scaleName] || SCALE_PATTERNS.major;
  const notes = [];
  for (let o = -1; o <= 1; o++) {
    pattern.forEach(interval => notes.push(rootMidi + interval + o * 12));
  }
  return notes.filter(n => n >= 48 && n <= 84).sort((a,b) => a - b);
}

// ══════════════════════════════════════════════
//  MELODY ANALYSIS
// ══════════════════════════════════════════════

function analyzeMelody(notes) {
  if (!notes.length) return { key: "C", scale: "major", tempo: 120, intervals: [], contour: [] };
  const pitchClasses = notes.map(n => n.midi % 12);
  const hist = new Array(12).fill(0);
  pitchClasses.forEach(pc => hist[pc]++);

  let bestKey = 0, bestScale = "major", bestScore = 0;
  for (const [scaleName, pattern] of Object.entries(SCALE_PATTERNS)) {
    for (let root = 0; root < 12; root++) {
      const score = pattern.reduce((s, i) => s + hist[(root + i) % 12], 0);
      if (score > bestScore) { bestScore = score; bestKey = root; bestScale = scaleName; }
    }
  }

  const intervals = [];
  for (let i = 1; i < notes.length; i++) intervals.push(notes[i].midi - notes[i-1].midi);
  const contour = intervals.map(i => i > 0 ? "up" : i < 0 ? "down" : "same");

  return { key: NOTE_NAMES[bestKey], scale: bestScale, tempo: 120, intervals, contour };
}

// ══════════════════════════════════════════════
//  IMPROVISATION GENERATOR (Neural-style Markov + Rules)
// ══════════════════════════════════════════════

function generateImprovisation(analysis, originalNotes, style = "jazz", bars = 8) {
  const { key, scale } = analysis;
  const scaleNotes = getScaleNotes(key, scale);
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const result = [];

  // Build transition matrix from original melody
  const transMatrix = {};
  for (let i = 0; i < originalNotes.length - 1; i++) {
    const from = originalNotes[i].midi % 12;
    const to = originalNotes[i + 1].midi % 12;
    if (!transMatrix[from]) transMatrix[from] = {};
    transMatrix[from][to] = (transMatrix[from][to] || 0) + 1;
  }

  // Style parameters
  const styles = {
    jazz: { restProb: 0.1, leapProb: 0.3, syncoProb: 0.4, ornamentProb: 0.2, swingFactor: 0.15 },
    classical: { restProb: 0.05, leapProb: 0.15, syncoProb: 0.1, ornamentProb: 0.1, swingFactor: 0 },
    blues: { restProb: 0.15, leapProb: 0.2, syncoProb: 0.3, ornamentProb: 0.35, swingFactor: 0.2 },
    experimental: { restProb: 0.2, leapProb: 0.5, syncoProb: 0.5, ornamentProb: 0.15, swingFactor: 0.1 },
  };
  const sp = styles[style] || styles.jazz;

  let currentMidi = scaleNotes[Math.floor(scaleNotes.length / 2)];
  let beat = 0;

  while (beat < totalBeats) {
    // Rest?
    if (Math.random() < sp.restProb) {
      const dur = [0.5, 1][Math.floor(Math.random() * 2)];
      result.push({ midi: -1, duration: dur, beat, isRest: true });
      beat += dur;
      continue;
    }

    // Choose next note
    const pc = currentMidi % 12;
    let nextMidi;
    if (transMatrix[pc] && Math.random() < 0.6) {
      // Use transition matrix
      const choices = Object.entries(transMatrix[pc]);
      const total = choices.reduce((s, [, c]) => s + c, 0);
      let r = Math.random() * total;
      let chosen = parseInt(choices[0][0]);
      for (const [note, count] of choices) {
        r -= count;
        if (r <= 0) { chosen = parseInt(note); break; }
      }
      const octave = Math.floor(currentMidi / 12);
      nextMidi = chosen + octave * 12;
      if (Math.abs(nextMidi - currentMidi) > 12) nextMidi -= 12 * Math.sign(nextMidi - currentMidi);
    } else {
      // Scale-based movement
      const idx = scaleNotes.indexOf(scaleNotes.reduce((a, b) =>
        Math.abs(b - currentMidi) < Math.abs(a - currentMidi) ? b : a));
      const leap = Math.random() < sp.leapProb;
      const step = leap ? (Math.floor(Math.random() * 5) - 2) : (Math.floor(Math.random() * 3) - 1);
      const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + step));
      nextMidi = scaleNotes[newIdx];
    }

    // Duration
    const durations = Math.random() < sp.syncoProb
      ? [0.25, 0.5, 0.75, 1.5]
      : [0.5, 1, 2];
    const duration = durations[Math.floor(Math.random() * durations.length)];

    // Ornament (grace note)
    if (Math.random() < sp.ornamentProb && beat > 0) {
      const grace = nextMidi + (Math.random() < 0.5 ? 1 : -1);
      result.push({ midi: grace, duration: 0.125, beat, isGrace: true, velocity: 0.5 });
      beat += 0.125;
    }

    const swing = (beat % 1 === 0.5) ? sp.swingFactor : 0;
    const velocity = 0.5 + Math.random() * 0.4 + (beat % beatsPerBar === 0 ? 0.1 : 0);

    result.push({ midi: nextMidi, duration, beat: beat + swing, velocity: Math.min(1, velocity) });
    currentMidi = nextMidi;
    beat += duration;
  }

  return result;
}

// ══════════════════════════════════════════════
//  AUDIO SYNTHESIS ENGINE (Web Audio)
// ══════════════════════════════════════════════

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.scheduledNodes = [];
  }

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  stop() {
    this.playing = false;
    this.scheduledNodes.forEach(n => { try { n.stop(); } catch(e){} });
    this.scheduledNodes = [];
  }

  playNote(midi, startTime, duration, velocity = 0.7, timbre = "piano") {
    if (!this.ctx || midi < 0) return;
    const freq = midiToFreq(midi);

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";

    const timbres = {
      piano: { wave: "triangle", filterFreq: 4000, attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
      synth: { wave: "sawtooth", filterFreq: 2500, attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
      organ: { wave: "sine", filterFreq: 6000, attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
      strings: { wave: "sawtooth", filterFreq: 3000, attack: 0.15, decay: 0.3, sustain: 0.7, release: 0.5 },
    };
    const t = timbres[timbre] || timbres.piano;

    filter.frequency.value = t.filterFreq;
    filter.Q.value = 1;

    const osc = this.ctx.createOscillator();
    osc.type = t.wave;
    osc.frequency.value = freq;

    // Vibrato for strings
    if (timbre === "strings") {
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.value = 5;
      vibratoGain.gain.value = 3;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(startTime);
      vibrato.stop(startTime + duration + t.release + 0.1);
    }

    // ADSR envelope
    const vol = velocity * 0.3;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + t.attack);
    gain.gain.linearRampToValueAtTime(vol * t.sustain, startTime + t.attack + t.decay);
    gain.gain.setValueAtTime(vol * t.sustain, startTime + duration);
    gain.gain.linearRampToValueAtTime(0, startTime + duration + t.release);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + t.release + 0.05);
    this.scheduledNodes.push(osc);
  }

  playSequence(notes, tempo = 120, timbre = "piano", onNotePlay) {
    this.init();
    this.stop();
    this.playing = true;

    const beatDuration = 60 / tempo;
    const startTime = this.ctx.currentTime + 0.1;

    notes.forEach((note, i) => {
      if (!this.playing) return;
      const noteStart = startTime + note.beat * beatDuration;
      const noteDur = note.duration * beatDuration;

      if (!note.isRest) {
        this.playNote(note.midi, noteStart, noteDur, note.velocity || 0.7, timbre);
      }

      if (onNotePlay) {
        const delay = (noteStart - this.ctx.currentTime) * 1000;
        if (delay > 0) setTimeout(() => onNotePlay(i), delay);
      }
    });

    const totalDuration = notes.reduce((max, n) => Math.max(max, (n.beat + n.duration) * beatDuration), 0);
    setTimeout(() => { this.playing = false; }, (totalDuration + 1) * 1000);
  }
}

// ══════════════════════════════════════════════
//  STAFF NOTATION RENDERER (SVG)
// ══════════════════════════════════════════════

function StaffNotation({ notes, highlightIndex = -1, label = "", color = "#d4a0ff" }) {
  if (!notes || !notes.length) return null;
  const playableNotes = notes.filter(n => !n.isRest);

  const W = 800, H = 160, margin = 60, staffTop = 30;
  const lineSpacing = 10;
  const noteSpacing = Math.min(40, (W - margin * 2) / Math.max(playableNotes.length, 1));

  // MIDI to staff Y position (treble clef, middle C = ledger line below)
  const midiToY = (midi) => {
    const noteMap = { 0:0,1:0.5,2:1,3:1.5,4:2,5:3,6:3.5,7:4,8:4.5,9:5,10:5.5,11:6 };
    const pc = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const semitonePos = noteMap[pc] + (oct - 4) * 7;
    return staffTop + 4 * lineSpacing - semitonePos * (lineSpacing / 2);
  };

  const isSharp = (midi) => [1,3,6,8,10].includes(midi % 12);

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontSize: 13, color: "#aaa", marginBottom: 4, fontFamily: "'Cormorant Garamond', serif" }}>{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Staff lines */}
        {[0,1,2,3,4].map(i => (
          <line key={i} x1={30} y1={staffTop + i * lineSpacing} x2={W - 20} y2={staffTop + i * lineSpacing}
            stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        ))}

        {/* Treble clef symbol */}
        <text x={10} y={staffTop + 32} fill="rgba(255,255,255,0.3)" fontSize={42} fontFamily="serif">𝄞</text>

        {/* Notes */}
        {playableNotes.map((note, i) => {
          const x = margin + i * noteSpacing;
          const y = midiToY(note.midi);
          const isHighlighted = notes.indexOf(note) === highlightIndex;
          const noteColor = isHighlighted ? "#fff" : color;
          const r = note.isGrace ? 3 : 5;

          // Determine if note needs ledger lines
          const ledgerLines = [];
          if (y > staffTop + 4 * lineSpacing) {
            for (let ly = staffTop + 5 * lineSpacing; ly <= y + 2; ly += lineSpacing)
              ledgerLines.push(ly);
          }
          if (y < staffTop) {
            for (let ly = staffTop - lineSpacing; ly >= y - 2; ly -= lineSpacing)
              ledgerLines.push(ly);
          }

          return (
            <g key={i}>
              {ledgerLines.map((ly, li) => (
                <line key={li} x1={x - 8} y1={ly} x2={x + 8} y2={ly} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              ))}
              {/* Note head */}
              <ellipse cx={x} cy={y} rx={r} ry={r * 0.75}
                fill={note.duration >= 2 ? "none" : noteColor}
                stroke={noteColor} strokeWidth={1.5}
                style={{ filter: isHighlighted ? `drop-shadow(0 0 6px ${color})` : "none",
                  transition: "all 0.15s ease" }} />
              {/* Stem */}
              {!note.isGrace && (
                <line x1={x + (y > staffTop + 2 * lineSpacing ? -r : r)}
                  y1={y} x2={x + (y > staffTop + 2 * lineSpacing ? -r : r)}
                  y2={y + (y > staffTop + 2 * lineSpacing ? -28 : 28)}
                  stroke={noteColor} strokeWidth={1.2} />
              )}
              {/* Sharp sign */}
              {isSharp(note.midi) && (
                <text x={x - 12} y={y + 4} fill={noteColor} fontSize={12} fontFamily="serif">♯</text>
              )}
              {/* Glow for highlighted */}
              {isHighlighted && (
                <circle cx={x} cy={y} r={12} fill="none" stroke={color} strokeWidth={0.5} opacity={0.5}>
                  <animate attributeName="r" from="8" to="16" dur="0.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="0.6s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════
//  WAVEFORM VISUALIZATION
// ══════════════════════════════════════════════

function WaveformViz({ isPlaying }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!isPlaying) {
        ctx.strokeStyle = "rgba(180, 140, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "rgba(180, 100, 255, 0.6)");
      gradient.addColorStop(0.5, "rgba(100, 200, 255, 0.6)");
      gradient.addColorStop(1, "rgba(255, 150, 200, 0.6)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = x / w;
        const y = h / 2 +
          Math.sin(t * 8 + frame * 0.05) * 15 * Math.sin(frame * 0.02) +
          Math.sin(t * 15 + frame * 0.08) * 8 +
          Math.sin(t * 3 + frame * 0.03) * 10 * Math.cos(frame * 0.01);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Mirror
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = x / w;
        const y = h / 2 -
          (Math.sin(t * 8 + frame * 0.05) * 15 * Math.sin(frame * 0.02) +
          Math.sin(t * 15 + frame * 0.08) * 8) * 0.6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying]);

  return <canvas ref={canvasRef} width={700} height={60} style={{ width: "100%", height: 60, borderRadius: 8 }} />;
}

// ══════════════════════════════════════════════
//  PRESET MELODIES
// ══════════════════════════════════════════════

const PRESET_MELODIES = {
  "Twinkle Twinkle": [
    { midi: 60, duration: 1 }, { midi: 60, duration: 1 }, { midi: 67, duration: 1 }, { midi: 67, duration: 1 },
    { midi: 69, duration: 1 }, { midi: 69, duration: 1 }, { midi: 67, duration: 2 },
    { midi: 65, duration: 1 }, { midi: 65, duration: 1 }, { midi: 64, duration: 1 }, { midi: 64, duration: 1 },
    { midi: 62, duration: 1 }, { midi: 62, duration: 1 }, { midi: 60, duration: 2 },
  ],
  "Jazz Blues (Bb)": [
    { midi: 70, duration: 0.5 }, { midi: 73, duration: 0.5 }, { midi: 75, duration: 1 }, { midi: 73, duration: 0.5 },
    { midi: 70, duration: 0.5 }, { midi: 68, duration: 1 }, { midi: 70, duration: 1 }, { midi: 75, duration: 0.5 },
    { midi: 73, duration: 0.5 }, { midi: 72, duration: 1 }, { midi: 70, duration: 1 }, { midi: 68, duration: 1 },
    { midi: 66, duration: 0.5 }, { midi: 68, duration: 0.5 }, { midi: 70, duration: 2 },
  ],
  "Minor Waltz": [
    { midi: 69, duration: 1 }, { midi: 72, duration: 0.5 }, { midi: 76, duration: 0.5 }, { midi: 75, duration: 1 },
    { midi: 72, duration: 1 }, { midi: 69, duration: 1 }, { midi: 68, duration: 0.5 }, { midi: 69, duration: 0.5 },
    { midi: 72, duration: 2 }, { midi: 76, duration: 1 }, { midi: 75, duration: 0.5 }, { midi: 73, duration: 0.5 },
    { midi: 72, duration: 1 }, { midi: 69, duration: 2 },
  ],
  "Pentatonic Riff": [
    { midi: 64, duration: 0.5 }, { midi: 67, duration: 0.5 }, { midi: 69, duration: 0.5 }, { midi: 71, duration: 0.5 },
    { midi: 72, duration: 1 }, { midi: 71, duration: 0.5 }, { midi: 69, duration: 0.5 }, { midi: 67, duration: 1 },
    { midi: 64, duration: 0.5 }, { midi: 62, duration: 0.5 }, { midi: 60, duration: 1 }, { midi: 62, duration: 0.5 },
    { midi: 64, duration: 0.5 }, { midi: 67, duration: 2 },
  ],
};

// ══════════════════════════════════════════════
//  MAIN APP COMPONENT
// ══════════════════════════════════════════════

export default function InspirationMuse({ embedded = false }) {
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
    (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:8000"
      : "");
  const DURATION_OPTIONS = [
    { value: 0.25, label: "16分音符" },
    { value: 0.5, label: "8分音符" },
    { value: 1, label: "4分音符" },
    { value: 1.5, label: "附点4分" },
    { value: 2, label: "2分音符" },
  ];
  const [phase, setPhase] = useState("input"); // input | analyzing | result
  const [melody, setMelody] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [improvisation, setImprovisation] = useState([]);
  const [style, setStyle] = useState("jazz");
  const [timbre, setTimbre] = useState("piano");
  const [tempo, setTempo] = useState(120);
  const [bars, setBars] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingWhat, setPlayingWhat] = useState(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [apiAnalysis, setApiAnalysis] = useState("");
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [inputMode, setInputMode] = useState("piano"); // piano | upload
  const [customNotes, setCustomNotes] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [uploadHint, setUploadHint] = useState("");
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);
  const audioRef = useRef(new AudioEngine());
  const durationToLabel = useCallback((duration) => {
    const matched = DURATION_OPTIONS.find(opt => opt.value === duration);
    return matched ? matched.label : `${duration}拍`;
  }, [DURATION_OPTIONS]);

  // Piano keyboard for custom input
  const addNoteFromPiano = (midi) => {
    const newNote = { midi, duration: selectedDuration };
    const updated = [...customNotes, newNote];
    setCustomNotes(updated);
    // Play the note
    audioRef.current.init();
    audioRef.current.playNote(midi, audioRef.current.ctx.currentTime, Math.max(0.2, selectedDuration * 0.35), 0.6, timbre);
  };

  const loadCustomNotes = () => {
    if (!customNotes.length) return;
    let beat = 0;
    const withBeats = customNotes.map(n => {
      const note = { ...n, beat };
      beat += n.duration;
      return note;
    });
    setMelody(withBeats);
    setImprovisation([]);
    setApiAnalysis("");
  };

  const loadPresetMelody = (presetName) => {
    const preset = PRESET_MELODIES[presetName] || [];
    let beat = 0;
    const withBeats = preset.map((note) => {
      const next = { ...note, beat };
      beat += note.duration;
      return next;
    });
    setMelody(withBeats);
    setImprovisation([]);
    setApiAnalysis(`已载入 ${presetName}，你现在可以直接开始生成。`);
    setToast(`已为你载入预设：${presetName}`);
    setPhase("input");
  };

  // Parse sheet music image through backend OMR API
  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadHint("正在识别乐谱内容...");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_BASE}/api/score/parse`, { method: "POST", body: form });
      const data = await response.json();
      const detected = (Array.isArray(data.notes) && data.notes.length
        ? data.notes.map((n) => ({
            midi: n.pitch_midi,
            duration: n.duration_beat || 1,
            beat: n.start_beat || 0,
          }))
        : (data.detected || []).map((n) => ({
            midi: n.midi,
            duration: n.duration || 1,
            beat: n.beat || 0,
          }))
      );
      if (detected.length) {
        setMelody(detected);
        setImprovisation([]);
        setApiAnalysis("");
        setUploadHint(data.message || "已成功载入旋律内容。");
        setToast("图片识别完成，旋律内容已载入。 ");
      } else {
        setUploadHint("这张图片里暂时没有识别到可用旋律。");
        setToast("暂时没有识别到可用旋律，请尝试更清晰的图片。 ");
      }
    } catch (e) {
      setUploadHint("暂时无法读取这张乐谱图片，请稍后再试。");
      setToast("图片上传失败，请稍后再试。 ");
    }
  };

  // Analyze & Generate
  const handleGenerate = async () => {
    if (!melody.length) return;
    setPhase("analyzing");
    setIsApiLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/improv/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: melody,
          style,
          bars,
          tempo,
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "生成失败");
      setAnalysis(data.analysis || analyzeMelody(melody));
      setImprovisation(data.improvisation || []);
      setApiAnalysis("新的旋律已经生成完成。你可以直接试听、查看和声建议，或继续调整参数。 ");
      setToast("生成完成，你现在可以试听和导出结果。 ");
    } catch (e) {
      const localAnalysis = analyzeMelody(melody);
      localAnalysis.tempo = tempo;
      setAnalysis(localAnalysis);
      setImprovisation(generateImprovisation(localAnalysis, melody, style, bars));
      setApiAnalysis("结果已经生成完成。你可以继续试听和比较当前版本。 ");
      setToast("生成完成，你现在可以试听和比较当前版本。 ");
    }
    setIsApiLoading(false);
    setPhase("result");
  };

  const buildEnsembleNotes = () => [...melody, ...improvisation].sort((a, b) => a.beat - b.beat);

  const exportMidi = async (useCombined = true) => {
    const target = useCombined ? buildEnsembleNotes() : improvisation;
    if (!target.length) return;
    try {
      const response = await fetch(`${API_BASE}/api/midi/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: target, tempo, filename: "muse_improv.mid" }),
      });
      if (!response.ok) throw new Error("导出失败");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "muse_improv.mid";
      a.click();
      window.URL.revokeObjectURL(url);
      setToast("MIDI 文件已开始导出。 ");
    } catch (e) {
      setApiAnalysis("当前无法导出文件，请稍后再试。");
      setToast("导出失败，请稍后再试。 ");
    }
  };

  // Playback
  const play = (what) => {
    audioRef.current.init();
    audioRef.current.stop();
    setIsPlaying(true);
    setPlayingWhat(what);
    setHighlightIdx(-1);

    const notes = what === "original" ? melody :
                  what === "improv" ? improvisation :
                  buildEnsembleNotes();

    audioRef.current.playSequence(notes, tempo, timbre, (idx) => setHighlightIdx(idx));

    const totalBeats = notes.reduce((m, n) => Math.max(m, n.beat + n.duration), 0);
    setTimeout(() => { setIsPlaying(false); setPlayingWhat(null); setHighlightIdx(-1); }, (totalBeats * 60 / tempo + 1.5) * 1000);
  };

  const stop = () => {
    audioRef.current.stop();
    setIsPlaying(false);
    setPlayingWhat(null);
    setHighlightIdx(-1);
  };

  // Extended piano keys (4 octaves, C3-B6)
  const pianoKeys = [];
  for (let midi = 48; midi <= 95; midi++) {
    const name = NOTE_NAMES[midi % 12];
    const isBlack = [1,3,6,8,10].includes(midi % 12);
    pianoKeys.push({ midi, name, isBlack });
  }
  const whiteKeys = pianoKeys.filter(k => !k.isBlack);

  // ── STYLES ──
  const css = {
    app: {
      minHeight: embedded ? "auto" : "100vh",
      background: embedded ? "transparent" : "linear-gradient(170deg, #0a0612 0%, #110b20 40%, #0d1025 70%, #080510 100%)",
      color: embedded ? "#f2ebff" : "#e0d8f0",
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      padding: embedded ? "0" : "24px 16px",
      position: "relative",
      overflow: "hidden",
    },
    header: {
      textAlign: "center",
      marginBottom: 32,
      position: "relative",
      zIndex: 1,
    },
    title: {
      fontSize: 42,
      fontWeight: 300,
      letterSpacing: 8,
      background: "linear-gradient(135deg, #c9a0ff 0%, #7eb8ff 50%, #ffb0d0 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: "rgba(180,160,220,0.6)",
      letterSpacing: 4,
      textTransform: "uppercase",
    },
    section: {
      background: embedded ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
      borderRadius: embedded ? 24 : 16,
      padding: embedded ? 28 : 24,
      marginBottom: 20,
      border: embedded ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "blur(20px)",
      boxShadow: embedded ? "0 18px 40px rgba(0,0,0,0.18)" : "none",
    },
    sectionTitle: {
      fontSize: embedded ? 21 : 18,
      fontWeight: 600,
      marginBottom: 16,
      color: embedded ? "#f4ecff" : "#c9a0ff",
      letterSpacing: 2,
    },
    btn: (active = false, accent = "#c9a0ff") => ({
      padding: "8px 18px",
      borderRadius: 8,
      border: active ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.1)",
      background: active ? `${accent}22` : "rgba(255,255,255,0.04)",
      color: active ? accent : embedded ? "#d5cde7" : "#b0a8c8",
      cursor: "pointer",
      fontSize: 14,
      fontFamily: "'Cormorant Garamond', serif",
      transition: "all 0.2s",
      letterSpacing: 1,
    }),
    bigBtn: (color = "#c9a0ff") => ({
      padding: "12px 32px",
      borderRadius: 12,
      border: "none",
      background: `linear-gradient(135deg, ${color}, ${color}88)`,
      color: "#fff",
      cursor: "pointer",
      fontSize: 16,
      fontFamily: "'Cormorant Garamond', serif",
      fontWeight: 600,
      letterSpacing: 2,
      boxShadow: `0 4px 20px ${color}44`,
      transition: "all 0.3s",
    }),
    pill: (active) => ({
      padding: "6px 14px",
      borderRadius: 20,
      border: active ? "1px solid #c9a0ff" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(201,160,255,0.15)" : "transparent",
      color: active ? "#c9a0ff" : "#8880a0",
      cursor: "pointer",
      fontSize: 13,
      transition: "all 0.2s",
    }),
    input: {
      width: "100%",
      padding: "10px 14px",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.06)",
      color: "#f4ecff",
      fontSize: 14,
      fontFamily: "monospace",
      outline: "none",
      boxSizing: "border-box",
    },
    slider: {
      width: "100%",
      accentColor: "#c9a0ff",
      cursor: "pointer",
    },
    badge: (color = "#c9a0ff") => ({
      display: "inline-block",
      padding: "4px 12px",
      borderRadius: 20,
      background: `${color}22`,
      color,
      fontSize: 13,
      marginRight: 8,
      marginBottom: 6,
      border: `1px solid ${color}33`,
    }),
    analysisBox: {
      background: "rgba(201,160,255,0.05)",
      borderRadius: 12,
      padding: 16,
      border: "1px solid rgba(201,160,255,0.1)",
      fontSize: 14,
      lineHeight: 1.8,
      whiteSpace: "pre-wrap",
      color: "#c8c0d8",
      maxHeight: 300,
      overflowY: "auto",
    },
    fileShell: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
      padding: "14px 16px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.05)",
    },
    fileButton: {
      padding: "10px 16px",
      borderRadius: 10,
      border: "1px solid rgba(201,160,255,0.32)",
      background: "linear-gradient(135deg, rgba(201,160,255,0.24), rgba(126,184,255,0.18))",
      color: "#f5efff",
      fontFamily: "inherit",
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: 0.5,
      cursor: "pointer",
    },
    fileName: {
      fontSize: 13,
      color: "#ddd5ee",
      opacity: 0.92,
    },
    statusRow: {
      display: "grid",
      gridTemplateColumns: embedded ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
      gap: 12,
      marginBottom: 18,
    },
    statusCard: {
      padding: "14px 16px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.05)",
    },
    statusTitle: {
      fontSize: 12,
      color: "#bdb2d4",
      marginBottom: 6,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    statusValue: {
      fontSize: 14,
      color: "#f3ecff",
      lineHeight: 1.5,
    },
    emptyPanel: {
      marginTop: 16,
      padding: 18,
      borderRadius: 14,
      border: "1px dashed rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.03)",
      color: "#cfc5df",
      lineHeight: 1.7,
    },
    presetRow: {
      display: "grid",
      gridTemplateColumns: embedded ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
      gap: 12,
      marginBottom: 18,
    },
    presetCard: {
      padding: "14px 16px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.1)",
      background: "rgba(255,255,255,0.04)",
      cursor: "pointer",
      textAlign: "left",
    },
    presetName: {
      display: "block",
      color: "#f3ecff",
      fontSize: 15,
      marginBottom: 6,
      fontWeight: 600,
    },
    presetDesc: {
      color: "#bdb2d4",
      fontSize: 13,
      lineHeight: 1.6,
    },
    toast: {
      marginBottom: 18,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(44,210,182,0.18)",
      background: "rgba(44,210,182,0.12)",
      color: "#e8fff9",
      fontSize: 13,
      lineHeight: 1.6,
    },
    actionBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 18,
      flexWrap: "wrap",
    },
    actionMeta: {
      color: "#bdb2d4",
      fontSize: 13,
      lineHeight: 1.6,
    },
  };

  return (
    <div style={css.app}>
      {/* Ambient particles */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
        {[...Array(20)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            borderRadius: "50%",
            background: `rgba(${150 + Math.random()*100}, ${100 + Math.random()*100}, 255, ${0.1 + Math.random()*0.2})`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${5 + Math.random()*10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
        }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(201,160,255,0.2); border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: embedded ? 1120 : 800, margin: "0 auto" }}>
        {/* Header */}
        {!embedded && (
          <header style={css.header}>
            <h1 style={css.title}>MuseMelody</h1>
            <p style={css.subtitle}>AI Music Improvisation Generator</p>
            <p style={{ fontSize: 12, color: "rgba(160,140,200,0.4)", marginTop: 4, letterSpacing: 2 }}>
              旋律生成 · 和声建议 · 即时试听
            </p>
          </header>
        )}

        {/* ═══ INPUT SECTION ═══ */}
        <section style={css.section}>
          <h2 style={css.sectionTitle}>⟐ 输入旋律</h2>

          {toast && <div style={css.toast}>{toast}</div>}

          <div style={css.statusRow}>
            <div style={css.statusCard}>
              <div style={css.statusTitle}>当前输入</div>
              <div style={css.statusValue}>{melody.length ? `已载入 ${melody.length} 个音符` : "尚未载入旋律"}</div>
            </div>
            <div style={css.statusCard}>
              <div style={css.statusTitle}>当前状态</div>
              <div style={css.statusValue}>{phase === "result" ? "已生成结果" : phase === "analyzing" ? "正在生成中" : "等待开始"}</div>
            </div>
            <div style={css.statusCard}>
              <div style={css.statusTitle}>下一步</div>
              <div style={css.statusValue}>{melody.length ? "设置参数后点击生成" : "先选择预设、录入或上传旋律"}</div>
            </div>
          </div>

          <div style={css.presetRow}>
            <button type="button" style={css.presetCard} onClick={() => loadPresetMelody("Twinkle Twinkle")}>
              <span style={css.presetName}>快速体验</span>
              <span style={css.presetDesc}>用熟悉旋律快速跑通生成、试听和结果区。</span>
            </button>
            <button type="button" style={css.presetCard} onClick={() => loadPresetMelody("Jazz Blues (Bb)")}>
              <span style={css.presetName}>风格测试</span>
              <span style={css.presetDesc}>更适合观察和声色彩和生成方向的变化。</span>
            </button>
            <button type="button" style={css.presetCard} onClick={() => loadPresetMelody("Minor Waltz")}>
              <span style={css.presetName}>抒情延展</span>
              <span style={css.presetDesc}>适合测试更流动、更抒情的旋律发展结果。</span>
            </button>
          </div>

          {/* Input mode tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[["piano", "键盘输入"], ["upload", "图片识别"]].map(([mode, label]) => (
              <button key={mode} style={css.pill(inputMode === mode)}
                onClick={() => setInputMode(mode)}>{label}</button>
            ))}
          </div>

          {/* Piano keyboard input */}
          {inputMode === "piano" && (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#a098b8" }}>时值：</span>
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.value} style={css.pill(selectedDuration === opt.value)} onClick={() => setSelectedDuration(opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ position: "relative", height: 100, marginBottom: 8, userSelect: "none" }}>
                {/* White keys */}
                {whiteKeys.map((k, i) => (
                  <div key={k.midi}
                    onClick={() => addNoteFromPiano(k.midi)}
                    style={{
                      position: "absolute",
                      left: i * (100 / whiteKeys.length) + "%",
                      width: (100 / whiteKeys.length - 0.2) + "%",
                      height: "100%",
                      background: customNotes.some(n => n.midi === k.midi) ? "rgba(201,160,255,0.3)" : "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "0 0 6px 6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 4,
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                      transition: "background 0.15s",
                    }}>
                    {midiToName(k.midi)}
                  </div>
                ))}
                {/* Black keys */}
                {pianoKeys.filter(k => k.isBlack).map(k => {
                  const whiteIdx = pianoKeys.filter(wk => !wk.isBlack && wk.midi < k.midi).length;
                  return (
                    <div key={k.midi}
                      onClick={() => addNoteFromPiano(k.midi)}
                      style={{
                        position: "absolute",
                        left: (whiteIdx * (100 / whiteKeys.length) - (100 / whiteKeys.length) * 0.3) + "%",
                        width: (100 / whiteKeys.length * 0.6) + "%",
                        height: "60%",
                        background: customNotes.some(n => n.midi === k.midi) ? "rgba(201,160,255,0.5)" : "rgba(30,20,50,0.9)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "0 0 4px 4px",
                        cursor: "pointer",
                        zIndex: 2,
                        transition: "background 0.15s",
                      }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8880a0" }}>
                  {customNotes.length ? customNotes.map(n => `${midiToName(n.midi)}:${durationToLabel(n.duration)}`).join("  ") : "点击琴键录入音高与标准时值（当前覆盖 C3-B6）"}
                </span>
                <button style={css.btn(false)} onClick={loadCustomNotes}>载入</button>
                <button style={css.btn(false)} onClick={() => setCustomNotes(customNotes.slice(0, -1))}>撤销</button>
                <button style={css.btn(false)} onClick={() => setCustomNotes([])}>清除</button>
              </div>
            </div>
          )}

          {/* Upload image input */}
          {inputMode === "upload" && (
            <div>
              <p style={{ fontSize: 12, color: "#8880a0", marginBottom: 8 }}>
                上传五线谱或六线谱图片，系统会先将其转换为可用于续写的旋律数据。
              </p>
              <div style={css.fileShell}>
                <button type="button" style={css.fileButton} onClick={() => fileInputRef.current?.click()}>
                  选择图片
                </button>
                <span style={css.fileName}>{uploadHint || "支持 PNG、JPG 等常见图片格式"}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleImageUpload(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </div>
              {uploadHint && <p style={{ fontSize: 12, color: "#a098b8", marginTop: 8 }}>{uploadHint}</p>}
            </div>
          )}

          {/* Show loaded melody */}
          {melody.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <StaffNotation notes={melody} label="原始旋律 Original Melody"
                highlightIndex={playingWhat === "original" ? highlightIdx : -1} color="#7eb8ff" />
            </div>
          )}

          {!melody.length && (
            <div style={css.emptyPanel}>
              你可以通过三种方式开始：
              <br />
              1. 选择一个预设旋律，快速体验完整流程。
              <br />
              2. 用键盘录入一段自己的旋律。
              <br />
              3. 上传乐谱图片，让系统先识别出旋律内容。
            </div>
          )}
        </section>

        {/* ═══ PARAMETERS ═══ */}
        <section style={css.section}>
          <h2 style={css.sectionTitle}>⟐ 生成参数</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Style */}
            <div>
              <label style={{ fontSize: 13, color: "#a098b8", display: "block", marginBottom: 6 }}>生成风格</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[ ["jazz","爵士"], ["blues","蓝调"], ["classical","古典"], ["experimental","实验"] ].map(([s, l]) => (
                  <button key={s} style={css.pill(style === s)} onClick={() => setStyle(s)}>{l}</button>
                ))}
              </div>
            </div>
            {/* Timbre */}
            <div>
              <label style={{ fontSize: 13, color: "#a098b8", display: "block", marginBottom: 6 }}>音色</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[ ["piano","钢琴"], ["synth","合成器"], ["organ","风琴"], ["strings","弦乐"] ].map(([t, l]) => (
                  <button key={t} style={css.pill(timbre === t)} onClick={() => setTimbre(t)}>{l}</button>
                ))}
              </div>
            </div>
            {/* Tempo */}
            <div>
              <label style={{ fontSize: 13, color: "#a098b8" }}>速度 (BPM): {tempo}</label>
              <input type="range" min={60} max={200} value={tempo}
                onChange={e => setTempo(+e.target.value)} style={css.slider} />
            </div>
            {/* Bars */}
            <div>
              <label style={{ fontSize: 13, color: "#a098b8" }}>生成小节数: {bars}</label>
              <input type="range" min={4} max={16} value={bars}
                onChange={e => setBars(+e.target.value)} style={css.slider} />
            </div>
          </div>

          {/* Generate button */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button style={css.bigBtn("#c9a0ff")} onClick={handleGenerate}
              disabled={!melody.length || phase === "analyzing"}>
              {phase === "analyzing" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    正在生成…
                </span>
                ) : "生成旋律"}
            </button>
          </div>
        </section>

        {/* ═══ RESULTS ═══ */}
        {phase === "result" && improvisation.length > 0 && (
          <>
            {/* Analysis */}
            <section style={css.section}>
              <h2 style={css.sectionTitle}>⟐ 结果概览</h2>
              {analysis && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  <span style={css.badge("#7eb8ff")}>调性: {analysis.key} {analysis.scale}</span>
                  <span style={css.badge("#ffb0d0")}>风格: {style}</span>
                  <span style={css.badge("#80e8c0")}>BPM: {tempo}</span>
                  <span style={css.badge("#ffd080")}>长度: {bars} 小节</span>
                  <span style={css.badge("#c9a0ff")}>音符数: {improvisation.filter(n => !n.isRest).length}</span>
                </div>
              )}
              <div style={css.analysisBox}>
                {isApiLoading ? (
                  <span style={{ color: "#a098b8", animation: "pulse 1.5s infinite" }}>正在整理结果…</span>
                ) : apiAnalysis}
              </div>
            </section>

            {/* Generated Score */}
            <section style={css.section}>
              <h2 style={css.sectionTitle}>⟐ 生成结果</h2>
              <StaffNotation notes={improvisation} label="生成旋律 Generated Melody"
                highlightIndex={playingWhat === "improv" ? highlightIdx : -1} color="#ffb0d0" />

              {/* Waveform */}
              <WaveformViz isPlaying={isPlaying} />

              {/* Playback controls */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                <button style={css.bigBtn("#7eb8ff")} onClick={() => play("original")}
                  disabled={isPlaying}>▶ 原始旋律</button>
                <button style={css.bigBtn("#ffb0d0")} onClick={() => play("improv")}
                  disabled={isPlaying}>▶ 生成旋律</button>
                <button style={css.bigBtn("#80e8c0")} onClick={() => play("both")}
                  disabled={isPlaying}>▶ 合并试听</button>
                {isPlaying && (
                  <button style={css.bigBtn("#ff8888")} onClick={stop}>⏹ 停止播放</button>
                )}
              </div>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button style={{ ...css.btn(false), fontSize: 13 }} onClick={() => exportMidi(true)}>
                  ⤓ 导出 MIDI
                </button>
              </div>

              <div style={css.actionBar}>
                <div style={css.actionMeta}>你可以试听原旋律、试听生成结果，或直接导出当前版本继续使用。</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={{ ...css.btn(false), fontSize: 13 }} onClick={() => exportMidi(false)}>导出生成旋律</button>
                  <button style={{ ...css.btn(false), fontSize: 13 }} onClick={handleGenerate}>生成新版本</button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
