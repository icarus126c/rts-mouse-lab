const amoveArena = document.querySelector("#amoveArena");
const amoveTargetLayer = document.querySelector("#amoveTargetLayer");
const amoveMessage = document.querySelector("#amoveMessage");
const amoveStartButton = document.querySelector("#amoveStartButton");
const amoveChallengeButton = document.querySelector("#amoveChallengeButton");
const amoveStopButton = document.querySelector("#amoveStopButton");
const amoveFullscreenButton = document.querySelector("#amoveFullscreenButton");
const amoveSizeInput = document.querySelector("#amoveSizeInput");
const amoveWhiteCountInput = document.querySelector("#amoveWhiteCountInput");
const amoveSpeedInput = document.querySelector("#amoveSpeedInput");
const amoveMoveRangeInput = document.querySelector("#amoveMoveRangeInput");
const amoveAreaInput = document.querySelector("#amoveAreaInput");
const amoveAnchorButtonInput = document.querySelector("#amoveAnchorButtonInput");
const amoveHitSoundInput = document.querySelector("#amoveHitSoundInput");
const amoveSizeOutput = document.querySelector("#amoveSizeOutput");
const amoveWhiteCountOutput = document.querySelector("#amoveWhiteCountOutput");
const amoveSpeedOutput = document.querySelector("#amoveSpeedOutput");
const amoveMoveRangeOutput = document.querySelector("#amoveMoveRangeOutput");
const amoveAreaOutput = document.querySelector("#amoveAreaOutput");
const amoveInstructionTitle = document.querySelector("#amoveInstructionTitle");
const amoveState = document.querySelector("#amoveState");
const amoveHitMetric = document.querySelector("#amoveHitMetric");
const amoveAccuracyMetric = document.querySelector("#amoveAccuracyMetric");
const amoveAcquireMetric = document.querySelector("#amoveAcquireMetric");
const amoveMissMetric = document.querySelector("#amoveMissMetric");
const amovePhaseMetric = document.querySelector("#amovePhaseMetric");
const amoveTimeMetric = document.querySelector("#amoveTimeMetric");
const amoveResultHits = document.querySelector("#amoveResultHits");
const amoveResultMisses = document.querySelector("#amoveResultMisses");
const amoveResultAccuracy = document.querySelector("#amoveResultAccuracy");
const amoveResultAcquire = document.querySelector("#amoveResultAcquire");
const amoveResultPrimeLabel = document.querySelector("#amoveResultPrimeLabel");
const amoveResultPrime = document.querySelector("#amoveResultPrime");
const amoveResultRound = document.querySelector("#amoveResultRound");
const amoveResultRate = document.querySelector("#amoveResultRate");
const amoveBestRecord = document.querySelector("#amoveBestRecord");
const amoveSummary = document.querySelector("#amoveSummary");
const AMOVE_CHALLENGE_RECORD_KEY = "a-move";

let amoveRun = null;
let amoveFrame = 0;
let amoveSequence = 0;
let amoveAudioContext = null;

function amoveSettings() {
  return {
    targetSize: Number(amoveSizeInput.value),
    whiteCount: Number(amoveWhiteCountInput.value),
    speed: Number(amoveSpeedInput.value),
    moveRange: Number(amoveMoveRangeInput.value),
    spawnRange: Number(amoveAreaInput.value) / 100,
    anchorButton: amoveAnchorButtonInput.value,
    hitSound: amoveHitSoundInput.checked,
  };
}

function syncAmoveOutputs() {
  amoveSizeOutput.textContent = `${amoveSizeInput.value}px`;
  amoveWhiteCountOutput.textContent = amoveWhiteCountInput.value;
  amoveSpeedOutput.textContent = `${amoveSpeedInput.value}px/s`;
  amoveMoveRangeOutput.textContent = `${amoveMoveRangeInput.value}px`;
  amoveAreaOutput.textContent = `${amoveAreaInput.value}%`;
  const anchorAction = amoveAnchorActionName(amoveAnchorButtonInput.value);
  amoveInstructionTitle.textContent = `${anchorAction}绿色点，按 A，再点移动红靶。`;
  amoveResultPrimeLabel.textContent = `${anchorAction}到 A`;
}

