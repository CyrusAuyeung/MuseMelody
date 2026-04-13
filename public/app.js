const form = document.querySelector("#generator-form");
const generateButton = document.querySelector("#generate-button");
const playButton = document.querySelector("#play-button");
const fileInput = document.querySelector("#score-file");
const fileLabel = document.querySelector("#file-label");
const barsInput = document.querySelector("#bars");
const temperatureInput = document.querySelector("#temperature");
const densityInput = document.querySelector("#density");
const barsValue = document.querySelector("#bars-value");
const temperatureValue = document.querySelector("#temperature-value");
const densityValue = document.querySelector("#density-value");
const styleHidden = document.querySelector("#selected-style");
const outputHidden = document.querySelector("#selected-output");
const styleChooser = document.querySelector("#style-chooser");
const outputChooser = document.querySelector("#output-chooser");

const resultTitle = document.querySelector("#result-title");
const resultSummary = document.querySelector("#result-summary");
const harmonyList = document.querySelector("#harmony-list");
const phraseList = document.querySelector("#phrase-list");
const waveform = document.querySelector("#waveform");
const nextSteps = document.querySelector("#next-steps");
const bpmNode = document.querySelector("#result-bpm");
const requestIdNode = document.querySelector("#request-id");

let latestResponse = null;
let activeAudioContext = null;

const formatFloat = (value) => Number(value).toFixed(2);

const syncRanges = () => {
  barsValue.textContent = barsInput.value;
  temperatureValue.textContent = formatFloat(temperatureInput.value);
  densityValue.textContent = formatFloat(densityInput.value);
};

const updateSelectableGroup = (container, hiddenInput, dataKey) => {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-style], button[data-output]");
    if (!button) {
      return;
    }

    for (const chip of container.querySelectorAll(".chip")) {
      chip.classList.remove("chip--selected");
    }

    button.classList.add("chip--selected");
    hiddenInput.value = button.dataset[dataKey];
  });
};

const createLocalResponse = (payload) => {
  const styleProfiles = {
    "neo-soul": {
      chords: ["Cmaj9", "A7sus4", "Dm9", "G13", "Em7", "A13"],
      notes: ["C4", "D4", "E4", "G4", "A4", "B4", "D5"],
      contour: ["lift", "float", "turn", "resolve"]
    },
    "city-pop": {
      chords: ["Fmaj7", "G6", "Em7", "A7", "Dm7", "Cmaj7"],
      notes: ["A3", "C4", "D4", "E4", "G4", "A4", "C5"],
      contour: ["glide", "bounce", "rise", "flash"]
    },
    "jazz-waltz": {
      chords: ["Dm9", "G13", "Cmaj9", "A7alt", "Fmaj7", "E7#9"],
      notes: ["D4", "F4", "A4", "C5", "E5", "G5"],
      contour: ["arc", "spiral", "lean", "drop"]
    },
    "film-score": {
      chords: ["Am(add9)", "Fmaj7", "C/E", "Gsus2", "Dm11", "E7"],
      notes: ["A3", "C4", "E4", "G4", "B4", "C5", "E5"],
      contour: ["swell", "hover", "expand", "fade"]
    }
  };

  const profile = styleProfiles[payload.style] || styleProfiles["neo-soul"];
  const seedSource = `${payload.prompt}|${payload.bars}|${payload.temperature}|${payload.density}|${payload.style}`;
  let seed = Array.from(seedSource).reduce((total, char) => total + char.charCodeAt(0), 0);

  const randomFromSeed = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const bars = Number(payload.bars);
  const phrases = Array.from({ length: bars }, (_, index) => {
    const noteCount = 3 + Math.floor(randomFromSeed() * 3);
    const notes = Array.from({ length: noteCount }, () => {
      const pitch = profile.notes[Math.floor(randomFromSeed() * profile.notes.length)];
      const duration = [0.25, 0.5, 0.75, 1][Math.floor(randomFromSeed() * 4)];
      return { pitch, duration };
    });

    return {
      bar: index + 1,
      contour: profile.contour[Math.floor(randomFromSeed() * profile.contour.length)],
      motif: notes.map((note) => `${note.pitch}/${note.duration}`).join(" · "),
      notes
    };
  });

  return {
    requestId: `local-${Date.now().toString(36)}`,
    title: `${payload.style} demo improvisation`,
    overview: `基于 ${payload.inputType} 输入，生成 ${bars} 小节 ${payload.style} 风格片段。当前结果为前后端联调用 mock 数据，但结构已对齐后续模型接口。`,
    bpm: 88 + Math.round(randomFromSeed() * 36),
    harmony: Array.from({ length: Math.max(4, Math.ceil(bars / 2)) }, (_, index) => {
      return profile.chords[(index + Math.floor(randomFromSeed() * 2)) % profile.chords.length];
    }),
    phrases,
    waveform: Array.from({ length: 20 }, () => 0.15 + randomFromSeed() * 0.82),
    nextSteps: [
      "接入 Python 模型服务，让乐谱解析结果直接进入生成接口。",
      "将 mock note 数据替换成真实音高、时值、力度和和声标签。",
      "根据输出模式增加 MusicXML、MIDI 和音频文件下载。"
    ]
  };
};

