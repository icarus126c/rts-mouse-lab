const rotatingArena = document.querySelector("#rotatingArena");
const rotatingTargetLayer = document.querySelector("#rotatingTargetLayer");
const rotatingMessage = document.querySelector("#rotatingMessage");
const rotatingStartButton = document.querySelector("#rotatingStartButton");
const rotatingChallengeButton = document.querySelector("#rotatingChallengeButton");
const rotatingStopButton = document.querySelector("#rotatingStopButton");
const rotatingFullscreenButton = document.querySelector("#rotatingFullscreenButton");
const rotatingSizeInput = document.querySelector("#rotatingSizeInput");
const rotatingCountInput = document.querySelector("#rotatingCountInput");
const rotatingMoveRangeInput = document.querySelector("#rotatingMoveRangeInput");
const rotatingAreaInput = document.querySelector("#rotatingAreaInput");
const rotatingMoveSpeedInput = document.querySelector("#rotatingMoveSpeedInput");
const rotationSpeedInput = document.querySelector("#rotationSpeedInput");
const rotatingHitSoundInput = document.querySelector("#rotatingHitSoundInput");
const rotatingSizeOutput = document.querySelector("#rotatingSizeOutput");
const rotatingCountOutput = document.querySelector("#rotatingCountOutput");
const rotatingMoveRangeOutput = document.querySelector("#rotatingMoveRangeOutput");
const rotatingAreaOutput = document.querySelector("#rotatingAreaOutput");
const rotatingMoveSpeedOutput = document.querySelector("#rotatingMoveSpeedOutput");
const rotationSpeedOutput = document.querySelector("#rotationSpeedOutput");
const rotatingState = document.querySelector("#rotatingState");
const rotatingHitMetric = document.querySelector("#rotatingHitMetric");
const rotatingAccuracyMetric = document.querySelector("#rotatingAccuracyMetric");
const rotatingMissMetric = document.querySelector("#rotatingMissMetric");
const rotatingActiveMetric = document.querySelector("#rotatingActiveMetric");
const rotatingTimeMetric = document.querySelector("#rotatingTimeMetric");
const rotatingResultHits = document.querySelector("#rotatingResultHits");
const rotatingResultMisses = document.querySelector("#rotatingResultMisses");
const rotatingResultAccuracy = document.querySelector("#rotatingResultAccuracy");
const rotatingResultAverage = document.querySelector("#rotatingResultAverage");
const rotatingResultRate = document.querySelector("#rotatingResultRate");
const rotatingBestRecord = document.querySelector("#rotatingBestRecord");
const rotatingSummary = document.querySelector("#rotatingSummary");
const ROTATING_CHALLENGE_RECORD_KEY = "rotating-target";

let rotatingRun = null;
let rotatingFrame = 0;
let rotatingGroupSequence = 0;
let rotatingAudioContext = null;

function rotatingSettings() {
  return {
    dotSize: Number(rotatingSizeInput.value),
    groupCount: Number(rotatingCountInput.value),
    moveRange: Number(rotatingMoveRangeInput.value),
    spawnRange: Number(rotatingAreaInput.value) / 100,
    moveSpeed: Number(rotatingMoveSpeedInput.value),
    rotationSpeed: Number(rotationSpeedInput.value) * Math.PI / 180,
    hitSound: rotatingHitSoundInput.checked,
  };
}

function syncRotatingOutputs() {
  rotatingSizeOutput.textContent = `${rotatingSizeInput.value}px`;
  rotatingCountOutput.textContent = rotatingCountInput.value;
  rotatingMoveRangeOutput.textContent = `${rotatingMoveRangeInput.value}px`;
  rotatingAreaOutput.textContent = `${rotatingAreaInput.value}%`;
  rotatingMoveSpeedOutput.textContent = `${rotatingMoveSpeedInput.value}px/s`;
  rotationSpeedOutput.textContent = `${rotationSpeedInput.value}deg/s`;
}

function startRotatingTraining(mode = "free") {
  finishRotatingTraining(false);
  const startedAt = performance.now();
  rotatingRun = {
    settings: rotatingSettings(),
    mode,
    startedAt,
    endsAt: mode === "challenge" ? startedAt + 30000 : 0,
    hits: 0,
    misses: 0,
    hitTimes: [],
    groups: new Map(),
    lastFrameAt: startedAt,
  };
  rotatingState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  rotatingMessage.hidden = true;
  rotatingSummary.textContent = mode === "challenge"
    ? "30 秒挑战中。抓红点的同时避开旋转白点。"
    : "自由训练中。移动与旋转速度会同时改变红点落点。";
  refillRotatingGroups();
  updateRotatingMetrics();
  rotatingFrame = window.requestAnimationFrame(stepRotatingGroups);
  rotatingArena.focus();
}

