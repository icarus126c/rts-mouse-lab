const rhythmArena = document.querySelector("#rhythmArena");
const rhythmTargetLayer = document.querySelector("#rhythmTargetLayer");
const rhythmPulse = document.querySelector("#rhythmPulse");
const rhythmMessage = document.querySelector("#rhythmMessage");
const rhythmStartButton = document.querySelector("#rhythmStartButton");
const rhythmStopButton = document.querySelector("#rhythmStopButton");
const rhythmFullscreenButton = document.querySelector("#rhythmFullscreenButton");
const clearRhythmHistoryButton = document.querySelector("#clearRhythmHistoryButton");
const roundsInput = document.querySelector("#roundsInput");
const chainInput = document.querySelector("#chainInput");
const rhythmSizeInput = document.querySelector("#rhythmSizeInput");
const rhythmRangeInput = document.querySelector("#rhythmRangeInput");
const showPulseInput = document.querySelector("#showPulseInput");
const hitSoundInput = document.querySelector("#hitSoundInput");
const roundsOutput = document.querySelector("#roundsOutput");
const chainOutput = document.querySelector("#chainOutput");
const rhythmSizeOutput = document.querySelector("#rhythmSizeOutput");
const rhythmRangeOutput = document.querySelector("#rhythmRangeOutput");
const rhythmState = document.querySelector("#rhythmState");
const roundMetric = document.querySelector("#roundMetric");
const chainMetric = document.querySelector("#chainMetric");
const hitMetric = document.querySelector("#hitMetric");
const acquireMetric = document.querySelector("#acquireMetric");
const rhythmMetric = document.querySelector("#rhythmMetric");
const roundTimeValue = document.querySelector("#roundTimeValue");
const roundAverageValue = document.querySelector("#roundAverageValue");
const roundMissValue = document.querySelector("#roundMissValue");
const roundSpreadValue = document.querySelector("#roundSpreadValue");
const rhythmSummary = document.querySelector("#rhythmSummary");
const rhythmHistoryList = document.querySelector("#rhythmHistoryList");

const RHYTHM_STORAGE_KEY = "command-rhythm-history";

let rhythmRun = null;
let rhythmRound = null;
let rhythmRoundTimer = 0;
let rhythmAudioContext = null;
let rhythmHistory = loadRhythmHistory();