const renderWaveform = (values) => {
  waveform.innerHTML = values
    .map((value) => `<span class="wave-bar" style="height:${Math.round(value * 100)}%"></span>`)
    .join("");
};

const renderHarmony = (harmony) => {
  harmonyList.innerHTML = harmony.map((item) => `<span class="tag">${item}</span>`).join("");
};

const renderPhrases = (phrases) => {
  phraseList.classList.remove("empty-state");
  phraseList.innerHTML = phrases
    .map((phrase) => {
      const noteMarkup = phrase.notes
        .map((note) => `<span class="note-pill">${note.pitch} / ${note.duration}</span>`)
        .join("");

      return `
        <article class="phrase-card">
          <div class="phrase-meta">
            <strong>Bar ${phrase.bar}</strong>
            <span class="phrase-contour">${phrase.contour}</span>
          </div>
          <div class="note-row">${noteMarkup}</div>
        </article>
      `;
    })
    .join("");
};

const renderResult = (response) => {
  resultTitle.textContent = response.title;
  resultSummary.textContent = response.overview;
  bpmNode.textContent = `BPM ${response.bpm}`;
  requestIdNode.textContent = response.requestId;
  renderHarmony(response.harmony);
  renderPhrases(response.phrases);
  renderWaveform(response.waveform);
  nextSteps.innerHTML = response.nextSteps.map((item) => `<li>${item}</li>`).join("");
  playButton.disabled = false;
};

const requestGeneration = async (payload) => {
  if (window.location.protocol === "file:") {
    return createLocalResponse(payload);
  }

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return createLocalResponse(payload);
  }
};

const noteToFrequency = (pitch) => {
  const pattern = /^([A-G])(#|b)?(\d)$/;
  const match = pitch.match(pattern);

  if (!match) {
    return 440;
  }

  const [, note, accidental, octaveText] = match;
  const semitoneMap = {
    C: -9,
    D: -7,
    E: -5,
    F: -4,
    G: -2,
    A: 0,
    B: 2
  };
  let semitones = semitoneMap[note] + (Number(octaveText) - 4) * 12;

  if (accidental === "#") {
    semitones += 1;
  }

  if (accidental === "b") {
    semitones -= 1;
  }

  return 440 * Math.pow(2, semitones / 12);
};

const playPreview = async () => {
  if (!latestResponse?.phrases?.length) {
    return;
  }

  if (!activeAudioContext) {
    activeAudioContext = new window.AudioContext();
  }

  if (activeAudioContext.state === "suspended") {
    await activeAudioContext.resume();
  }

  const phrases = latestResponse.phrases.flatMap((phrase) => phrase.notes);
  const bpm = latestResponse.bpm || 96;
  const beatLength = 60 / bpm;
  let cursor = activeAudioContext.currentTime + 0.05;

  for (const note of phrases) {
    const oscillator = activeAudioContext.createOscillator();
    const gain = activeAudioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = noteToFrequency(note.pitch);

    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(0.16, cursor + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + note.duration * beatLength);

    oscillator.connect(gain);
    gain.connect(activeAudioContext.destination);

    oscillator.start(cursor);
    oscillator.stop(cursor + note.duration * beatLength + 0.02);
    cursor += note.duration * beatLength;
  }
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.textContent = "生成中...";
  form.classList.add("is-loading");

  const payload = {
    prompt: document.querySelector("#prompt").value.trim(),
    inputType: document.querySelector("#input-type").value,
    style: styleHidden.value,
    outputMode: outputHidden.value,
    bars: Number(barsInput.value),
    temperature: Number(temperatureInput.value),
    density: Number(densityInput.value),
    fileName: fileInput.files[0]?.name || null
  };

  const response = await requestGeneration(payload);
  latestResponse = response;
  renderResult(response);

  generateButton.disabled = false;
  generateButton.textContent = "生成 demo 片段";
  form.classList.remove("is-loading");
});

playButton.addEventListener("click", playPreview);

fileInput.addEventListener("change", () => {
  fileLabel.textContent = fileInput.files[0]?.name || "拖入文件或点击选择乐谱";
});

barsInput.addEventListener("input", syncRanges);
temperatureInput.addEventListener("input", syncRanges);
densityInput.addEventListener("input", syncRanges);

updateSelectableGroup(styleChooser, styleHidden, "style");
updateSelectableGroup(outputChooser, outputHidden, "output");
syncRanges();
