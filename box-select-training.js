const selectArena = document.querySelector("#selectArena");
const selectRoundLayer = document.querySelector("#selectRoundLayer");
const selectBox = document.querySelector("#selectBox");
const selectMessage = document.querySelector("#selectMessage");
const selectStartButton = document.querySelector("#selectStartButton");
const selectChallengeButton = document.querySelector("#selectChallengeButton");
const selectStopButton = document.querySelector("#selectStopButton");
const selectFullscreenButton = document.querySelector("#selectFullscreenButton");
const selectCountInput = document.querySelector("#selectCountInput");
const selectSizeInput = document.querySelector("#selectSizeInput");
const selectSpreadInput = document.querySelector("#selectSpreadInput");
const selectRedDistanceInput = document.querySelector("#selectRedDistanceInput");
const selectAreaInput = document.querySelector("#selectAreaInput");
const selectHitSoundInput = document.querySelector("#selectHitSoundInput");
const selectCountOutput = document.querySelector("#selectCountOutput");
const selectSizeOutput = document.querySelector("#selectSizeOutput");
const selectSpreadOutput = document.querySelector("#selectSpreadOutput");
const selectRedDistanceOutput = document.querySelector("#selectRedDistanceOutput");
const selectAreaOutput = document.querySelector("#selectAreaOutput");
const selectState = document.querySelector("#selectState");
const selectHitMetric = document.querySelector("#selectHitMetric");
const selectBoxMetric = document.querySelector("#selectBoxMetric");
const selectDirectionMetric = document.querySelector("#selectDirectionMetric");
const selectPathMetric = document.querySelector("#selectPathMetric");
const selectTimeMetric = document.querySelector("#selectTimeMetric");
const selectResultHits = document.querySelector("#selectResultHits");
const selectResultMisses = document.querySelector("#selectResultMisses");
const selectResultBox = document.querySelector("#selectResultBox");
const selectResultAverage = document.querySelector("#selectResultAverage");
const selectResultDirection = document.querySelector("#selectResultDirection");
const selectResultPath = document.querySelector("#selectResultPath");
const selectResultRate = document.querySelector("#selectResultRate");
const selectBestRecord = document.querySelector("#selectBestRecord");
const selectSummary = document.querySelector("#selectSummary");
const SELECT_CHALLENGE_RECORD_KEY = "box-select";

let selectRun = null;
let selectDrag = null;
let selectChallengeFrame = 0;
let selectRoundSequence = 0;
let selectAudioContext = null;

function selectSettings() {
  return {
    greenCount: Number(selectCountInput.value),
    targetSize: Number(selectSizeInput.value),
    spread: Number(selectSpreadInput.value),
    redDistance: Number(selectRedDistanceInput.value),
    spawnRange: Number(selectAreaInput.value) / 100,
    hitSound: selectHitSoundInput.checked,
  };
}

function syncSelectOutputs() {
  selectCountOutput.textContent = selectCountInput.value;
  selectSizeOutput.textContent = `${selectSizeInput.value}px`;
  selectSpreadOutput.textContent = `${selectSpreadInput.value}px`;
  selectRedDistanceOutput.textContent = `${selectRedDistanceInput.value}px`;
  selectAreaOutput.textContent = `${selectAreaInput.value}%`;
}

function startSelectTraining(mode = "free") {
  finishSelectTraining(false);
  const startedAt = performance.now();
  selectRun = {
    settings: selectSettings(),
    mode,
    startedAt,
    endsAt: mode === "challenge" ? startedAt + 30000 : 0,
    successes: 0,
    misses: 0,
    boxAttempts: 0,
    boxSuccesses: 0,
    directionScores: [],
    pathScores: [],
    completionTimes: [],
    round: null,
  };
  selectState.textContent = mode === "challenge" ? "挑战中" : "训练中";
  selectMessage.hidden = true;
  selectSummary.textContent = mode === "challenge"
    ? "30 秒挑战中。每个回合先完整框绿点，再顺势点红点。"
    : "拖框方向会和红点方位比较，释放后到红点的轨迹也会计入效率。";
  spawnSelectRound();
  updateSelectMetrics();
  runSelectChallengeClock();
  selectArena.focus();
}