function refillRotatingGroups() {
  while (rotatingRun && rotatingRun.groups.size < rotatingRun.settings.groupCount) {
    spawnRotatingGroup();
  }
}

function spawnRotatingGroup() {
  const bounds = rotatingSpawnBounds();
  const anchor = randomRotatingPoint(bounds);
  const travelAngle = Math.random() * Math.PI * 2;
  const id = `rotation-${rotatingGroupSequence += 1}`;
  const groupElement = document.createElement("div");
  groupElement.className = "rotating-group";
  groupElement.dataset.groupId = id;
  const redIndex = Math.floor(Math.random() * 3);
  const dots = [-1, 0, 1].map((slot, index) => createRotatingDot(id, slot, index === redIndex));
  groupElement.append(...dots);
  groupElement.style.left = `${anchor.x}px`;
  groupElement.style.top = `${anchor.y}px`;
  rotatingRun.groups.set(id, {
    bornAt: performance.now(),
    anchorX: anchor.x,
    anchorY: anchor.y,
    x: anchor.x,
    y: anchor.y,
    vx: Math.cos(travelAngle) * rotatingRun.settings.moveSpeed,
    vy: Math.sin(travelAngle) * rotatingRun.settings.moveSpeed,
    angle: Math.random() * Math.PI * 2,
    element: groupElement,
  });
  rotatingTargetLayer.append(groupElement);
}

function createRotatingDot(groupId, slot, red) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `rotating-dot${red ? " red" : ""}`;
  button.dataset.groupId = groupId;
  button.dataset.slot = slot;
  button.dataset.kind = red ? "red" : "white";
  button.ariaLabel = red ? "点击红色旋转目标" : "白色干扰点";
  button.style.setProperty("--dot-size", `${rotatingRun.settings.dotSize}px`);
  button.innerHTML = "<span></span>";
  return button;
}

function rotatingRadius() {
  return rotatingRun.settings.dotSize * 1.18;
}

function rotatingSpawnBounds() {
  const rect = rotatingArena.getBoundingClientRect();
  const padding = rotatingRadius() + rotatingRun.settings.dotSize + 28;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const width = Math.max(rotatingRun.settings.dotSize * 2, (rect.width - padding * 2) * rotatingRun.settings.spawnRange);
  const height = Math.max(rotatingRun.settings.dotSize * 2, (rect.height - padding * 2) * rotatingRun.settings.spawnRange);
  return { minX: Math.max(padding, centerX - width / 2), maxX: Math.min(rect.width - padding, centerX + width / 2), minY: Math.max(padding, centerY - height / 2), maxY: Math.min(rect.height - padding, centerY + height / 2) };
}

function stepRotatingGroups(now) {
  if (!rotatingRun) return;
  if (rotatingRun.mode === "challenge" && now >= rotatingRun.endsAt) {
    finishRotatingTraining(true);
    return;
  }
  const delta = Math.min(0.05, Math.max(0, now - rotatingRun.lastFrameAt) / 1000);
  rotatingRun.lastFrameAt = now;
  const arenaBounds = rotatingArenaBounds();
  rotatingRun.groups.forEach((group) => moveRotatingGroup(group, delta, arenaBounds));
  updateRotatingMetrics();
  rotatingFrame = window.requestAnimationFrame(stepRotatingGroups);
}

function moveRotatingGroup(group, delta, arenaBounds) {
  group.x += group.vx * delta;
  group.y += group.vy * delta;
  const offsetX = group.x - group.anchorX;
  const offsetY = group.y - group.anchorY;
  const length = Math.hypot(offsetX, offsetY);
  if (length > rotatingRun.settings.moveRange) {
    const nx = offsetX / length;
    const ny = offsetY / length;
    group.x = group.anchorX + nx * rotatingRun.settings.moveRange;
    group.y = group.anchorY + ny * rotatingRun.settings.moveRange;
    reflectRotatingVelocity(group, nx, ny);
  }
  if (group.x < arenaBounds.minX || group.x > arenaBounds.maxX) {
    group.x = Math.min(arenaBounds.maxX, Math.max(arenaBounds.minX, group.x));
    group.vx *= -1;
  }
  if (group.y < arenaBounds.minY || group.y > arenaBounds.maxY) {
    group.y = Math.min(arenaBounds.maxY, Math.max(arenaBounds.minY, group.y));
    group.vy *= -1;
  }
  group.angle += rotatingRun.settings.rotationSpeed * delta;
  group.element.style.left = `${group.x}px`;
  group.element.style.top = `${group.y}px`;
  positionRotatingDots(group);
}