function loadRhythmHistory() {
  try {
    return JSON.parse(localStorage.getItem(RHYTHM_STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveRhythmHistory() {
  localStorage.setItem(RHYTHM_STORAGE_KEY, JSON.stringify(rhythmHistory.slice(0, 8)));
}

function rhythmSettings() {
  return {
    rounds: Number(roundsInput.value),
    chainLength: Number(chainInput.value),
    targetSize: Number(rhythmSizeInput.value),
    spawnRange: Number(rhythmRangeInput.value) / 100,
    showPulse: showPulseInput.checked,
    hitSound: hitSoundInput.checked,
  };
}

function syncRhythmOutputs() {
  roundsOutput.textContent = roundsInput.value;
  chainOutput.textContent = chainInput.value;
  rhythmSizeOutput.textContent = `${rhythmSizeInput.value}px`;
  rhythmRangeOutput.textContent = `${rhythmRangeInput.value}%`;
  if (!rhythmRun) {
    roundMetric.textContent = `0 / ${roundsInput.value}`;
    chainMetric.textContent = `0 / ${chainInput.value}`;
  }
}

function startRhythm() {
  finishRhythm(false);
  rhythmRun = {
    settings: rhythmSettings(),
    rounds: [],
    hits: 0,
    misses: 0,
    acquireTimes: [],
  };
  rhythmState.textContent = "训练中";
  rhythmMessage.hidden = true;
  rhythmSummary.textContent = "保持连续下指令。命中越稳，平均点击耗时和节奏波动越有参考价值。";
  beginRound();
  rhythmArena.focus();
}

function beginRound() {
  if (!rhythmRun) {
    return;
  }
  rhythmRound = {
    startedAt: performance.now(),
    hits: 0,
    misses: 0,
    acquireTimes: [],
  };
  spawnRhythmTarget();
  updateRhythmMetrics();
}

function spawnRhythmTarget() {
  clearRhythmTarget();
  const point = rhythmTargetPoint();
  rhythmRound.target = point;
  rhythmRound.targetBornAt = performance.now();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rhythm-target";
  button.ariaLabel = "点击当前目标";
  button.innerHTML = "<span></span>";
  button.style.setProperty("--target-size", `${rhythmRun.settings.targetSize}px`);
  button.style.left = `${point.x}px`;
  button.style.top = `${point.y}px`;
  rhythmTargetLayer.append(button);
}

function rhythmTargetPoint() {
  const bounds = rhythmBounds();
  return {
    x: randomBetween(bounds.minX, bounds.maxX),
    y: randomBetween(bounds.minY, bounds.maxY),
  };
}

function rhythmBounds() {
  const rect = rhythmArena.getBoundingClientRect();
  const padding = rhythmRun.settings.targetSize + 28;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const width = Math.max(rhythmRun.settings.targetSize * 3, (rect.width - padding * 2) * rhythmRun.settings.spawnRange);
  const height = Math.max(rhythmRun.settings.targetSize * 3, (rect.height - padding * 2) * rhythmRun.settings.spawnRange);
  return {
    minX: Math.max(padding, centerX - width / 2),
    maxX: Math.min(rect.width - padding, centerX + width / 2),
    minY: Math.max(padding, centerY - height / 2),
    maxY: Math.min(rect.height - padding, centerY + height / 2),
  };
}

function hitRhythmTarget(event) {
  if (!rhythmRun || !rhythmRound) {
    return;
  }
  event.stopPropagation();
  const elapsed = performance.now() - rhythmRound.targetBornAt;
  rhythmRound.hits += 1;
  rhythmRun.hits += 1;
  rhythmRound.acquireTimes.push(elapsed);
  rhythmRun.acquireTimes.push(elapsed);
  if (rhythmRun.settings.showPulse) {
    showRhythmPulse(rhythmRound.target);
  }
  if (rhythmRun.settings.hitSound) {
    playRhythmHitSound();
  }
  if (rhythmRound.hits >= rhythmRun.settings.chainLength) {
    finishRound();
    return;
  }
  spawnRhythmTarget();
  updateRhythmMetrics();
}

function missRhythmTarget(event) {
  if (!rhythmRun || !rhythmRound || event.target.closest(".rhythm-target")) {
    return;
  }
  rhythmRound.misses += 1;
  rhythmRun.misses += 1;
  updateRhythmMetrics();
}

function finishRound() {
  clearRhythmTarget();
  const completed = {
    ...rhythmRound,
    totalTime: performance.now() - rhythmRound.startedAt,
    averageAcquire: average(rhythmRound.acquireTimes),
    rhythmSpread: standardDeviation(rhythmRound.acquireTimes),
  };
  rhythmRun.rounds.push(completed);
  showRound(completed);
  rhythmRound = null;
  updateRhythmMetrics();
  if (rhythmRun.rounds.length >= rhythmRun.settings.rounds) {
    finishRhythm(true);
    return;
  }
  rhythmRoundTimer = window.setTimeout(() => {
    rhythmRoundTimer = 0;
    beginRound();
  }, 420);
}

function finishRhythm(store) {
  if (!rhythmRun) {
    return;
  }
  window.clearTimeout(rhythmRoundTimer);
  rhythmRoundTimer = 0;
  const completedRun = rhythmRun;
  rhythmRun = null;
  rhythmRound = null;
  clearRhythmTarget();
  rhythmState.textContent = "待开始";
  rhythmMessage.hidden = false;
  if (!store || !completedRun.rounds.length) {
    syncRhythmOutputs();
    return;
  }
  const summary = summarizeRhythm(completedRun);
  rhythmHistory.unshift(summary);
  rhythmHistory = rhythmHistory.slice(0, 8);
  saveRhythmHistory();
  renderRhythmHistory();
  rhythmSummary.textContent = diagnosisForRhythm(summary);
}

function summarizeRhythm(completedRun) {
  const attempts = completedRun.hits + completedRun.misses;
  return {
    ...completedRun.settings,
    roundsCompleted: completedRun.rounds.length,
    hits: completedRun.hits,
    misses: completedRun.misses,
    hitRate: attempts ? completedRun.hits / attempts : 0,
    averageAcquire: average(completedRun.acquireTimes),
    averageRoundTime: average(completedRun.rounds.map((round) => round.totalTime)),
    rhythmSpread: average(completedRun.rounds.map((round) => round.rhythmSpread)),
    createdAt: Date.now(),
  };
}

function diagnosisForRhythm(summary) {
  if (summary.hitRate < 0.82) {
    return `命中率 ${formatPercent(summary.hitRate)}。先稳住落点，再追速度；当前平均点击 ${formatMs(summary.averageAcquire)}。`;
  }
  if (summary.rhythmSpread > summary.averageAcquire * 0.34) {
    return `命中率 ${formatPercent(summary.hitRate)}，但节奏波动 ${formatMs(summary.rhythmSpread)}。连续指令还不够均匀。`;
  }
  return `连续指令较稳：命中率 ${formatPercent(summary.hitRate)}，平均点击 ${formatMs(summary.averageAcquire)}，节奏波动 ${formatMs(summary.rhythmSpread)}。`;
}

function updateRhythmMetrics() {
  const settings = rhythmRun?.settings ?? rhythmSettings();
  const roundCount = rhythmRun?.rounds.length ?? 0;
  const currentHits = rhythmRound?.hits ?? 0;
  const attempts = rhythmRun ? rhythmRun.hits + rhythmRun.misses : 0;
  roundMetric.textContent = `${roundCount} / ${settings.rounds}`;
  chainMetric.textContent = `${currentHits} / ${settings.chainLength}`;
  hitMetric.textContent = attempts ? formatPercent(rhythmRun.hits / attempts) : "--";
  acquireMetric.textContent = rhythmRun?.acquireTimes.length ? formatMs(average(rhythmRun.acquireTimes)) : "--";
  rhythmMetric.textContent = rhythmRun?.rounds.length
    ? formatMs(average(rhythmRun.rounds.map((round) => round.rhythmSpread)))
    : "--";
}

function showRound(round) {
  roundTimeValue.textContent = formatMs(round.totalTime);
  roundAverageValue.textContent = formatMs(round.averageAcquire);
  roundMissValue.textContent = String(round.misses);
  roundSpreadValue.textContent = formatMs(round.rhythmSpread);
}

function renderRhythmHistory() {
  rhythmHistoryList.innerHTML = "";
  if (!rhythmHistory.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "还没有训练记录。";
    rhythmHistoryList.append(empty);
    return;
  }
  rhythmHistory.forEach((summary) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = `${summary.roundsCompleted} 轮 · 每轮 ${summary.chainLength} 指令`;
    detail.textContent = `命中 ${formatPercent(summary.hitRate)} · 平均点击 ${formatMs(summary.averageAcquire)} · 平均轮时 ${formatMs(summary.averageRoundTime)} · 节奏波动 ${formatMs(summary.rhythmSpread)}`;
    item.append(title, detail);
    rhythmHistoryList.append(item);
  });
}

function showRhythmPulse(point) {
  rhythmPulse.style.left = `${point.x}px`;
  rhythmPulse.style.top = `${point.y}px`;
  rhythmPulse.hidden = false;
  rhythmPulse.getAnimations().forEach((animation) => animation.cancel());
  const pulseAnimation = rhythmPulse.animate(
    [
      { width: "18px", height: "18px", opacity: 1 },
      { width: "54px", height: "54px", opacity: 0 },
    ],
    { duration: 280, easing: "ease-out" },
  );
  pulseAnimation.finished.then(() => {
    rhythmPulse.hidden = true;
  }).catch(() => {});
}

function playRhythmHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  rhythmAudioContext ??= new AudioContext();
  rhythmAudioContext.resume().catch(() => {});

  const startAt = rhythmAudioContext.currentTime;
  const oscillator = rhythmAudioContext.createOscillator();
  const gain = rhythmAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(rhythmAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

function clearRhythmTarget() {
  rhythmTargetLayer.innerHTML = "";
}

async function toggleRhythmFullscreen() {
  if (document.fullscreenElement === rhythmArena) {
    await document.exitFullscreen();
    return;
  }
  await rhythmArena.requestFullscreen();
}

function syncRhythmFullscreen() {
  const fullscreen = document.fullscreenElement === rhythmArena;
  rhythmFullscreenButton.classList.toggle("is-active", fullscreen);
  rhythmFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  rhythmFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function formatMs(value) {
  return value ? `${Math.round(value)}ms` : "--";
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

rhythmStartButton.addEventListener("click", startRhythm);
rhythmStopButton.addEventListener("click", () => finishRhythm(true));
rhythmFullscreenButton.addEventListener("click", () => {
  toggleRhythmFullscreen().catch(() => {
    rhythmSummary.textContent = "浏览器没有允许全屏。再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
rhythmTargetLayer.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".rhythm-target")) {
    hitRhythmTarget(event);
  }
});
rhythmArena.addEventListener("pointerdown", missRhythmTarget);
clearRhythmHistoryButton.addEventListener("click", () => {
  rhythmHistory = [];
  saveRhythmHistory();
  renderRhythmHistory();
});
[roundsInput, chainInput, rhythmSizeInput, rhythmRangeInput].forEach((input) => {
  input.addEventListener("input", syncRhythmOutputs);
});
document.addEventListener("fullscreenchange", syncRhythmFullscreen);

syncRhythmOutputs();
updateRhythmMetrics();
syncRhythmFullscreen();
renderRhythmHistory();
