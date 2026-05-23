const movingArena = document.querySelector("#movingArena");
const movingTargetLayer = document.querySelector("#movingTargetLayer");
const movingMessage = document.querySelector("#movingMessage");
const movingStartButton = document.querySelector("#movingStartButton");
const movingChallengeButton = document.querySelector("#movingChallengeButton");
const movingStopButton = document.querySelector("#movingStopButton");
const movingFullscreenButton = document.querySelector("#movingFullscreenButton");
const movingSizeInput = document.querySelector("#movingSizeInput");
const movingCountInput = document.querySelector("#movingCountInput");
const moveRangeInput = document.querySelector("#moveRangeInput");
const movingAreaInput = document.querySelector("#movingAreaInput");
const movingSpeedInput = document.querySelector("#movingSpeedInput");
const movingClickButtonInput = document.querySelector("#movingClickButtonInput");
const movingHitSoundInput = document.querySelector("#movingHitSoundInput");
const movingSizeOutput = document.querySelector("#movingSizeOutput");
const movingCountOutput = document.querySelector("#movingCountOutput");
const moveRangeOutput = document.querySelector("#moveRangeOutput");
const movingAreaOutput = document.querySelector("#movingAreaOutput");
const movingSpeedOutput = document.querySelector("#movingSpeedOutput");
const movingState = document.querySelector("#movingState");
const movingHitMetric = document.querySelector("#movingHitMetric");
const movingAccuracyMetric = document.querySelector("#movingAccuracyMetric");
const movingAverageMetric = document.querySelector("#movingAverageMetric");
const movingActiveMetric = document.querySelector("#movingActiveMetric");
const movingTimeMetric = document.querySelector("#movingTimeMetric");
const movingResultHits = document.querySelector("#movingResultHits");
const movingResultMisses = document.querySelector("#movingResultMisses");
const movingResultAccuracy = document.querySelector("#movingResultAccuracy");
const movingResultAverage = document.querySelector("#movingResultAverage");
const movingResultRate = document.querySelector("#movingResultRate");
const movingBestRecord = document.querySelector("#movingBestRecord");
const movingSummary = document.querySelector("#movingSummary");
const MOVING_CHALLENGE_RECORD_KEY = "moving-target";

let movingRun = null;
let movingFrame = 0;
let movingTargetSequence = 0;
let movingAudioContext = null;

function movingSettings() {
  return {
    targetSize: Number(movingSizeInput.value),
    targetCount: Number(movingCountInput.value),
    moveRange: Number(moveRangeInput.value),
    spawnRange: Number(movingAreaInput.value) / 100,
    speed: Number(movingSpeedInput.value),
    clickButton: window.trainingClickButtons.mode(movingClickButtonInput),
    hitSound: movingHitSoundInput.checked,
  };
}

function syncMovingOutputs() {
  movingSizeOutput.textContent = `${movingSizeInput.value}px`;
  movingCountOutput.textContent = movingCountInput.value;
  moveRangeOutput.textContent = `${moveRangeInput.value}px`;
  movingAreaOutput.textContent = `${movingAreaInput.value}%`;
  movingSpeedOutput.textContent = `${movingSpeedInput.value}px/s`;
}

function startMovingTraining(mode = "free") {
  finishMovingTraining(false);
  const startedAt = performance.now();
  movingRun = {
    settings: movingSettings(),
    mode,
    startedAt,
    endsAt: mode === "challenge" ? startedAt + 30000 : 0,
    hits: 0,
    misses: 0,
    hitTimes: [],
    lastFrameAt: performance.now(),
    targets: new Map(),
  };
  movingState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  movingMessage.hidden = true;
  movingSummary.textContent = mode === "challenge"
    ? "30 秒挑战中。尽量提高命中数量，同时稳住准确率。"
    : "移动靶训练中。速度、移动范围和出现区域会共同决定追击难度。";
  refillMovingTargets();
  updateMovingMetrics();
  movingFrame = window.requestAnimationFrame(stepMovingTargets);
  movingArena.focus();
}

