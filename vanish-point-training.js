const vanishArena = document.querySelector("#vanishArena");
const vanishTargetLayer = document.querySelector("#vanishTargetLayer");
const vanishMessage = document.querySelector("#vanishMessage");
const vanishStartButton = document.querySelector("#vanishStartButton");
const vanishChallengeButton = document.querySelector("#vanishChallengeButton");
const vanishStopButton = document.querySelector("#vanishStopButton");
const vanishFullscreenButton = document.querySelector("#vanishFullscreenButton");
const vanishSizeInput = document.querySelector("#vanishSizeInput");
const lifetimeInput = document.querySelector("#lifetimeInput");
const gapInput = document.querySelector("#gapInput");
const failLimitInput = document.querySelector("#failLimitInput");
const vanishClickButtonInput = document.querySelector("#vanishClickButtonInput");
const vanishHitSoundInput = document.querySelector("#vanishHitSoundInput");
const vanishSizeOutput = document.querySelector("#vanishSizeOutput");
const lifetimeOutput = document.querySelector("#lifetimeOutput");
const gapOutput = document.querySelector("#gapOutput");
const failLimitOutput = document.querySelector("#failLimitOutput");
const vanishState = document.querySelector("#vanishState");
const vanishHitMetric = document.querySelector("#vanishHitMetric");
const vanishExpiredMetric = document.querySelector("#vanishExpiredMetric");
const vanishAccuracyMetric = document.querySelector("#vanishAccuracyMetric");
const vanishAverageMetric = document.querySelector("#vanishAverageMetric");
const vanishTempoMetric = document.querySelector("#vanishTempoMetric");
const vanishResultHits = document.querySelector("#vanishResultHits");
const vanishResultExpired = document.querySelector("#vanishResultExpired");
const vanishResultMisses = document.querySelector("#vanishResultMisses");
const vanishResultAverage = document.querySelector("#vanishResultAverage");
const vanishBestRecord = document.querySelector("#vanishBestRecord");
const vanishSummary = document.querySelector("#vanishSummary");
const VANISH_CHALLENGE_RECORD_KEY = "vanish-point";

let vanishRun = null;
let vanishSpawnTimer = 0;
let vanishTargetSequence = 0;
let vanishAudioContext = null;

function vanishSettings() {
  return {
    targetSize: Number(vanishSizeInput.value),
    lifetimeMs: Number(lifetimeInput.value),
    gapMs: Number(gapInput.value),
    failLimit: Number(failLimitInput.value),
    clickButton: window.trainingClickButtons.mode(vanishClickButtonInput),
    hitSound: vanishHitSoundInput.checked,
  };
}

function syncVanishOutputs() {
  vanishSizeOutput.textContent = `${vanishSizeInput.value}px`;
  lifetimeOutput.textContent = `${lifetimeInput.value}ms`;
  gapOutput.textContent = `${gapInput.value}ms`;
  failLimitOutput.textContent = failLimitInput.value;
}

function startVanishTraining(mode = "free") {
  finishVanishTraining(false);
  vanishRun = {
    settings: vanishSettings(),
    mode,
    startedAt: performance.now(),
    failed: false,
    hits: 0,
    misses: 0,
    expired: 0,
    hitTimes: [],
    targets: new Map(),
  };
  vanishState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  vanishMessage.hidden = true;
  vanishSummary.textContent = mode === "challenge"
    ? "挑战开始：前 60 秒持续加速，接着稳速 30 秒；漏掉超过上限即失败。"
    : "自由训练中。目标窗口和刷靶间隔由当前设置控制。";
  updateVanishMetrics();
  spawnVanishTarget();
  scheduleVanishTarget();
  vanishArena.focus();
}