function positionRotatingDots(group) {
  const radius = rotatingRadius();
  group.element.querySelectorAll(".rotating-dot").forEach((dot) => {
    const slot = Number(dot.dataset.slot);
    const x = Math.cos(group.angle + Math.PI / 2) * radius * slot;
    const y = Math.sin(group.angle + Math.PI / 2) * radius * slot;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  });
}

function rotatingArenaBounds() {
  const rect = rotatingArena.getBoundingClientRect();
  const padding = rotatingRadius() + rotatingRun.settings.dotSize / 2 + 10;
  return { minX: padding, maxX: rect.width - padding, minY: padding, maxY: rect.height - padding };
}

function reflectRotatingVelocity(group, nx, ny) {
  const dot = group.vx * nx + group.vy * ny;
  group.vx -= 2 * dot * nx;
  group.vy -= 2 * dot * ny;
}

function clickRotatingDot(event) {
  const dot = event.target.closest(".rotating-dot");
  if (!rotatingRun || !dot) return;
  event.stopPropagation();
  if (dot.dataset.kind !== "red") {
    rotatingRun.misses += 1;
    updateRotatingMetrics();
    return;
  }
  const group = rotatingRun.groups.get(dot.dataset.groupId);
  if (!group) return;
  rotatingRun.hits += 1;
  rotatingRun.hitTimes.push(performance.now() - group.bornAt);
  removeRotatingGroup(dot.dataset.groupId);
  if (rotatingRun.settings.hitSound) playRotatingHitSound();
  refillRotatingGroups();
  updateRotatingMetrics();
}

function missRotatingArena(event) {
  if (!rotatingRun || event.target.closest(".rotating-dot")) return;
  rotatingRun.misses += 1;
  updateRotatingMetrics();
}

function removeRotatingGroup(id) {
  const group = rotatingRun?.groups.get(id);
  if (!group) return;
  group.element.remove();
  rotatingRun.groups.delete(id);
}

function finishRotatingTraining(showResult) {
  if (!rotatingRun) return;
  const completedRun = rotatingRun;
  completedRun.finishedAt = performance.now();
  rotatingRun = null;
  window.cancelAnimationFrame(rotatingFrame);
  rotatingFrame = 0;
  rotatingTargetLayer.innerHTML = "";
  rotatingState.textContent = "待开始";
  rotatingMessage.hidden = false;
  if (!showResult) {
    updateRotatingMetrics();
    return;
  }
  showRotatingResult(completedRun);
  updateRotatingMetrics(completedRun);
}

function showRotatingResult(run) {
  const attempts = run.hits + run.misses;
  const accuracy = attempts ? run.hits / attempts : 0;
  rotatingResultHits.textContent = String(run.hits);
  rotatingResultMisses.textContent = String(run.misses);
  rotatingResultAccuracy.textContent = attempts ? formatRotatingPercent(accuracy) : "--";
  rotatingResultAverage.textContent = run.hitTimes.length ? formatRotatingMs(averageRotating(run.hitTimes)) : "--";
  rotatingResultRate.textContent = run.mode === "challenge" ? formatRotatingRate(correctRotatingRate(run)) : "--";
  if (run.mode === "challenge") {
    keepRotatingChallengeRecord(run, accuracy);
  }
  rotatingSummary.textContent = rotatingDiagnosis(run, accuracy);
}

function keepRotatingChallengeRecord(run, accuracy) {
  const averageTime = averageRotating(run.hitTimes);
  const result = window.challengeRecords.keepBetter(ROTATING_CHALLENGE_RECORD_KEY, {
    hits: run.hits,
    misses: run.misses,
    accuracy,
    averageTime,
    rate: correctRotatingRate(run),
    settings: run.settings,
  }, betterRotatingRecord);
  renderRotatingChallengeRecord(result.record, result.improved);
}

function betterRotatingRecord(candidate, current) {
  if (candidate.hits !== current.hits) return candidate.hits > current.hits;
  if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
  return candidate.averageTime < current.averageTime;
}