function spawnSelectRound() {
  if (!selectRun) return;
  selectRoundLayer.innerHTML = "";
  hideSelectionBox();
  const round = createSelectRound();
  selectRun.round = round;
  round.greens.forEach((target) => selectRoundLayer.append(createSelectTarget(target, "green")));
  selectRoundLayer.append(createSelectTarget(round.red, "red"));
}

function createSelectRound() {
  const arena = selectArena.getBoundingClientRect();
  const settings = selectRun.settings;
  const safePad = settings.targetSize + settings.redDistance + settings.spread * 0.58 + 26;
  const centerBounds = rangedBounds(arena.width, arena.height, safePad, settings.spawnRange);
  const center = randomSelectPoint(centerBounds);
  const greens = createGreenTargets(center, settings, arena);
  const greenCenter = averagePoint(greens);
  const red = createRedTarget(greenCenter, settings, arena);
  return {
    id: `select-${selectRoundSequence += 1}`,
    startedAt: performance.now(),
    greens,
    greenCenter,
    red,
    boxReady: false,
    directionScore: 0,
    releasePoint: null,
    chasePath: [],
  };
}

function createGreenTargets(center, settings, arena) {
  const targets = [];
  const radius = Math.max(settings.targetSize * 1.25, settings.spread / 2);
  const minGap = settings.targetSize * 1.05;
  for (let index = 0; index < settings.greenCount; index += 1) {
    let point = center;
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      point = clampPoint({
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      }, arena, settings.targetSize / 2 + 12);
      if (targets.every((target) => Math.hypot(target.x - point.x, target.y - point.y) >= minGap)) {
        break;
      }
    }
    targets.push({ x: point.x, y: point.y });
  }
  return targets;
}

function createRedTarget(center, settings, arena) {
  let red = center;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = settings.redDistance * randomSelectBetween(0.86, 1.14);
    red = clampPoint({
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
    }, arena, settings.targetSize / 2 + 18);
    if (Math.hypot(red.x - center.x, red.y - center.y) >= settings.redDistance * 0.62) {
      break;
    }
  }
  return red;
}

function createSelectTarget(point, kind) {
  const target = document.createElement("button");
  target.type = "button";
  target.className = `select-target${kind === "red" ? " red locked" : ""}`;
  target.dataset.kind = kind;
  target.ariaLabel = kind === "red" ? "红色后续目标" : "需要框选的绿色目标";
  target.style.setProperty("--target-size", `${selectRun.settings.targetSize}px`);
  target.style.left = `${point.x}px`;
  target.style.top = `${point.y}px`;
  target.innerHTML = "<span></span>";
  return target;
}

function beginSelectDrag(event) {
  if (!selectRun || event.button !== 0 || event.target.closest(".select-target.red")) return;
  event.preventDefault();
  const point = arenaPoint(event);
  selectDrag = {
    pointerId: event.pointerId,
    start: point,
    last: point,
  };
  selectArena.setPointerCapture(event.pointerId);
  selectBox.classList.remove("failed");
  showSelectionBox(selectionRect(point, point));
}

function moveSelectPointer(event) {
  if (!selectRun) return;
  const point = arenaPoint(event);
  if (selectDrag && event.pointerId === selectDrag.pointerId) {
    selectDrag.last = point;
    showSelectionBox(selectionRect(selectDrag.start, point));
    return;
  }
  trackChasePoint(point);
}

function endSelectDrag(event) {
  if (!selectRun || !selectDrag || event.pointerId !== selectDrag.pointerId) return;
  const drag = selectDrag;
  selectDrag = null;
  const point = arenaPoint(event);
  const rect = selectionRect(drag.start, point);
  showSelectionBox(rect);
  evaluateSelectBox(drag.start, point, rect);
  selectArena.releasePointerCapture(event.pointerId);
}

function evaluateSelectBox(start, end, rect) {
  const round = selectRun.round;
  if (!round) return;
  selectRun.boxAttempts += 1;
  const allSelected = round.greens.every((target) => containsPoint(rect, target));
  round.boxReady = allSelected;
  if (!allSelected) {
    selectRun.misses += 1;
    selectBox.classList.add("failed");
    clearSelectedGreens();
    lockRedTarget();
    updateSelectMetrics();
    return;
  }
  selectRun.boxSuccesses += 1;
  round.releasePoint = end;
  round.chasePath = [end];
  round.directionScore = selectDirectionScore(start, end, round.greenCenter, round.red);
  markSelectedGreens();
  unlockRedTarget();
  updateSelectMetrics();
}