function startAmoveTraining(mode = "free") {
  finishAmoveTraining(false);
  const startedAt = performance.now();
  amoveRun = {
    settings: amoveSettings(),
    mode,
    startedAt,
    endsAt: mode === "challenge" ? startedAt + 30000 : 0,
    phase: "anchor",
    hits: 0,
    misses: 0,
    aPresses: 0,
    anchorClicks: 0,
    primeTimes: [],
    acquireTimes: [],
    roundTimes: [],
    targets: new Map(),
    lastFrameAt: startedAt,
    roundStartedAt: startedAt,
    rightClickedAt: 0,
    armedAt: 0,
  };
  amoveState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  amoveMessage.hidden = true;
  amoveSummary.textContent = mode === "challenge"
    ? `30 秒挑战中。${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿点、接 A、打红靶，尽量多完成正确回合。`
    : `${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色点进入准备，按 A 后再点移动红靶。白靶会干扰视线但不能点。`;
  spawnAmoveRound();
  updateAmoveMetrics();
  amoveFrame = window.requestAnimationFrame(stepAmoveTargets);
  amoveArena.focus();
}

function spawnAmoveRound() {
  if (!amoveRun) return;
  amoveTargetLayer.innerHTML = "";
  amoveRun.targets.clear();
  amoveRun.phase = "anchor";
  amoveRun.roundStartedAt = performance.now();
  amoveRun.rightClickedAt = 0;
  amoveRun.armedAt = 0;
  const anchorPoint = randomAmovePoint(amoveBounds(amoveRun.settings.targetSize + 30));
  amoveTargetLayer.append(createAmoveAnchor(anchorPoint));
  for (let index = 0; index < amoveRun.settings.whiteCount + 1; index += 1) {
    spawnAmoveTarget(index === 0 ? "red" : "white");
  }
  updateAmoveTargetsMuted(true);
}

function createAmoveAnchor(point) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "amove-anchor";
  button.ariaLabel = `${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色静止标靶`;
  button.style.setProperty("--target-size", `${amoveRun.settings.targetSize}px`);
  button.style.left = `${point.x}px`;
  button.style.top = `${point.y}px`;
  button.innerHTML = "<span></span>";
  return button;
}