function renderRotatingChallengeRecord(record = window.challengeRecords.get(ROTATING_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    rotatingBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  rotatingBestRecord.textContent = `${prefix}：命中 ${record.hits} 个 · 准确率 ${formatRotatingPercent(record.accuracy)} · ${formatRotatingRate(record.rate)}`;
}

function rotatingDiagnosis(run, accuracy) {
  if (run.mode === "challenge") {
    return `30 秒挑战完成：命中 ${run.hits} 个，准确率 ${formatRotatingPercent(accuracy)}，正确点击速 ${formatRotatingRate(correctRotatingRate(run))}。`;
  }
  if (!run.hits) {
    return "这组还没有点中红点。先减慢平移或旋转速度，把红白判断稳住。";
  }
  if (accuracy < 0.8) {
    return `命中 ${run.hits} 个，准确率 ${formatRotatingPercent(accuracy)}。白点和空点还在吃掉输出。`;
  }
  return `命中 ${run.hits} 个，平均命中 ${formatRotatingMs(averageRotating(run.hitTimes))}，红点选择较稳。`;
}

function updateRotatingMetrics(completedRun = null) {
  const run = rotatingRun ?? completedRun;
  if (!run) {
    rotatingHitMetric.textContent = "0";
    rotatingAccuracyMetric.textContent = "--";
    rotatingMissMetric.textContent = "0";
    rotatingActiveMetric.textContent = "0";
    rotatingTimeMetric.textContent = "--";
    return;
  }
  const attempts = run.hits + run.misses;
  rotatingHitMetric.textContent = String(run.hits);
  rotatingAccuracyMetric.textContent = attempts ? formatRotatingPercent(run.hits / attempts) : "--";
  rotatingMissMetric.textContent = String(run.misses);
  rotatingActiveMetric.textContent = rotatingRun ? String(run.groups.size) : "0";
  rotatingTimeMetric.textContent = rotatingRun?.mode === "challenge"
    ? formatRotatingSeconds(Math.max(0, run.endsAt - performance.now()))
    : "--";
}

function playRotatingHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return;
  rotatingAudioContext ??= new AudioContext();
  rotatingAudioContext.resume().catch(() => {});
  const startAt = rotatingAudioContext.currentTime;
  const oscillator = rotatingAudioContext.createOscillator();
  const gain = rotatingAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(rotatingAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

async function toggleRotatingFullscreen() {
  if (document.fullscreenElement === rotatingArena) {
    await document.exitFullscreen();
    return;
  }
  await rotatingArena.requestFullscreen();
}

function syncRotatingFullscreen() {
  const fullscreen = document.fullscreenElement === rotatingArena;
  rotatingFullscreenButton.classList.toggle("is-active", fullscreen);
  rotatingFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  rotatingFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function randomRotatingPoint(bounds) {
  return { x: randomRotatingBetween(bounds.minX, bounds.maxX), y: randomRotatingBetween(bounds.minY, bounds.maxY) };
}

function averageRotating(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function correctRotatingRate(run) {
  return run.hits / Math.max(0.001, elapsedRotatingTime(run) / 1000);
}

function elapsedRotatingTime(run) {
  const elapsed = Math.max(0, (run.finishedAt ?? performance.now()) - run.startedAt);
  return run.mode === "challenge" ? Math.min(30000, elapsed) : elapsed;
}

function formatRotatingMs(value) { return value ? `${Math.round(value)}ms` : "--"; }
function formatRotatingPercent(value) { return `${Math.round(value * 100)}%`; }
function formatRotatingRate(value) { return `${value.toFixed(2)}/s`; }
function formatRotatingSeconds(value) { return `${(value / 1000).toFixed(1)}s`; }
function randomRotatingBetween(min, max) { return Math.random() * (max - min) + min; }

rotatingStartButton.addEventListener("click", () => startRotatingTraining("free"));
rotatingChallengeButton.addEventListener("click", () => startRotatingTraining("challenge"));
rotatingStopButton.addEventListener("click", () => finishRotatingTraining(true));
rotatingFullscreenButton.addEventListener("click", () => {
  toggleRotatingFullscreen().catch(() => {
    rotatingSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
rotatingTargetLayer.addEventListener("pointerdown", clickRotatingDot);
rotatingArena.addEventListener("pointerdown", missRotatingArena);
[rotatingSizeInput, rotatingCountInput, rotatingMoveRangeInput, rotatingAreaInput, rotatingMoveSpeedInput, rotationSpeedInput].forEach((input) => {
  input.addEventListener("input", syncRotatingOutputs);
});
document.addEventListener("fullscreenchange", syncRotatingFullscreen);

syncRotatingOutputs();
updateRotatingMetrics();
syncRotatingFullscreen();
renderRotatingChallengeRecord();