function clickSelectRed(event) {
  const red = event.target.closest(".select-target.red");
  if (!selectRun || !red) return;
  event.stopPropagation();
  const round = selectRun.round;
  if (!round?.boxReady) {
    selectRun.misses += 1;
    updateSelectMetrics();
    return;
  }
  const hitPoint = arenaPoint(event);
  const pathScore = selectPathScore(round.releasePoint, hitPoint, [...round.chasePath, hitPoint]);
  selectRun.successes += 1;
  selectRun.completionTimes.push(performance.now() - round.startedAt);
  selectRun.directionScores.push(round.directionScore);
  selectRun.pathScores.push(pathScore);
  if (selectRun.settings.hitSound) playSelectHitSound();
  spawnSelectRound();
  updateSelectMetrics();
}

function missSelectArena(event) {
  if (!selectRun || selectDrag || event.target.closest(".select-target.red")) return;
  selectRun.misses += 1;
  updateSelectMetrics();
}

function trackChasePoint(point) {
  const round = selectRun?.round;
  if (!round?.boxReady || !round.releasePoint) return;
  const last = round.chasePath[round.chasePath.length - 1];
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= 2) {
    round.chasePath.push(point);
  }
}

function finishSelectTraining(showResult) {
  if (!selectRun) return;
  const completedRun = selectRun;
  completedRun.finishedAt = performance.now();
  selectRun = null;
  selectDrag = null;
  window.cancelAnimationFrame(selectChallengeFrame);
  selectChallengeFrame = 0;
  selectRoundLayer.innerHTML = "";
  hideSelectionBox();
  selectState.textContent = "待开始";
  selectMessage.hidden = false;
  if (!showResult) {
    updateSelectMetrics();
    return;
  }
  showSelectResult(completedRun);
  updateSelectMetrics(completedRun);
}

function showSelectResult(run) {
  const boxRate = rate(run.boxSuccesses, run.boxAttempts);
  const averageTime = averageSelect(run.completionTimes);
  const directionRate = averageSelect(run.directionScores);
  const pathRate = averageSelect(run.pathScores);
  selectResultHits.textContent = String(run.successes);
  selectResultMisses.textContent = String(run.misses);
  selectResultBox.textContent = run.boxAttempts ? formatSelectPercent(boxRate) : "--";
  selectResultAverage.textContent = run.completionTimes.length ? formatSelectMs(averageTime) : "--";
  selectResultDirection.textContent = run.directionScores.length ? formatSelectPercent(directionRate) : "--";
  selectResultPath.textContent = run.pathScores.length ? formatSelectPercent(pathRate) : "--";
  selectResultRate.textContent = run.mode === "challenge" ? formatSelectRate(correctSelectRate(run)) : "--";
  if (run.mode === "challenge") {
    keepSelectChallengeRecord(run, boxRate, directionRate, pathRate, averageTime);
  }
  selectSummary.textContent = selectDiagnosis(run, boxRate, directionRate, pathRate, averageTime);
}

function keepSelectChallengeRecord(run, boxRate, directionRate, pathRate, averageTime) {
  const result = window.challengeRecords.keepBetter(SELECT_CHALLENGE_RECORD_KEY, {
    successes: run.successes,
    misses: run.misses,
    boxRate,
    directionRate,
    pathRate,
    averageTime,
    rate: correctSelectRate(run),
    settings: run.settings,
  }, betterSelectRecord);
  renderSelectChallengeRecord(result.record, result.improved);
}

function betterSelectRecord(candidate, current) {
  if (candidate.successes !== current.successes) return candidate.successes > current.successes;
  if (candidate.boxRate !== current.boxRate) return candidate.boxRate > current.boxRate;
  if (candidate.pathRate !== current.pathRate) return candidate.pathRate > current.pathRate;
  return candidate.averageTime < current.averageTime;
}

function renderSelectChallengeRecord(record = window.challengeRecords.get(SELECT_CHALLENGE_RECORD_KEY), improved = false) {
  if (!record) {
    selectBestRecord.textContent = "本机最佳：--";
    return;
  }
  const prefix = improved ? "新纪录" : "本机最佳";
  selectBestRecord.textContent = `${prefix}：成功 ${record.successes} 回合 · 框选 ${formatSelectPercent(record.boxRate)} · ${formatSelectRate(record.rate)}`;
}