function spawnVanishTarget() {
  if (!vanishRun) {
    return;
  }
  const point = vanishPoint();
  const timing = currentVanishTiming();
  const id = `vanish-${vanishTargetSequence += 1}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vanish-target";
  button.dataset.targetId = id;
  button.ariaLabel = "点击消失目标";
  button.innerHTML = "<span></span>";
  button.style.setProperty("--target-size", `${vanishRun.settings.targetSize}px`);
  button.style.setProperty("--life", `${timing.lifetimeMs}ms`);
  button.style.left = `${point.x}px`;
  button.style.top = `${point.y}px`;
  const target = {
    bornAt: performance.now(),
    element: button,
    expireTimer: 0,
  };
  vanishRun.targets.set(id, target);
  vanishTargetLayer.append(button);
  target.expireTimer = window.setTimeout(() => expireVanishTarget(id), timing.lifetimeMs);
  updateVanishMetrics();
}

function scheduleVanishTarget() {
  if (!vanishRun) {
    return;
  }
  vanishSpawnTimer = window.setTimeout(() => {
    spawnVanishTarget();
    scheduleVanishTarget();
  }, Math.max(20, currentVanishTiming().gapMs));
}

function vanishPoint() {
  const rect = vanishArena.getBoundingClientRect();
  const padding = vanishRun.settings.targetSize + 28;
  return {
    x: randomVanishBetween(padding, Math.max(padding, rect.width - padding)),
    y: randomVanishBetween(padding, Math.max(padding, rect.height - padding)),
  };
}

function hitVanishTarget(event) {
  const targetElement = event.target.closest(".vanish-target");
  if (!vanishRun || !targetElement || !window.trainingClickButtons.accepts(event, vanishRun.settings.clickButton)) {
    return;
  }
  const target = vanishRun.targets.get(targetElement.dataset.targetId);
  if (!target) {
    return;
  }
  event.stopPropagation();
  vanishRun.hits += 1;
  vanishRun.hitTimes.push(performance.now() - target.bornAt);
  removeVanishTarget(targetElement.dataset.targetId);
  if (vanishRun.settings.hitSound) {
    playVanishHitSound();
  }
  updateVanishMetrics();
}

function expireVanishTarget(id) {
  if (!vanishRun || !vanishRun.targets.has(id)) {
    return;
  }
  vanishRun.expired += 1;
  removeVanishTarget(id);
  updateVanishMetrics();
  if (vanishRun.mode === "challenge" && vanishRun.expired > vanishRun.settings.failLimit) {
    vanishRun.failed = true;
    finishVanishTraining(true);
  }
}

function removeVanishTarget(id) {
  if (!vanishRun) {
    return;
  }
  const target = vanishRun.targets.get(id);
  if (!target) {
    return;
  }
  window.clearTimeout(target.expireTimer);
  target.element.remove();
  vanishRun.targets.delete(id);
}

function missVanishTarget(event) {
  if (!vanishRun || event.target.closest(".vanish-target") || !window.trainingClickButtons.accepts(event, vanishRun.settings.clickButton)) {
    return;
  }
  vanishRun.misses += 1;
  updateVanishMetrics();
}

function finishVanishTraining(showResult) {
  if (!vanishRun) {
    return;
  }
  const completedRun = vanishRun;
  vanishRun = null;
  window.clearTimeout(vanishSpawnTimer);
  vanishSpawnTimer = 0;
  completedRun.targets.forEach((target) => window.clearTimeout(target.expireTimer));
  completedRun.targets.clear();
  completedRun.finishedAt = performance.now();
  vanishTargetLayer.innerHTML = "";
  vanishState.textContent = "待开始";
  vanishMessage.hidden = false;
  if (!showResult) {
    updateVanishMetrics();
    return;
  }
  showVanishResult(completedRun);
  updateVanishMetrics(completedRun);
}

function showVanishResult(run) {
  vanishResultHits.textContent = String(run.hits);
  vanishResultExpired.textContent = String(run.expired);
  vanishResultMisses.textContent = String(run.misses);
  vanishResultAverage.textContent = run.hitTimes.length ? formatVanishMs(averageVanish(run.hitTimes)) : "--";
  if (run.mode === "challenge") {
    keepVanishChallengeRecord(run);
  }
  vanishSummary.textContent = vanishDiagnosis(run);
}

function keepVanishChallengeRecord(run) {
  const result = window.challengeRecords.keepBetter(VANISH_CHALLENGE_RECORD_KEY, {
    durationMs: elapsedVanishTime(run),
    hits: run.hits,
    expired: run.expired,
    misses: run.misses,
    failed: run.failed,
    settings: run.settings,
  }, betterVanishRecord);
  renderVanishChallengeRecord(result.record, result.improved);
}

function betterVanishRecord(candidate, current) {
  if (candidate.durationMs !== current.durationMs) return candidate.durationMs > current.durationMs;
  if (candidate.hits !== current.hits) return candidate.hits > current.hits;
  return candidate.expired < current.expired;
}

function renderVanishChallengeRecord(record = window.challengeRecords.get(VANISH_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    vanishBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  vanishBestRecord.textContent = `${prefix}：坚持 ${formatVanishSeconds(record.durationMs)} · 命中 ${record.hits} 个 · 漏掉 ${record.expired} 个`;
}

function vanishDiagnosis(run) {
  if (run.mode === "challenge") {
    const duration = formatVanishSeconds(elapsedVanishTime(run));
    if (run.failed) {
      return `挑战失败：坚持 ${duration}，命中 ${run.hits} 个，漏掉 ${run.expired} 个，超过上限 ${run.settings.failLimit}。`;
    }
    return `挑战结束：坚持 ${duration}，命中 ${run.hits} 个，漏掉 ${run.expired} 个。`;
  }
  if (!run.hits) {
    return `这组还没有命中。当前目标窗口 ${run.settings.lifetimeMs}ms，先放慢存在时长再找准节奏。`;
  }
  if (run.expired > run.hits) {
    return `命中 ${run.hits} 个，漏掉 ${run.expired} 个。窗口期偏紧时，先看漏掉数是否快速下降。`;
  }
  return `命中 ${run.hits} 个，平均命中 ${formatVanishMs(averageVanish(run.hitTimes))}，当前窗口期抓取较稳。`;
}

function updateVanishMetrics(completedRun = null) {
  const run = vanishRun ?? completedRun;
  if (!run) {
    vanishHitMetric.textContent = "0";
    vanishExpiredMetric.textContent = "0";
    vanishAccuracyMetric.textContent = "--";
    vanishAverageMetric.textContent = "--";
    vanishTempoMetric.textContent = "自由";
    return;
  }
  const clicks = run.hits + run.misses;
  vanishHitMetric.textContent = String(run.hits);
  vanishExpiredMetric.textContent = String(run.expired);
  vanishAccuracyMetric.textContent = clicks ? formatVanishPercent(run.hits / clicks) : "--";
  vanishAverageMetric.textContent = run.hitTimes.length ? formatVanishMs(averageVanish(run.hitTimes)) : "--";
  const timing = currentVanishTiming(run);
  vanishTempoMetric.textContent = run.mode === "challenge"
    ? `${formatVanishMs(timing.lifetimeMs)} / ${formatVanishMs(timing.gapMs)}`
    : "自由";
}

function currentVanishTiming(run = vanishRun) {
  if (!run || run.mode !== "challenge") {
    return {
      lifetimeMs: run?.settings.lifetimeMs ?? Number(lifetimeInput.value),
      gapMs: run?.settings.gapMs ?? Number(gapInput.value),
    };
  }
  const elapsed = elapsedVanishTime(run);
  if (elapsed <= 60000) {
    const progress = elapsed / 60000;
    return {
      lifetimeMs: Math.round(lerpVanish(3600, 1000, progress)),
      gapMs: Math.round(lerpVanish(800, 200, progress)),
    };
  }
  if (elapsed <= 90000) {
    return { lifetimeMs: 1000, gapMs: 200 };
  }
  const overtime = elapsed - 90000;
  return {
    lifetimeMs: Math.max(400, Math.round(1000 - overtime * (2600 / 60000))),
    gapMs: Math.max(70, Math.round(200 - overtime * (600 / 60000))),
  };
}

function elapsedVanishTime(run) {
  return Math.max(0, (run.finishedAt ?? performance.now()) - run.startedAt);
}

function lerpVanish(start, end, progress) {
  return start + (end - start) * Math.min(1, Math.max(0, progress));
}

function playVanishHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  vanishAudioContext ??= new AudioContext();
  vanishAudioContext.resume().catch(() => {});

  const startAt = vanishAudioContext.currentTime;
  const oscillator = vanishAudioContext.createOscillator();
  const gain = vanishAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(vanishAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

async function toggleVanishFullscreen() {
  if (document.fullscreenElement === vanishArena) {
    await document.exitFullscreen();
    return;
  }
  await vanishArena.requestFullscreen();
}

function syncVanishFullscreen() {
  const fullscreen = document.fullscreenElement === vanishArena;
  vanishFullscreenButton.classList.toggle("is-active", fullscreen);
  vanishFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  vanishFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function averageVanish(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatVanishMs(value) {
  return value ? `${Math.round(value)}ms` : "--";
}

function formatVanishPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatVanishSeconds(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

function randomVanishBetween(min, max) {
  return Math.random() * (max - min) + min;
}

vanishStartButton.addEventListener("click", () => startVanishTraining("free"));
vanishChallengeButton.addEventListener("click", () => startVanishTraining("challenge"));
vanishStopButton.addEventListener("click", () => finishVanishTraining(true));
vanishFullscreenButton.addEventListener("click", () => {
  toggleVanishFullscreen().catch(() => {
    vanishSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
vanishTargetLayer.addEventListener("pointerdown", hitVanishTarget);
vanishArena.addEventListener("pointerdown", missVanishTarget);
[vanishSizeInput, lifetimeInput, gapInput, failLimitInput].forEach((input) => {
  input.addEventListener("input", syncVanishOutputs);
});
document.addEventListener("fullscreenchange", syncVanishFullscreen);
window.trainingClickButtons.suppressContextMenu(vanishArena);

syncVanishOutputs();
updateVanishMetrics();
syncVanishFullscreen();
renderVanishChallengeRecord();