function refillMovingTargets() {
  while (movingRun && movingRun.targets.size < movingRun.settings.targetCount) {
    spawnMovingTarget();
  }
}

function spawnMovingTarget() {
  const bounds = movingSpawnBounds();
  const anchor = randomMovingPoint(bounds);
  const angle = Math.random() * Math.PI * 2;
  const id = `moving-${movingTargetSequence += 1}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "moving-target";
  button.dataset.targetId = id;
  button.ariaLabel = "点击移动目标";
  button.innerHTML = "<span></span>";
  button.style.setProperty("--target-size", `${movingRun.settings.targetSize}px`);
  button.style.left = `${anchor.x}px`;
  button.style.top = `${anchor.y}px`;
  movingRun.targets.set(id, {
    bornAt: performance.now(),
    anchorX: anchor.x,
    anchorY: anchor.y,
    x: anchor.x,
    y: anchor.y,
    vx: Math.cos(angle) * movingRun.settings.speed,
    vy: Math.sin(angle) * movingRun.settings.speed,
    element: button,
  });
  movingTargetLayer.append(button);
}

function movingSpawnBounds() {
  const rect = movingArena.getBoundingClientRect();
  const padding = movingRun.settings.targetSize + 28;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const width = Math.max(movingRun.settings.targetSize * 2, (rect.width - padding * 2) * movingRun.settings.spawnRange);
  const height = Math.max(movingRun.settings.targetSize * 2, (rect.height - padding * 2) * movingRun.settings.spawnRange);
  return {
    minX: Math.max(padding, centerX - width / 2),
    maxX: Math.min(rect.width - padding, centerX + width / 2),
    minY: Math.max(padding, centerY - height / 2),
    maxY: Math.min(rect.height - padding, centerY + height / 2),
  };
}

function stepMovingTargets(now) {
  if (!movingRun) {
    return;
  }
  if (movingRun.mode === "challenge" && now >= movingRun.endsAt) {
    finishMovingTraining(true);
    return;
  }
  const delta = Math.min(0.05, Math.max(0, now - movingRun.lastFrameAt) / 1000);
  movingRun.lastFrameAt = now;
  const arenaBounds = movingArenaBounds();
  movingRun.targets.forEach((target) => moveTarget(target, delta, arenaBounds));
  updateMovingMetrics();
  movingFrame = window.requestAnimationFrame(stepMovingTargets);
}

function moveTarget(target, delta, arenaBounds) {
  target.x += target.vx * delta;
  target.y += target.vy * delta;
  const offsetX = target.x - target.anchorX;
  const offsetY = target.y - target.anchorY;
  const offsetLength = Math.hypot(offsetX, offsetY);
  if (offsetLength > movingRun.settings.moveRange) {
    const normalX = offsetX / offsetLength;
    const normalY = offsetY / offsetLength;
    target.x = target.anchorX + normalX * movingRun.settings.moveRange;
    target.y = target.anchorY + normalY * movingRun.settings.moveRange;
    reflectMovingVelocity(target, normalX, normalY);
  }
  if (target.x < arenaBounds.minX || target.x > arenaBounds.maxX) {
    target.x = Math.min(arenaBounds.maxX, Math.max(arenaBounds.minX, target.x));
    target.vx *= -1;
  }
  if (target.y < arenaBounds.minY || target.y > arenaBounds.maxY) {
    target.y = Math.min(arenaBounds.maxY, Math.max(arenaBounds.minY, target.y));
    target.vy *= -1;
  }
  target.element.style.left = `${target.x}px`;
  target.element.style.top = `${target.y}px`;
}

function movingArenaBounds() {
  const rect = movingArena.getBoundingClientRect();
  const padding = movingRun.settings.targetSize / 2 + 8;
  return {
    minX: padding,
    maxX: rect.width - padding,
    minY: padding,
    maxY: rect.height - padding,
  };
}

function reflectMovingVelocity(target, normalX, normalY) {
  const dot = target.vx * normalX + target.vy * normalY;
  target.vx -= 2 * dot * normalX;
  target.vy -= 2 * dot * normalY;
}

function hitMovingTarget(event) {
  const targetElement = event.target.closest(".moving-target");
  if (!movingRun || !targetElement || !window.trainingClickButtons.accepts(event, movingRun.settings.clickButton)) {
    return;
  }
  const target = movingRun.targets.get(targetElement.dataset.targetId);
  if (!target) {
    return;
  }
  event.stopPropagation();
  movingRun.hits += 1;
  movingRun.hitTimes.push(performance.now() - target.bornAt);
  movingRun.targets.delete(targetElement.dataset.targetId);
  targetElement.remove();
  if (movingRun.settings.hitSound) {
    playMovingHitSound();
  }
  refillMovingTargets();
  updateMovingMetrics();
}

function missMovingTarget(event) {
  if (!movingRun || event.target.closest(".moving-target") || !window.trainingClickButtons.accepts(event, movingRun.settings.clickButton)) {
    return;
  }
  movingRun.misses += 1;
  updateMovingMetrics();
}

function finishMovingTraining(showResult) {
  if (!movingRun) {
    return;
  }
  const completedRun = movingRun;
  completedRun.finishedAt = performance.now();
  movingRun = null;
  window.cancelAnimationFrame(movingFrame);
  movingFrame = 0;
  movingTargetLayer.innerHTML = "";
  movingState.textContent = "待开始";
  movingMessage.hidden = false;
  if (!showResult) {
    updateMovingMetrics();
    return;
  }
  showMovingResult(completedRun);
  updateMovingMetrics(completedRun);
}

function showMovingResult(run) {
  const attempts = run.hits + run.misses;
  const accuracy = attempts ? run.hits / attempts : 0;
  const averageTime = averageMoving(run.hitTimes);
  movingResultHits.textContent = String(run.hits);
  movingResultMisses.textContent = String(run.misses);
  movingResultAccuracy.textContent = attempts ? formatMovingPercent(accuracy) : "--";
  movingResultAverage.textContent = run.hitTimes.length ? formatMovingMs(averageTime) : "--";
  movingResultRate.textContent = run.mode === "challenge" ? formatMovingRate(correctMovingRate(run)) : "--";
  if (run.mode === "challenge") {
    keepMovingChallengeRecord(run, accuracy, averageTime);
  }
  movingSummary.textContent = movingDiagnosis(run.hits, accuracy, averageTime, run);
}

function keepMovingChallengeRecord(run, accuracy, averageTime) {
  const result = window.challengeRecords.keepBetter(MOVING_CHALLENGE_RECORD_KEY, {
    hits: run.hits,
    misses: run.misses,
    accuracy,
    averageTime,
    rate: correctMovingRate(run),
    settings: run.settings,
  }, betterMovingRecord);
  renderMovingChallengeRecord(result.record, result.improved);
}

function betterMovingRecord(candidate, current) {
  if (candidate.hits !== current.hits) return candidate.hits > current.hits;
  if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
  return candidate.averageTime < current.averageTime;
}

function renderMovingChallengeRecord(record = window.challengeRecords.get(MOVING_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    movingBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  movingBestRecord.textContent = `${prefix}：命中 ${record.hits} 个 · 准确率 ${formatMovingPercent(record.accuracy)} · ${formatMovingRate(record.rate)}`;
}

function movingDiagnosis(hits, accuracy, averageTime, run) {
  if (run.mode === "challenge") {
    return `30 秒挑战完成：命中 ${hits} 个，准确率 ${formatMovingPercent(accuracy)}，正确点击速 ${formatMovingRate(correctMovingRate(run))}。`;
  }
  if (!hits) {
    return "这组还没有命中移动靶。先降低速度或移动范围，再确认追击节奏。";
  }
  if (accuracy < 0.8) {
    return `命中 ${hits} 个，准确率 ${formatMovingPercent(accuracy)}。当前更值得先减少追击中的空点。`;
  }
  return `命中 ${hits} 个，准确率 ${formatMovingPercent(accuracy)}，平均命中 ${formatMovingMs(averageTime)}。`;
}

function updateMovingMetrics(completedRun = null) {
  const run = movingRun ?? completedRun;
  if (!run) {
    movingHitMetric.textContent = "0";
    movingAccuracyMetric.textContent = "--";
    movingAverageMetric.textContent = "--";
    movingActiveMetric.textContent = "0";
    movingTimeMetric.textContent = "--";
    return;
  }
  const attempts = run.hits + run.misses;
  movingHitMetric.textContent = String(run.hits);
  movingAccuracyMetric.textContent = attempts ? formatMovingPercent(run.hits / attempts) : "--";
  movingAverageMetric.textContent = run.hitTimes.length ? formatMovingMs(averageMoving(run.hitTimes)) : "--";
  movingActiveMetric.textContent = movingRun ? String(run.targets.size) : "0";
  movingTimeMetric.textContent = movingRun?.mode === "challenge"
    ? formatMovingSeconds(Math.max(0, run.endsAt - performance.now()))
    : "--";
}

function playMovingHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  movingAudioContext ??= new AudioContext();
  movingAudioContext.resume().catch(() => {});

  const startAt = movingAudioContext.currentTime;
  const oscillator = movingAudioContext.createOscillator();
  const gain = movingAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(movingAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

function clearMovingTargets() {
  movingTargetLayer.innerHTML = "";
  movingRun?.targets.clear();
}

async function toggleMovingFullscreen() {
  if (document.fullscreenElement === movingArena) {
    await document.exitFullscreen();
    return;
  }
  await movingArena.requestFullscreen();
}

function syncMovingFullscreen() {
  const fullscreen = document.fullscreenElement === movingArena;
  movingFullscreenButton.classList.toggle("is-active", fullscreen);
  movingFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  movingFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function randomMovingPoint(bounds) {
  return {
    x: randomMovingBetween(bounds.minX, bounds.maxX),
    y: randomMovingBetween(bounds.minY, bounds.maxY),
  };
}

function averageMoving(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function correctMovingRate(run) {
  return run.hits / Math.max(0.001, elapsedMovingTime(run) / 1000);
}

function elapsedMovingTime(run) {
  const endAt = run.finishedAt ?? performance.now();
  const elapsed = Math.max(0, endAt - run.startedAt);
  return run.mode === "challenge" ? Math.min(30000, elapsed) : elapsed;
}

function formatMovingMs(value) {
  return value ? `${Math.round(value)}ms` : "--";
}

function formatMovingPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatMovingRate(value) {
  return `${value.toFixed(2)}/s`;
}

function formatMovingSeconds(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

function randomMovingBetween(min, max) {
  return Math.random() * (max - min) + min;
}

movingStartButton.addEventListener("click", () => startMovingTraining("free"));
movingChallengeButton.addEventListener("click", () => startMovingTraining("challenge"));
movingStopButton.addEventListener("click", () => finishMovingTraining(true));
movingFullscreenButton.addEventListener("click", () => {
  toggleMovingFullscreen().catch(() => {
    movingSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
movingTargetLayer.addEventListener("pointerdown", hitMovingTarget);
movingArena.addEventListener("pointerdown", missMovingTarget);
[movingSizeInput, movingCountInput, moveRangeInput, movingAreaInput, movingSpeedInput].forEach((input) => {
  input.addEventListener("input", syncMovingOutputs);
});
document.addEventListener("fullscreenchange", syncMovingFullscreen);
window.trainingClickButtons.suppressContextMenu(movingArena);

syncMovingOutputs();
updateMovingMetrics();
syncMovingFullscreen();
renderMovingChallengeRecord();
