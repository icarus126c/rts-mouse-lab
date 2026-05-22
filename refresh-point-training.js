const refreshArena = document.querySelector("#refreshArena");
const refreshTargetLayer = document.querySelector("#refreshTargetLayer");
const refreshMessage = document.querySelector("#refreshMessage");
const refreshStartButton = document.querySelector("#refreshStartButton");
const refreshChallengeButton = document.querySelector("#refreshChallengeButton");
const refreshStopButton = document.querySelector("#refreshStopButton");
const refreshFullscreenButton = document.querySelector("#refreshFullscreenButton");
const durationInput = document.querySelector("#durationInput");
const refreshSizeInput = document.querySelector("#refreshSizeInput");
const targetCountInput = document.querySelector("#targetCountInput");
const refreshRangeInput = document.querySelector("#refreshRangeInput");
const scatterInput = document.querySelector("#scatterInput");
const refreshHitSoundInput = document.querySelector("#refreshHitSoundInput");
const durationOutput = document.querySelector("#durationOutput");
const refreshSizeOutput = document.querySelector("#refreshSizeOutput");
const targetCountOutput = document.querySelector("#targetCountOutput");
const refreshRangeOutput = document.querySelector("#refreshRangeOutput");
const scatterOutput = document.querySelector("#scatterOutput");
const refreshState = document.querySelector("#refreshState");
const refreshTimeMetric = document.querySelector("#refreshTimeMetric");
const refreshAccuracyMetric = document.querySelector("#refreshAccuracyMetric");
const refreshAverageMetric = document.querySelector("#refreshAverageMetric");
const refreshHitMetric = document.querySelector("#refreshHitMetric");
const refreshResultHits = document.querySelector("#refreshResultHits");
const refreshResultMisses = document.querySelector("#refreshResultMisses");
const refreshResultAccuracy = document.querySelector("#refreshResultAccuracy");
const refreshResultAverage = document.querySelector("#refreshResultAverage");
const refreshResultRate = document.querySelector("#refreshResultRate");
const refreshBestRecord = document.querySelector("#refreshBestRecord");
const refreshSummary = document.querySelector("#refreshSummary");
const REFRESH_CHALLENGE_RECORD_KEY = "refresh-point";

let refreshRun = null;
let refreshFrame = 0;
let refreshTargetSequence = 0;
let refreshAudioContext = null;

function refreshSettings() {
  return {
    durationMs: Number(durationInput.value) * 1000,
    targetSize: Number(refreshSizeInput.value),
    targetCount: Number(targetCountInput.value),
    spawnRange: Number(refreshRangeInput.value) / 100,
    scatter: Number(scatterInput.value),
    hitSound: refreshHitSoundInput.checked,
  };
}

function syncRefreshOutputs() {
  durationOutput.textContent = `${durationInput.value}秒`;
  refreshSizeOutput.textContent = `${refreshSizeInput.value}px`;
  targetCountOutput.textContent = targetCountInput.value;
  refreshRangeOutput.textContent = `${refreshRangeInput.value}%`;
  scatterOutput.textContent = `${scatterInput.value}x`;
  if (!refreshRun) {
    refreshTimeMetric.textContent = formatRefreshSeconds(Number(durationInput.value) * 1000);
  }
}

function startRefreshTraining(mode = "free") {
  finishRefreshTraining(false);
  const settings = refreshSettings();
  if (mode === "challenge") {
    settings.durationMs = 30000;
  }
  const startedAt = performance.now();
  refreshRun = {
    settings,
    mode,
    startedAt,
    endsAt: startedAt + settings.durationMs,
    hits: 0,
    misses: 0,
    targets: new Map(),
  };
  refreshState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  refreshMessage.hidden = true;
  refreshSummary.textContent = mode === "challenge"
    ? "30 秒挑战中。尽量多清刷新点，同时稳住准确率。"
    : "自由训练中。目标数量、范围和分散度会共同改变点击节奏。";
  clearRefreshTargets();
  refillRefreshTargets();
  updateRefreshMetrics();
  tickRefreshTraining();
  refreshArena.focus();
}

function tickRefreshTraining() {
  if (!refreshRun) {
    return;
  }
  if (remainingRefreshTime() <= 0) {
    finishRefreshTraining(true);
    return;
  }
  updateRefreshMetrics();
  refreshFrame = window.requestAnimationFrame(tickRefreshTraining);
}

function remainingRefreshTime() {
  return Math.max(0, refreshRun.endsAt - performance.now());
}

function refillRefreshTargets() {
  while (refreshRun && refreshRun.targets.size < refreshRun.settings.targetCount) {
    spawnRefreshTarget();
  }
}