function selectDiagnosis(run, boxRate, directionRate, pathRate, averageTime) {
  if (run.mode === "challenge") {
    return `30 秒挑战完成：成功 ${run.successes} 回合，框选成功率 ${formatSelectPercent(boxRate)}，正确回合速 ${formatSelectRate(correctSelectRate(run))}。`;
  }
  if (!run.successes) {
    return "还没有完成一个框选到红点的回合。先让拖框稳定包住全部绿点。";
  }
  if (boxRate < 0.8) {
    return `平均完成 ${formatSelectMs(averageTime)}。当前先补框选覆盖，成功率 ${formatSelectPercent(boxRate)} 还会拖慢后续红点。`;
  }
  if (directionRate < 0.68) {
    return `框选覆盖已经较稳。方向顺势 ${formatSelectPercent(directionRate)}，可以多从红点一侧结束拖框。`;
  }
  if (pathRate < 0.82) {
    return `方向已经顺，释放到红点的路径效率 ${formatSelectPercent(pathRate)}，还有回头路可省。`;
  }
  return `平均完成 ${formatSelectMs(averageTime)}，方向和红点衔接都比较直接。`;
}

function updateSelectMetrics(completedRun = null) {
  const run = selectRun ?? completedRun;
  if (!run) {
    selectHitMetric.textContent = "0";
    selectBoxMetric.textContent = "--";
    selectDirectionMetric.textContent = "--";
    selectPathMetric.textContent = "--";
    selectTimeMetric.textContent = "--";
    return;
  }
  selectHitMetric.textContent = String(run.successes);
  selectBoxMetric.textContent = run.boxAttempts ? formatSelectPercent(rate(run.boxSuccesses, run.boxAttempts)) : "--";
  selectDirectionMetric.textContent = run.directionScores.length ? formatSelectPercent(averageSelect(run.directionScores)) : "--";
  selectPathMetric.textContent = run.pathScores.length ? formatSelectPercent(averageSelect(run.pathScores)) : "--";
  selectTimeMetric.textContent = selectRun?.mode === "challenge"
    ? formatSelectSeconds(Math.max(0, run.endsAt - performance.now()))
    : "--";
}

function runSelectChallengeClock(now = performance.now()) {
  if (!selectRun) return;
  if (selectRun.mode === "challenge" && now >= selectRun.endsAt) {
    finishSelectTraining(true);
    return;
  }
  updateSelectMetrics();
  selectChallengeFrame = window.requestAnimationFrame(runSelectChallengeClock);
}

function selectDirectionScore(start, end, greenCenter, red) {
  const dragVector = { x: end.x - start.x, y: end.y - start.y };
  const redVector = { x: red.x - greenCenter.x, y: red.y - greenCenter.y };
  const dragLength = Math.hypot(dragVector.x, dragVector.y);
  const redLength = Math.hypot(redVector.x, redVector.y);
  if (dragLength < 8 || redLength < 8) return 0;
  return Math.max(0, (dragVector.x * redVector.x + dragVector.y * redVector.y) / (dragLength * redLength));
}

function selectPathScore(start, end, path) {
  const straight = Math.hypot(end.x - start.x, end.y - start.y);
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    walked += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return walked ? Math.min(1, straight / walked) : 1;
}

function selectionRect(start, end) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

function showSelectionBox(rect) {
  selectBox.hidden = false;
  selectBox.style.left = `${rect.left}px`;
  selectBox.style.top = `${rect.top}px`;
  selectBox.style.width = `${rect.width}px`;
  selectBox.style.height = `${rect.height}px`;
}

function hideSelectionBox() {
  selectBox.hidden = true;
  selectBox.classList.remove("failed");
}

function containsPoint(rect, point) {
  return point.x >= rect.left && point.x <= rect.left + rect.width
    && point.y >= rect.top && point.y <= rect.top + rect.height;
}

function markSelectedGreens() {
  selectRoundLayer.querySelectorAll('.select-target[data-kind="green"]').forEach((target) => target.classList.add("selected"));
}

function clearSelectedGreens() {
  selectRoundLayer.querySelectorAll('.select-target[data-kind="green"]').forEach((target) => target.classList.remove("selected"));
}