function spawnAmoveTarget(kind) {
  const bounds = amoveBounds(amoveRun.settings.targetSize + 28);
  const point = randomAmovePoint(bounds);
  const angle = Math.random() * Math.PI * 2;
  const id = `amove-${amoveSequence += 1}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `amove-target ${kind}`;
  button.dataset.targetId = id;
  button.dataset.kind = kind;
  button.ariaLabel = kind === "red" ? "走 A 红色目标" : "白色干扰目标";
  button.style.setProperty("--target-size", `${amoveRun.settings.targetSize}px`);
  button.style.left = `${point.x}px`;
  button.style.top = `${point.y}px`;
  button.innerHTML = "<span></span>";
  amoveRun.targets.set(id, {
    kind,
    element: button,
    anchorX: point.x,
    anchorY: point.y,
    x: point.x,
    y: point.y,
    vx: Math.cos(angle) * amoveRun.settings.speed,
    vy: Math.sin(angle) * amoveRun.settings.speed,
  });
  amoveTargetLayer.append(button);
}

function stepAmoveTargets(now) {
  if (!amoveRun) return;
  if (amoveRun.mode === "challenge" && now >= amoveRun.endsAt) {
    finishAmoveTraining(true);
    return;
  }
  const delta = Math.min(0.05, Math.max(0, now - amoveRun.lastFrameAt) / 1000);
  amoveRun.lastFrameAt = now;
  const bounds = amoveBounds(amoveRun.settings.targetSize / 2 + 10);
  amoveRun.targets.forEach((target) => moveAmoveTarget(target, delta, bounds));
  updateAmoveMetrics();
  amoveFrame = window.requestAnimationFrame(stepAmoveTargets);
}

function moveAmoveTarget(target, delta, bounds) {
  target.x += target.vx * delta;
  target.y += target.vy * delta;
  const offsetX = target.x - target.anchorX;
  const offsetY = target.y - target.anchorY;
  const length = Math.hypot(offsetX, offsetY);
  if (length > amoveRun.settings.moveRange) {
    const nx = offsetX / length;
    const ny = offsetY / length;
    target.x = target.anchorX + nx * amoveRun.settings.moveRange;
    target.y = target.anchorY + ny * amoveRun.settings.moveRange;
    reflectAmoveVelocity(target, nx, ny);
  }
  if (target.x < bounds.minX || target.x > bounds.maxX) {
    target.x = Math.min(bounds.maxX, Math.max(bounds.minX, target.x));
    target.vx *= -1;
  }
  if (target.y < bounds.minY || target.y > bounds.maxY) {
    target.y = Math.min(bounds.maxY, Math.max(bounds.minY, target.y));
    target.vy *= -1;
  }
  target.element.style.left = `${target.x}px`;
  target.element.style.top = `${target.y}px`;
}

function clickAmoveAnchor(event) {
  const anchor = event.target.closest(".amove-anchor");
  if (!amoveRun || !anchor) return;
  if (event.button !== amoveAnchorButtonValue(amoveRun.settings.anchorButton)) {
    if (event.button === 0 || event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      amoveRun.misses += 1;
      amoveSummary.textContent = `当前设置需要${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色点。`;
      updateAmoveMetrics();
    }
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (amoveRun.phase !== "anchor") return;
  amoveRun.phase = "primed";
  amoveRun.anchorClicks += 1;
  amoveRun.rightClickedAt = performance.now();
  anchor.classList.add("is-muted");
  amoveSummary.textContent = `已${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色点。现在按 A，再点击移动红靶。`;
  updateAmoveMetrics();
}

function keyAmove(event) {
  if (!amoveRun || event.key.toLowerCase() !== "a") return;
  if (amoveRun.phase !== "primed") {
    amoveRun.misses += 1;
    amoveSummary.textContent = `需要先${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色静止点，再按 A。`;
    updateAmoveMetrics();
    return;
  }
  event.preventDefault();
  amoveRun.phase = "armed";
  amoveRun.aPresses += 1;
  amoveRun.armedAt = performance.now();
  amoveRun.primeTimes.push(amoveRun.armedAt - amoveRun.rightClickedAt);
  updateAmoveTargetsMuted(false);
  amoveSummary.textContent = "A 已按下。现在只点击移动红靶，白靶算点歪。";
  updateAmoveMetrics();
}

function clickAmoveTarget(event) {
  const targetElement = event.target.closest(".amove-target");
  if (!amoveRun || !targetElement || event.button !== 0) return;
  event.stopPropagation();
  const target = amoveRun.targets.get(targetElement.dataset.targetId);
  if (!target) return;
  if (amoveRun.phase !== "armed") {
    amoveRun.misses += 1;
    amoveSummary.textContent = `点目标前必须先${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿色点，再按 A。`;
    updateAmoveMetrics();
    return;
  }
  if (target.kind !== "red") {
    amoveRun.misses += 1;
    amoveSummary.textContent = "点到白色干扰靶了。按 A 后只打红靶。";
    updateAmoveMetrics();
    return;
  }
  amoveRun.hits += 1;
  amoveRun.acquireTimes.push(performance.now() - amoveRun.armedAt);
  amoveRun.roundTimes.push(performance.now() - amoveRun.roundStartedAt);
  if (amoveRun.settings.hitSound) playAmoveHitSound();
  spawnAmoveRound();
  updateAmoveMetrics();
}

function missAmoveArena(event) {
  if (!amoveRun || event.target.closest(".amove-target") || event.target.closest(".amove-anchor")) return;
  if (event.button !== 0 && event.button !== 2) return;
  amoveRun.misses += 1;
  updateAmoveMetrics();
}

function finishAmoveTraining(showResult) {
  if (!amoveRun) return;
  const completedRun = amoveRun;
  completedRun.finishedAt = performance.now();
  amoveRun = null;
  window.cancelAnimationFrame(amoveFrame);
  amoveFrame = 0;
  amoveTargetLayer.innerHTML = "";
  amoveState.textContent = "待开始";
  amoveMessage.hidden = false;
  if (!showResult) {
    updateAmoveMetrics();
    return;
  }
  showAmoveResult(completedRun);
  updateAmoveMetrics(completedRun);
}

function showAmoveResult(run) {
  const attempts = run.hits + run.misses;
  const accuracy = attempts ? run.hits / attempts : 0;
  const averageAcquire = averageAmove(run.acquireTimes);
  const averagePrime = averageAmove(run.primeTimes);
  const averageRound = averageAmove(run.roundTimes);
  amoveResultPrimeLabel.textContent = `${amoveAnchorActionName(run.settings.anchorButton)}到 A`;
  amoveResultHits.textContent = String(run.hits);
  amoveResultMisses.textContent = String(run.misses);
  amoveResultAccuracy.textContent = attempts ? formatAmovePercent(accuracy) : "--";
  amoveResultAcquire.textContent = run.acquireTimes.length ? formatAmoveMs(averageAcquire) : "--";
  amoveResultPrime.textContent = run.primeTimes.length ? formatAmoveMs(averagePrime) : "--";
  amoveResultRound.textContent = run.roundTimes.length ? formatAmoveMs(averageRound) : "--";
  amoveResultRate.textContent = run.mode === "challenge" ? formatAmoveRate(correctAmoveRate(run)) : "--";
  if (run.mode === "challenge") {
    keepAmoveChallengeRecord(run, accuracy, averageAcquire, averagePrime, averageRound);
  }
  amoveSummary.textContent = amoveDiagnosis(run, accuracy, averageAcquire, averagePrime);
}

function keepAmoveChallengeRecord(run, accuracy, averageAcquire, averagePrime, averageRound) {
  const result = window.challengeRecords.keepBetter(AMOVE_CHALLENGE_RECORD_KEY, {
    hits: run.hits,
    misses: run.misses,
    accuracy,
    averageAcquire,
    averagePrime,
    averageRound,
    rate: correctAmoveRate(run),
    settings: run.settings,
  }, betterAmoveRecord);
  renderAmoveChallengeRecord(result.record, result.improved);
}

function betterAmoveRecord(candidate, current) {
  if (candidate.hits !== current.hits) return candidate.hits > current.hits;
  if (candidate.accuracy !== current.accuracy) return candidate.accuracy > current.accuracy;
  return candidate.averageRound < current.averageRound;
}

function renderAmoveChallengeRecord(record = window.challengeRecords.get(AMOVE_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    amoveBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  amoveBestRecord.textContent = `${prefix}：成功 ${record.hits} 回合 · 准确率 ${formatAmovePercent(record.accuracy)} · ${formatAmoveRate(record.rate)}`;
}

function amoveDiagnosis(run, accuracy, averageAcquire, averagePrime) {
  if (run.mode === "challenge") {
    return `30 秒挑战完成：成功 ${run.hits} 回合，准确率 ${formatAmovePercent(accuracy)}，正确回合速 ${formatAmoveRate(correctAmoveRate(run))}。`;
  }
  if (!run.hits) {
    return `还没有完成走 A 命中。先按顺序完成：${amoveAnchorActionName(run.settings.anchorButton)}绿点、A、左键红靶。`;
  }
  if (accuracy < 0.78) {
    return `成功 ${run.hits} 次，准确率 ${formatAmovePercent(accuracy)}。当前先减少没按 A 就点、点白靶或空点。`;
  }
  if (averagePrime > 300) {
    return `${amoveAnchorActionName(run.settings.anchorButton)}到 A 平均 ${formatAmoveMs(averagePrime)}。可以练绿点触发后更快接 A。`;
  }
  if (averageAcquire > 520) {
    return `A 后命中平均 ${formatAmoveMs(averageAcquire)}。重点练红白干扰中的快速识别。`;
  }
  return `走 A 链路较顺：${amoveAnchorActionName(run.settings.anchorButton)}到 A ${formatAmoveMs(averagePrime)}，A 后命中 ${formatAmoveMs(averageAcquire)}。`;
}

function updateAmoveMetrics(completedRun = null) {
  const run = amoveRun ?? completedRun;
  if (!run) {
    amoveHitMetric.textContent = "0";
    amoveAccuracyMetric.textContent = "--";
    amoveAcquireMetric.textContent = "--";
    amoveMissMetric.textContent = "0";
    amovePhaseMetric.textContent = "待开始";
    amoveTimeMetric.textContent = "--";
    return;
  }
  const attempts = run.hits + run.misses;
  amoveHitMetric.textContent = String(run.hits);
  amoveAccuracyMetric.textContent = attempts ? formatAmovePercent(run.hits / attempts) : "--";
  amoveAcquireMetric.textContent = run.acquireTimes.length ? formatAmoveMs(averageAmove(run.acquireTimes)) : "--";
  amoveMissMetric.textContent = String(run.misses);
  amovePhaseMetric.textContent = amovePhaseName(run.phase);
  amoveTimeMetric.textContent = amoveRun?.mode === "challenge"
    ? formatAmoveSeconds(Math.max(0, run.endsAt - performance.now()))
    : "--";
}

function amovePhaseName(phase) {
  if (phase === "anchor") return amoveRun ? `${amoveAnchorActionName(amoveRun.settings.anchorButton)}绿点` : "触发绿点";
  if (phase === "primed") return "按 A";
  if (phase === "armed") return "点红靶";
  return "待开始";
}

function amoveAnchorActionName(mode) {
  return mode === "left" ? "左键点击" : "右键点击";
}

function amoveAnchorButtonValue(mode) {
  return mode === "left" ? 0 : 2;
}

function updateAmoveTargetsMuted(muted) {
  amoveTargetLayer.querySelectorAll(".amove-target").forEach((target) => target.classList.toggle("is-muted", muted));
}

function amoveBounds(padding) {
  const rect = amoveArena.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const width = Math.max(60, (rect.width - padding * 2) * amoveRun.settings.spawnRange);
  const height = Math.max(60, (rect.height - padding * 2) * amoveRun.settings.spawnRange);
  return {
    minX: Math.max(padding, centerX - width / 2),
    maxX: Math.min(rect.width - padding, centerX + width / 2),
    minY: Math.max(padding, centerY - height / 2),
    maxY: Math.min(rect.height - padding, centerY + height / 2),
  };
}

function randomAmovePoint(bounds) {
  return { x: randomAmoveBetween(bounds.minX, bounds.maxX), y: randomAmoveBetween(bounds.minY, bounds.maxY) };
}

function reflectAmoveVelocity(target, nx, ny) {
  const dot = target.vx * nx + target.vy * ny;
  target.vx -= 2 * dot * nx;
  target.vy -= 2 * dot * ny;
}

function playAmoveHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return;
  amoveAudioContext ??= new AudioContext();
  amoveAudioContext.resume().catch(() => {});
  const startAt = amoveAudioContext.currentTime;
  const oscillator = amoveAudioContext.createOscillator();
  const gain = amoveAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(amoveAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

async function toggleAmoveFullscreen() {
  if (document.fullscreenElement === amoveArena) {
    await document.exitFullscreen();
    return;
  }
  await amoveArena.requestFullscreen();
}

function syncAmoveFullscreen() {
  const fullscreen = document.fullscreenElement === amoveArena;
  amoveFullscreenButton.classList.toggle("is-active", fullscreen);
  amoveFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  amoveFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function averageAmove(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function correctAmoveRate(run) { return run.hits / Math.max(0.001, elapsedAmoveTime(run) / 1000); }
function elapsedAmoveTime(run) {
  const endAt = run.finishedAt ?? performance.now();
  const elapsed = Math.max(0, endAt - run.startedAt);
  return run.mode === "challenge" ? Math.min(30000, elapsed) : elapsed;
}
function formatAmoveMs(value) { return value ? `${Math.round(value)}ms` : "--"; }
function formatAmovePercent(value) { return `${Math.round(value * 100)}%`; }
function formatAmoveRate(value) { return `${value.toFixed(2)}/s`; }
function formatAmoveSeconds(value) { return `${(value / 1000).toFixed(1)}s`; }
function randomAmoveBetween(min, max) { return Math.random() * (max - min) + min; }

amoveStartButton.addEventListener("click", () => startAmoveTraining("free"));
amoveChallengeButton.addEventListener("click", () => startAmoveTraining("challenge"));
amoveStopButton.addEventListener("click", () => finishAmoveTraining(true));
amoveFullscreenButton.addEventListener("click", () => {
  toggleAmoveFullscreen().catch(() => {
    amoveSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
amoveTargetLayer.addEventListener("pointerdown", clickAmoveAnchor);
amoveTargetLayer.addEventListener("pointerdown", clickAmoveTarget);
amoveArena.addEventListener("pointerdown", missAmoveArena);
amoveArena.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("keydown", keyAmove);
[amoveSizeInput, amoveWhiteCountInput, amoveSpeedInput, amoveMoveRangeInput, amoveAreaInput].forEach((input) => input.addEventListener("input", syncAmoveOutputs));
amoveAnchorButtonInput.addEventListener("change", syncAmoveOutputs);
document.addEventListener("fullscreenchange", syncAmoveFullscreen);

syncAmoveOutputs();
updateAmoveMetrics();
syncAmoveFullscreen();
renderAmoveChallengeRecord();