function spawnRefreshTarget() {
  const point = refreshTargetPoint();
  const id = `refresh-${refreshTargetSequence += 1}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "refresh-target";
  button.dataset.targetId = id;
  button.ariaLabel = "点击刷新目标";
  button.innerHTML = "<span></span>";
  button.style.setProperty("--target-size", `${refreshRun.settings.targetSize}px`);
  button.style.left = `${point.x}px`;
  button.style.top = `${point.y}px`;
  refreshRun.targets.set(id, {
    element: button,
    x: point.x,
    y: point.y,
  });
  refreshTargetLayer.append(button);
}

function refreshTargetPoint() {
  const bounds = refreshTargetBounds();
  const candidates = Array.from({ length: 40 }, () => randomRefreshPoint(bounds));
  const existingTargets = [...refreshRun.targets.values()];
  const minimumDistance = refreshRun.settings.targetSize * refreshRun.settings.scatter;
  if (!existingTargets.length || !minimumDistance) {
    return candidates[0];
  }
  const clearPoint = candidates.find((point) => minimumRefreshDistance(point, existingTargets) >= minimumDistance);
  return clearPoint ?? candidates.reduce((best, point) => {
    return minimumRefreshDistance(point, existingTargets) > minimumRefreshDistance(best, existingTargets) ? point : best;
  });
}

function refreshTargetBounds() {
  const rect = refreshArena.getBoundingClientRect();
  const padding = refreshRun.settings.targetSize + 24;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const availableWidth = Math.max(refreshRun.settings.targetSize * 2, rect.width - padding * 2);
  const availableHeight = Math.max(refreshRun.settings.targetSize * 2, rect.height - padding * 2);
  const width = availableWidth * refreshRun.settings.spawnRange;
  const height = availableHeight * refreshRun.settings.spawnRange;
  return {
    minX: Math.max(padding, centerX - width / 2),
    maxX: Math.min(rect.width - padding, centerX + width / 2),
    minY: Math.max(padding, centerY - height / 2),
    maxY: Math.min(rect.height - padding, centerY + height / 2),
  };
}

function randomRefreshPoint(bounds) {
  return {
    x: randomRefreshBetween(bounds.minX, bounds.maxX),
    y: randomRefreshBetween(bounds.minY, bounds.maxY),
  };
}

function minimumRefreshDistance(point, existingTargets) {
  return Math.min(...existingTargets.map((target) => Math.hypot(point.x - target.x, point.y - target.y)));
}

function hitRefreshTarget(event) {
  const target = event.target.closest(".refresh-target");
  if (!refreshRun || !target) {
    return;
  }
  event.stopPropagation();
  const record = refreshRun.targets.get(target.dataset.targetId);
  if (!record) {
    return;
  }
  refreshRun.hits += 1;
  refreshRun.targets.delete(target.dataset.targetId);
  target.remove();
  if (refreshRun.settings.hitSound) {
    playRefreshHitSound();
  }
  refillRefreshTargets();
  updateRefreshMetrics();
}

function missRefreshTarget(event) {
  if (!refreshRun || event.target.closest(".refresh-target")) {
    return;
  }
  refreshRun.misses += 1;
  updateRefreshMetrics();
}

function finishRefreshTraining(showResult) {
  if (!refreshRun) {
    return;
  }
  window.cancelAnimationFrame(refreshFrame);
  refreshFrame = 0;
  const completedRun = refreshRun;
  completedRun.finishedAt = performance.now();
  refreshRun = null;
  clearRefreshTargets();
  refreshState.textContent = "待开始";
  refreshMessage.hidden = false;
  if (!showResult) {
    updateRefreshMetrics();
    syncRefreshOutputs();
    return;
  }
  showRefreshResult(completedRun);
  updateRefreshMetrics(completedRun);
}

function showRefreshResult(run) {
  const attempts = run.hits + run.misses;
  const accuracy = attempts ? run.hits / attempts : 0;
  const averageTime = averageRefreshHitTime(run);
  refreshResultHits.textContent = String(run.hits);
  refreshResultMisses.textContent = String(run.misses);
  refreshResultAccuracy.textContent = formatRefreshPercent(accuracy);
  refreshResultAverage.textContent = formatRefreshMs(averageTime);
  refreshResultRate.textContent = run.mode === "challenge" ? formatRefreshRate(correctRefreshRate(run)) : "--";
  if (run.mode === "challenge") {
    keepRefreshChallengeRecord(run, accuracy, averageTime);
  }
  refreshSummary.textContent = refreshDiagnosis(run.hits, accuracy, averageTime, run);
}

function keepRefreshChallengeRecord(run, accuracy, averageTime) {
  const result = window.challengeRecords.keepBetter(REFRESH_CHALLENGE_RECORD_KEY, {
    hits: run.hits,
    misses: run.misses,
    accuracy,
    averageTime,
    rate: correctRefreshRate(run),
    settings: run.settings,
  }, betterRefreshRecord);
  renderRefreshChallengeRecord(result.record, result.improved);
}

function betterRefreshRecord(candidate, current) {
  if (candidate.hits !== current.hits) return candidate.hits > current.hits;
  if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
  return candidate.averageTime < current.averageTime;
}

function renderRefreshChallengeRecord(record = window.challengeRecords.get(REFRESH_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    refreshBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  refreshBestRecord.textContent = `${prefix}：命中 ${record.hits} 个 · 准确率 ${formatRefreshPercent(record.accuracy)} · ${formatRefreshRate(record.rate)}`;
}

function refreshDiagnosis(hits, accuracy, averageTime, run) {
  if (run.mode === "challenge") {
    return `30 秒挑战完成：命中 ${hits} 个，准确率 ${formatRefreshPercent(accuracy)}，正确点击速 ${formatRefreshRate(correctRefreshRate(run))}。`;
  }
  if (!hits) {
    return "这组还没有命中目标。先把目标尺寸调大一些，再确认点击区域和鼠标设置。";
  }
  if (accuracy < 0.8) {
    return `这段时间点中 ${hits} 个，准确率 ${formatRefreshPercent(accuracy)}。当前更值得先压住空点。`;
  }
  return `这段时间点中 ${hits} 个，准确率 ${formatRefreshPercent(accuracy)}，平均命中时长 ${formatRefreshMs(averageTime)}。`;
}

function updateRefreshMetrics(completedRun = null) {
  const run = refreshRun ?? completedRun;
  if (!run) {
    refreshAccuracyMetric.textContent = "--";
    refreshAverageMetric.textContent = "--";
    refreshHitMetric.textContent = "0";
    return;
  }
  const attempts = run.hits + run.misses;
  refreshTimeMetric.textContent = refreshRun ? formatRefreshSeconds(remainingRefreshTime()) : "0.0s";
  refreshAccuracyMetric.textContent = attempts ? formatRefreshPercent(run.hits / attempts) : "--";
  refreshAverageMetric.textContent = run.hits ? formatRefreshMs(averageRefreshHitTime(run)) : "--";
  refreshHitMetric.textContent = String(run.hits);
}

function clearRefreshTargets() {
  refreshTargetLayer.innerHTML = "";
  refreshRun?.targets.clear();
}

function playRefreshHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  refreshAudioContext ??= new AudioContext();
  refreshAudioContext.resume().catch(() => {});

  const startAt = refreshAudioContext.currentTime;
  const oscillator = refreshAudioContext.createOscillator();
  const gain = refreshAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(refreshAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

async function toggleRefreshFullscreen() {
  if (document.fullscreenElement === refreshArena) {
    await document.exitFullscreen();
    return;
  }
  await refreshArena.requestFullscreen();
}

function syncRefreshFullscreen() {
  const fullscreen = document.fullscreenElement === refreshArena;
  refreshFullscreenButton.classList.toggle("is-active", fullscreen);
  refreshFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  refreshFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function averageRefreshHitTime(run) {
  return run.hits ? elapsedRefreshTime(run) / run.hits : 0;
}

function elapsedRefreshTime(run) {
  const endAt = run.finishedAt ?? performance.now();
  return Math.min(run.settings.durationMs, Math.max(0, endAt - run.startedAt));
}

function correctRefreshRate(run) {
  return run.hits / Math.max(0.001, elapsedRefreshTime(run) / 1000);
}

function formatRefreshMs(value) {
  return value ? `${Math.round(value)}ms` : "--";
}

function formatRefreshPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatRefreshSeconds(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

function formatRefreshRate(value) {
  return `${value.toFixed(2)}/s`;
}

function randomRefreshBetween(min, max) {
  return Math.random() * (max - min) + min;
}

refreshStartButton.addEventListener("click", () => startRefreshTraining("free"));
refreshChallengeButton.addEventListener("click", () => startRefreshTraining("challenge"));
refreshStopButton.addEventListener("click", () => finishRefreshTraining(true));
refreshFullscreenButton.addEventListener("click", () => {
  toggleRefreshFullscreen().catch(() => {
    refreshSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
refreshTargetLayer.addEventListener("pointerdown", hitRefreshTarget);
refreshArena.addEventListener("pointerdown", missRefreshTarget);
[durationInput, refreshSizeInput, targetCountInput, refreshRangeInput, scatterInput].forEach((input) => {
  input.addEventListener("input", syncRefreshOutputs);
});
document.addEventListener("fullscreenchange", syncRefreshFullscreen);

syncRefreshOutputs();
updateRefreshMetrics();
syncRefreshFullscreen();
renderRefreshChallengeRecord();