function unlockRedTarget() {
  selectRoundLayer.querySelector(".select-target.red")?.classList.remove("locked");
}

function lockRedTarget() {
  selectRoundLayer.querySelector(".select-target.red")?.classList.add("locked");
}

function rangedBounds(width, height, padding, spawnRange) {
  const minimumPad = Math.min(padding, width * 0.42, height * 0.42);
  const rangeWidth = Math.max(24, (width - minimumPad * 2) * spawnRange);
  const rangeHeight = Math.max(24, (height - minimumPad * 2) * spawnRange);
  return {
    minX: Math.max(minimumPad, width / 2 - rangeWidth / 2),
    maxX: Math.min(width - minimumPad, width / 2 + rangeWidth / 2),
    minY: Math.max(minimumPad, height / 2 - rangeHeight / 2),
    maxY: Math.min(height - minimumPad, height / 2 + rangeHeight / 2),
  };
}

function averagePoint(points) {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function clampPoint(point, rect, padding) {
  return {
    x: Math.min(rect.width - padding, Math.max(padding, point.x)),
    y: Math.min(rect.height - padding, Math.max(padding, point.y)),
  };
}

function arenaPoint(event) {
  const rect = selectArena.getBoundingClientRect();
  return {
    x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
    y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
  };
}

function playSelectHitSound() {
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return;
  selectAudioContext ??= new AudioContext();
  selectAudioContext.resume().catch(() => {});
  const startAt = selectAudioContext.currentTime;
  const oscillator = selectAudioContext.createOscillator();
  const gain = selectAudioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(760, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(1280, startAt + 0.052);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.082);
  oscillator.connect(gain).connect(selectAudioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.084);
}

async function toggleSelectFullscreen() {
  if (document.fullscreenElement === selectArena) {
    await document.exitFullscreen();
    return;
  }
  await selectArena.requestFullscreen();
}

function syncSelectFullscreen() {
  const fullscreen = document.fullscreenElement === selectArena;
  selectFullscreenButton.classList.toggle("is-active", fullscreen);
  selectFullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  selectFullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
}

function rate(value, total) { return total ? value / total : 0; }
function averageSelect(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function correctSelectRate(run) { return run.successes / Math.max(0.001, elapsedSelectTime(run) / 1000); }
function elapsedSelectTime(run) {
  const elapsed = Math.max(0, (run.finishedAt ?? performance.now()) - run.startedAt);
  return run.mode === "challenge" ? Math.min(30000, elapsed) : elapsed;
}
function formatSelectMs(value) { return value ? `${Math.round(value)}ms` : "--"; }
function formatSelectPercent(value) { return `${Math.round(value * 100)}%`; }
function formatSelectRate(value) { return `${value.toFixed(2)}/s`; }
function formatSelectSeconds(value) { return `${(value / 1000).toFixed(1)}s`; }
function randomSelectPoint(bounds) { return { x: randomSelectBetween(bounds.minX, bounds.maxX), y: randomSelectBetween(bounds.minY, bounds.maxY) }; }
function randomSelectBetween(min, max) { return Math.random() * (max - min) + min; }

selectStartButton.addEventListener("click", () => startSelectTraining("free"));
selectChallengeButton.addEventListener("click", () => startSelectTraining("challenge"));
selectStopButton.addEventListener("click", () => finishSelectTraining(true));
selectFullscreenButton.addEventListener("click", () => {
  toggleSelectFullscreen().catch(() => {
    selectSummary.textContent = "浏览器没有允许全屏。可以再点一次全屏按钮，或保持窗口最大化训练。";
  });
});
selectArena.addEventListener("pointerdown", beginSelectDrag);
selectArena.addEventListener("pointermove", moveSelectPointer);
selectArena.addEventListener("pointerup", endSelectDrag);
selectArena.addEventListener("pointercancel", endSelectDrag);
selectArena.addEventListener("click", missSelectArena);
selectRoundLayer.addEventListener("click", clickSelectRed);
[selectCountInput, selectSizeInput, selectSpreadInput, selectRedDistanceInput, selectAreaInput].forEach((input) => input.addEventListener("input", syncSelectOutputs));
document.addEventListener("fullscreenchange", syncSelectFullscreen);

syncSelectOutputs();
updateSelectMetrics();
syncSelectFullscreen();
renderSelectChallengeRecord();
