const arena = document.querySelector("#arena");
const canvas = document.querySelector("#traceCanvas");
const context = canvas.getContext("2d");
const anchor = document.querySelector("#anchor");
const targetLayer = document.querySelector("#targetLayer");
const arenaMessage = document.querySelector("#arenaMessage");
const trialBadge = document.querySelector("#trialBadge");
const startRunButton = document.querySelector("#startRunButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
const stopRunButton = document.querySelector("#stopRunButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const profileNameInput = document.querySelector("#profileNameInput");
const dpiInput = document.querySelector("#dpiInput");
const sensitivityInput = document.querySelector("#sensitivityInput");
const roundCountInput = document.querySelector("#roundCountInput");
const targetSizeInput = document.querySelector("#targetSizeInput");
const jumpScaleInput = document.querySelector("#jumpScaleInput");
const spawnRangeInput = document.querySelector("#spawnRangeInput");
const showTraceInput = document.querySelector("#showTraceInput");
const pathEfficiencyInput = document.querySelector("#pathEfficiencyInput");
const hitRateInput = document.querySelector("#hitRateInput");
const tripleTargetInput = document.querySelector("#tripleTargetInput");
const roundCountOutput = document.querySelector("#roundCountOutput");
const targetSizeOutput = document.querySelector("#targetSizeOutput");
const jumpScaleOutput = document.querySelector("#jumpScaleOutput");
const spawnRangeOutput = document.querySelector("#spawnRangeOutput");
const runState = document.querySelector("#runState");
const progressValue = document.querySelector("#progressValue");
const directValue = document.querySelector("#directValue");
const overshootValue = document.querySelector("#overshootValue");
const correctionValue = document.querySelector("#correctionValue");
const pathEfficiencyMetric = document.querySelector("#pathEfficiencyMetric");
const pathEfficiencyValue = document.querySelector("#pathEfficiencyValue");
const hitRateMetric = document.querySelector("#hitRateMetric");
const hitRateValue = document.querySelector("#hitRateValue");
const diagnosisText = document.querySelector("#diagnosisText");
const trialLabelValue = document.querySelector("#trialLabelValue");
const firstErrorValue = document.querySelector("#firstErrorValue");
const trialTimeValue = document.querySelector("#trialTimeValue");
const repairCountValue = document.querySelector("#repairCountValue");
const trialPathEfficiencyDetail = document.querySelector("#trialPathEfficiencyDetail");
const trialPathEfficiencyValue = document.querySelector("#trialPathEfficiencyValue");
const trialHitDetail = document.querySelector("#trialHitDetail");
const trialHitValue = document.querySelector("#trialHitValue");
const historyList = document.querySelector("#historyList");
const legend = document.querySelector(".legend");
const preciseRateValue = document.querySelector("#preciseRateValue");
const preciseTotalTimeValue = document.querySelector("#preciseTotalTimeValue");
const preciseRepairTimeValue = document.querySelector("#preciseRepairTimeValue");
const earlyBrakeRateValue = document.querySelector("#earlyBrakeRateValue");
const earlyBrakeTotalTimeValue = document.querySelector("#earlyBrakeTotalTimeValue");
const earlyBrakeRepairTimeValue = document.querySelector("#earlyBrakeRepairTimeValue");
const overshootRateTableValue = document.querySelector("#overshootRateTableValue");
const overshootTotalTimeValue = document.querySelector("#overshootTotalTimeValue");
const overshootRepairTimeValue = document.querySelector("#overshootRepairTimeValue");
const compareNote = document.querySelector("#compareNote");

const STORAGE_KEY = "first-movement-calibration-history";
const jumpNames = ["近距", "均衡", "远距"];
const distancesByScale = [
  [150, 250, 320],
  [190, 310, 450],
  [260, 410, 590],
];
const directions = Array.from({ length: 8 }, (_, index) => (Math.PI / 4) * index);

let run = null;
let trial = null;
let history = loadHistory();
let badgeTimer = null;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
}

function getSettings() {
  return {
    profileName: profileNameInput.value.trim() || "未命名方案",
    dpi: Number(dpiInput.value) || 0,
    sensitivity: Number(sensitivityInput.value) || 0,
    rounds: Number(roundCountInput.value),
    targetSize: Number(targetSizeInput.value),
    jumpScale: Number(jumpScaleInput.value),
    spawnRange: Number(spawnRangeInput.value) / 100,
    showTrace: showTraceInput.checked,
    pathEfficiency: pathEfficiencyInput.checked,
    showHitRate: hitRateInput.checked,
    tripleTargets: tripleTargetInput.checked,
  };
}

function syncOutputs() {
  roundCountOutput.textContent = roundCountInput.value;
  targetSizeOutput.textContent = `${targetSizeInput.value}px`;
  jumpScaleOutput.textContent = jumpNames[Number(jumpScaleInput.value)];
  spawnRangeOutput.textContent = `${spawnRangeInput.value}%`;
  legend.classList.toggle("is-muted", !showTraceInput.checked);
  syncPathEfficiencyVisibility(pathEfficiencyInput.checked);
  syncHitRateVisibility(hitRateInput.checked);
  if (!run) {
    progressValue.textContent = `0 / ${roundCountInput.value}`;
  }
}

function startRun() {
  finishRun(false);
  resizeCanvas();
  const settings = getSettings();
  run = {
    settings,
    results: [],
  };
  runState.textContent = "测试中";
  arenaMessage.hidden = true;
  progressValue.textContent = `0 / ${settings.rounds}`;
  diagnosisText.textContent = "点绿色起点，再按第一反应点红色目标。先别刻意修正动作，测试才有意义。";
  updateRunMetrics();
  prepareAnchor();
  arena.focus();
}

async function toggleFullscreen() {
  if (document.fullscreenElement === arena) {
    await document.exitFullscreen();
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
  await arena.requestFullscreen();
}

function syncFullscreenState() {
  const fullscreen = document.fullscreenElement === arena;
  fullscreenButton.classList.toggle("is-active", fullscreen);
  fullscreenButton.ariaLabel = fullscreen ? "点击区域已全屏，按 Esc 退出" : "点击区域全屏";
  fullscreenButton.title = fullscreen ? "按 Esc 退出全屏" : "点击区域全屏";
  window.setTimeout(() => {
    resizeCanvas();
    if (run && trial?.state === "anchor") {
      prepareAnchor();
    }
  }, 0);
}

function prepareAnchor() {
  if (!run) {
    return;
  }

  trial = {
    state: "anchor",
    samples: [],
    sequenceResults: [],
  };
  clearCanvas();
  clearTargets();
  const point = centralPoint();
  trial.anchor = point;
  setDot(anchor, point, run.settings.targetSize);
  anchor.hidden = false;
}

function centralPoint() {
  const rect = arena.getBoundingClientRect();
  const swayX = Math.min(90, rect.width * 0.12);
  const swayY = Math.min(72, rect.height * 0.12);
  return {
    x: rect.width / 2 + randomBetween(-swayX, swayX),
    y: rect.height / 2 + randomBetween(-swayY, swayY),
  };
}

function beginTrial(event) {
  if (!run || trial?.state !== "anchor") {
    return;
  }

  event.stopPropagation();
  trial.state = "target";
  trial.startedAt = performance.now();
  trial.targets = targetPoints(trial.anchor);
  trial.activeOrigin = trial.anchor;
  trial.activeStartedAt = trial.startedAt;
  trial.samples = [{ ...trial.anchor, time: trial.startedAt }];
  anchor.hidden = true;
  renderTargets(trial.targets);
  updateProgress();
}

function targetPoints(origin) {
  const count = run.settings.tripleTargets ? 3 : 1;
  const points = [];
  for (let index = 0; index < count; index += 1) {
    points.push(targetPoint(origin, points));
  }
  return points;
}

function targetPoint(origin, existingPoints = []) {
  const bounds = spawnBounds();
  const pool = distancesByScale[run.settings.jumpScale];

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const angle = directions[Math.floor(Math.random() * directions.length)];
    const distance = pool[Math.floor(Math.random() * pool.length)];
    const candidate = {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
    };

    const farFromOtherTargets = existingPoints.every((point) => distanceBetween(point, candidate) > run.settings.targetSize * 2.25);
    if (
      farFromOtherTargets &&
      pointInBounds(candidate, bounds)
    ) {
      return candidate;
    }
  }

  return {
    x: clamp(bounds.centerX + (bounds.centerX - origin.x), bounds.minX, bounds.maxX),
    y: clamp(bounds.centerY + (bounds.centerY - origin.y), bounds.minY, bounds.maxY),
  };
}

function spawnBounds() {
  const rect = arena.getBoundingClientRect();
  const padding = run.settings.targetSize + 28;
  const range = run.settings.spawnRange;
  const width = Math.max(run.settings.targetSize * 3, (rect.width - padding * 2) * range);
  const height = Math.max(run.settings.targetSize * 3, (rect.height - padding * 2) * range);
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  return {
    centerX,
    centerY,
    minX: Math.max(padding, centerX - width / 2),
    maxX: Math.min(rect.width - padding, centerX + width / 2),
    minY: Math.max(padding, centerY - height / 2),
    maxY: Math.min(rect.height - padding, centerY + height / 2),
  };
}

function pointInBounds(point, bounds) {
  return point.x > bounds.minX && point.x < bounds.maxX && point.y > bounds.minY && point.y < bounds.maxY;
}

function renderTargets(points) {
  clearTargets();
  points.forEach((point, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "target";
    button.dataset.targetIndex = String(index);
    button.ariaLabel = points.length > 1 ? `点击目标 ${index + 1}` : "点击目标";
    button.innerHTML = "<span></span>";
    setDot(button, point, run.settings.targetSize);
    targetLayer.append(button);
  });
}

function clearTargets() {
  targetLayer.innerHTML = "";
}

function removeTarget(targetIndex) {
  trial.targets.splice(targetIndex, 1);
  targetLayer.querySelector(`[data-target-index="${targetIndex}"]`)?.remove();
  targetLayer.querySelectorAll(".target").forEach((button, index) => {
    button.dataset.targetIndex = String(index);
    button.ariaLabel = trial.targets.length > 1 ? `点击目标 ${index + 1}` : "点击目标";
  });
}

function collectSample(event) {
  if (!run || trial?.state !== "target") {
    return;
  }

  const point = eventPoint(event);
  const lastPoint = trial.samples.at(-1);
  if (!lastPoint || distanceBetween(lastPoint, point) > 1.2) {
    trial.samples.push({ ...point, time: performance.now() });
    drawLiveTrace();
  }
}

function completeTrial(event, targetIndex) {
  if (!run || trial?.state !== "target") {
    return;
  }

  event.stopPropagation();
  trial.target = trial.targets[targetIndex];
  const clickPoint = eventPoint(event);
  trial.samples.push({ ...clickPoint, time: performance.now() });
  const result = analyzeTrial(
    {
      ...trial,
      anchor: trial.activeOrigin,
      startedAt: trial.activeStartedAt,
    },
    clickPoint,
  );
  run.results.push(result);
  trial.sequenceResults.push(result);
  showTrial(result);
  updateRunMetrics();
  removeTarget(targetIndex);

  if (run.settings.tripleTargets && trial.targets.length) {
    trial.activeOrigin = clickPoint;
    trial.activeStartedAt = performance.now();
    trial.samples = [{ ...clickPoint, time: trial.activeStartedAt }];
    updateProgress();
    return;
  }

  updateProgress();

  if (completedRounds() >= run.settings.rounds) {
    finishRun(true);
    return;
  }

  window.setTimeout(prepareAnchor, 420);
}

function analyzeTrial(currentTrial, clickPoint) {
  const samples = currentTrial.samples;
  const origin = currentTrial.anchor;
  const destination = currentTrial.target;
  const axis = unitVector(origin, destination);
  const jumpDistance = distanceBetween(origin, destination);
  const targetRadius = run.settings.targetSize / 2;
  const enriched = samples.map((sample, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const duration = Math.max(1, sample.time - previous.time);
    const progress = project(origin, sample, axis);
    return {
      ...sample,
      progress,
      speed: distanceBetween(previous, sample) / duration,
    };
  });
  const highestSpeed = Math.max(...enriched.map((sample) => sample.speed), 0);
  const firstSlowdown = findFirstSlowdown(enriched, highestSpeed, jumpDistance, targetRadius);
  const reversals = findReversals(enriched, jumpDistance, targetRadius);
  const maxProgress = Math.max(...enriched.map((sample) => sample.progress));
  const crossedTarget = maxProgress > jumpDistance + targetRadius * 0.32;
  const repairedAfterCross = enriched.at(-1).progress < maxProgress - targetRadius * 0.35;
  const overshoot = crossedTarget && repairedAfterCross;
  const earlyBrake = !overshoot && Boolean(firstSlowdown);
  const correctionStart = overshoot
    ? reversals[0]?.time
    : firstSlowdown?.time;
  const firstStop = overshoot
    ? reversals[0] ?? firstSlowdown ?? enriched.at(-1)
    : firstSlowdown ?? reversals[0] ?? enriched.at(-1);
  const hit = distanceBetween(clickPoint, destination) <= targetRadius;
  const idealPathLength = distanceBetween(origin, clickPoint);
  const pathLength = traceLength(enriched);
  const pathEfficiency = pathLength ? Math.min(1, idealPathLength / pathLength) : 0;
  const precise = !overshoot && !earlyBrake && hit && reversals.length === 0;
  const label = overshoot
    ? "过冲后拉回"
    : earlyBrake
      ? "提前刹车补推"
      : precise
        ? "首段干净"
        : "轻微修正";

  return {
    label,
    kind: overshoot ? "overshoot" : earlyBrake ? "early-brake" : precise ? "clean" : "repair",
    hit,
    totalTime: enriched.at(-1).time - currentTrial.startedAt,
    correctionTime: correctionStart ? enriched.at(-1).time - correctionStart : 0,
    correctionCount: reversals.length + Number(earlyBrake),
    firstError: Math.abs(jumpDistance - firstStop.progress),
    idealPathLength,
    pathLength,
    pathEfficiency,
    firstStop,
    samples: enriched,
    target: destination,
    origin,
  };
}

function findFirstSlowdown(samples, highestSpeed, jumpDistance, targetRadius) {
  if (!highestSpeed) {
    return null;
  }

  let sawFastMovement = false;
  for (const sample of samples) {
    if (sample.speed >= highestSpeed * 0.72) {
      sawFastMovement = true;
    }
    const beforeTarget = sample.progress < jumpDistance - targetRadius * 1.45;
    if (sawFastMovement && beforeTarget && sample.speed <= highestSpeed * 0.28) {
      return sample;
    }
  }
  return null;
}

function findReversals(samples, jumpDistance, targetRadius) {
  const reversals = [];
  let direction = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const delta = samples[index].progress - samples[index - 1].progress;
    const nextDirection = Math.abs(delta) < 2 ? direction : Math.sign(delta);
    const meaningfulZone = samples[index].progress > targetRadius && samples[index].progress < jumpDistance + targetRadius * 3;
    if (meaningfulZone && direction > 0 && nextDirection < 0) {
      reversals.push(samples[index]);
    }
    direction = nextDirection || direction;
  }
  return reversals;
}

function updateRunMetrics() {
  const results = run?.results ?? [];
  const finished = results.length;
  const clean = results.filter((result) => result.kind === "clean" && result.hit).length;
  const overshoots = results.filter((result) => result.kind === "overshoot").length;
  directValue.textContent = finished ? formatPercent(clean / finished) : "--";
  overshootValue.textContent = finished ? formatPercent(overshoots / finished) : "--";
  correctionValue.textContent = finished ? formatMs(average(results.map((result) => result.correctionTime))) : "--";
  pathEfficiencyValue.textContent = finished ? formatPercent(average(results.map((result) => result.pathEfficiency))) : "--";
  hitRateValue.textContent = finished ? formatPercent(rate(results, (result) => result.hit)) : "--";
  renderComparisonStats(results);
}

function renderComparisonStats(results) {
  const preciseStats = categoryStats(results, (result) => result.kind === "clean");
  const earlyBrakeStats = categoryStats(results, (result) => result.kind === "early-brake");
  const overshootStats = categoryStats(results, (result) => result.kind === "overshoot");
  renderComparisonRow(preciseStats, preciseRateValue, preciseTotalTimeValue, preciseRepairTimeValue);
  renderComparisonRow(earlyBrakeStats, earlyBrakeRateValue, earlyBrakeTotalTimeValue, earlyBrakeRepairTimeValue);
  renderComparisonRow(overshootStats, overshootRateTableValue, overshootTotalTimeValue, overshootRepairTimeValue);
  compareNote.textContent = buildComparisonNote(preciseStats, earlyBrakeStats, overshootStats);
}

function categoryStats(results, predicate) {
  const matches = results.filter(predicate);
  return {
    count: matches.length,
    rate: results.length ? matches.length / results.length : 0,
    averageTotalTime: average(matches.map((result) => result.totalTime)),
    averageCorrectionTime: average(matches.map((result) => result.correctionTime)),
  };
}

function renderComparisonRow(stats, rateNode, totalTimeNode, repairTimeNode) {
  rateNode.textContent = stats.count ? `${formatPercent(stats.rate)} (${stats.count})` : "--";
  totalTimeNode.textContent = stats.count ? formatMs(stats.averageTotalTime) : "--";
  repairTimeNode.textContent = stats.count ? formatMs(stats.averageCorrectionTime) : "--";
}

function buildComparisonNote(preciseStats, earlyBrakeStats, overshootStats) {
  const comparable = [
    { label: "精准点击", ...preciseStats },
    { label: "提前刹车", ...earlyBrakeStats },
    { label: "过冲拉回", ...overshootStats },
  ].filter((stats) => stats.count >= 2);

  if (comparable.length < 2) {
    return "每种动作至少出现几次后，再比较它们谁更快。";
  }

  comparable.sort((first, second) => first.averageTotalTime - second.averageTotalTime);
  return `当前样本里 ${comparable[0].label} 的平均整体耗时更短。对比时同时看比例，避免只追求偶发最快。`;
}

function completedRounds() {
  if (!run) {
    return 0;
  }
  const clicksPerRound = run.settings.tripleTargets ? 3 : 1;
  return Math.floor(run.results.length / clicksPerRound);
}

function updateProgress() {
  if (!run) {
    return;
  }

  if (!run.settings.tripleTargets) {
    progressValue.textContent = `${run.results.length} / ${run.settings.rounds}`;
    return;
  }

  const roundNumber = Math.min(run.settings.rounds, completedRounds() + Number(Boolean(trial?.targets?.length)));
  const sequenceClicks = trial?.sequenceResults?.length ?? 0;
  progressValue.textContent = `${roundNumber} / ${run.settings.rounds} · 本轮 ${sequenceClicks} / 3`;
}

function showTrial(result) {
  trialLabelValue.textContent = result.label;
  firstErrorValue.textContent = formatPx(result.firstError);
  trialTimeValue.textContent = formatMs(result.totalTime);
  repairCountValue.textContent = String(result.correctionCount);
  trialPathEfficiencyValue.textContent = formatPercent(result.pathEfficiency);
  trialHitValue.textContent = result.hit ? "命中" : "未命中";
  drawResultTrace(result);
  showBadge(`${result.label} · 首段误差 ${formatPx(result.firstError)}`, result.kind);
}

function finishRun(storeResult) {
  if (!run) {
    return;
  }

  const finishedRun = run;
  const resultCount = finishedRun.results.length;
  run = null;
  trial = null;
  anchor.hidden = true;
  clearTargets();
  runState.textContent = "待开始";
  arenaMessage.hidden = false;

  if (!storeResult || resultCount < 4) {
    syncOutputs();
    return;
  }

  const summary = summarizeRun(finishedRun);
  history.unshift(summary);
  history = history.slice(0, 8);
  saveHistory();
  renderHistory();
  diagnosisText.textContent = buildDiagnosis(summary);
}

function summarizeRun(finishedRun) {
  const results = finishedRun.results;
  const clicksPerRound = finishedRun.settings.tripleTargets ? 3 : 1;
  return {
    ...finishedRun.settings,
    trials: Math.ceil(results.length / clicksPerRound),
    clickSamples: results.length,
    cleanRate: rate(results, (result) => result.kind === "clean" && result.hit),
    overshootRate: rate(results, (result) => result.kind === "overshoot"),
    earlyBrakeRate: rate(results, (result) => result.kind === "early-brake"),
    hitRate: rate(results, (result) => result.hit),
    averageFirstError: average(results.map((result) => result.firstError)),
    averageCorrectionTime: average(results.map((result) => result.correctionTime)),
    averagePathEfficiency: average(results.map((result) => result.pathEfficiency)),
    comparison: {
      precise: categoryStats(results, (result) => result.kind === "clean"),
      earlyBrake: categoryStats(results, (result) => result.kind === "early-brake"),
      overshoot: categoryStats(results, (result) => result.kind === "overshoot"),
    },
    createdAt: Date.now(),
  };
}

function buildDiagnosis(summary) {
  const pathResult = buildPathEfficiencyResult(summary);
  const hitResult = buildHitRateResult(summary);
  if (summary.overshootRate >= 0.36) {
    return `${summary.profileName} 的过冲拉回占 ${formatPercent(summary.overshootRate)}，平均修正耗时 ${formatMs(summary.averageCorrectionTime)}。${hitResult}${pathResult}先用游戏灵敏度下调 8% 到 12% 做一组对照。`;
  }
  if (summary.earlyBrakeRate >= 0.36) {
    return `${summary.profileName} 的提前刹车补推占 ${formatPercent(summary.earlyBrakeRate)}。${hitResult}${pathResult}如果你感觉手要拖着走，再用游戏灵敏度上调 5% 到 10% 做对照。`;
  }
  if (summary.cleanRate >= 0.55 && summary.hitRate >= 0.8) {
    return `${summary.profileName} 的首段落点比较干净：直接完成 ${formatPercent(summary.cleanRate)}。${hitResult}${pathResult}可以保留它，再测一个略低候选确认稳定性。`;
  }
  return `${summary.profileName} 暂时没有单一倾向。${hitResult}${pathResult}先复测一组，重点看首段误差 ${formatPx(summary.averageFirstError)} 和修正耗时 ${formatMs(summary.averageCorrectionTime)} 是否稳定。`;
}

function buildPathEfficiencyResult(summary) {
  if (summary.pathEfficiency === false || !Number.isFinite(summary.averagePathEfficiency)) {
    return "";
  }
  return `平均轨迹效率 ${formatPercent(summary.averagePathEfficiency)}。`;
}

function buildHitRateResult(summary) {
  if (summary.showHitRate === false || !Number.isFinite(summary.hitRate)) {
    return "";
  }
  return `命中率 ${formatPercent(summary.hitRate)}。`;
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "还没有完成的测试组。";
    historyList.append(empty);
    return;
  }

  history.forEach((summary) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = `${summary.profileName} · ${summary.dpi} DPI / 游戏 ${summary.sensitivity}`;
    const targetMode = summary.tripleTargets ? "三连靶" : "单靶";
    const traceVisible = summary.showTrace ?? !summary.hideTrace;
    const traceMode = traceVisible ? "显示线" : "隐藏线";
    const sampleText = summary.tripleTargets ? `${summary.trials} 轮 / ${summary.clickSamples} 次点击` : `${summary.trials} 轮`;
    const pathText = summary.pathEfficiency !== false && Number.isFinite(summary.averagePathEfficiency)
      ? ` · 轨迹效率 ${formatPercent(summary.averagePathEfficiency)}`
      : "";
    const hitText = summary.showHitRate !== false && Number.isFinite(summary.hitRate)
      ? ` · 命中率 ${formatPercent(summary.hitRate)}`
      : "";
    detail.textContent = `${sampleText} · ${targetMode} / ${traceMode} · 首段干净 ${formatPercent(summary.cleanRate)} · 过冲 ${formatPercent(summary.overshootRate)} · 提前刹车 ${formatPercent(summary.earlyBrakeRate)} · 首段误差 ${formatPx(summary.averageFirstError)}${hitText}${pathText}`;
    item.append(title, detail);
    historyList.append(item);
  });
}

function showBadge(text, kind) {
  window.clearTimeout(badgeTimer);
  trialBadge.className = `trial-badge ${kind}`;
  trialBadge.textContent = text;
  trialBadge.hidden = false;
  badgeTimer = window.setTimeout(() => {
    trialBadge.hidden = true;
  }, 1600);
}

function drawLiveTrace() {
  clearCanvas();
  if (!run.settings.showTrace) {
    return;
  }
  drawPolyline(trial.samples, "rgba(102, 185, 255, 0.8)", 2.5);
}

function drawResultTrace(result) {
  clearCanvas();
  if (!run.settings.showTrace) {
    return;
  }
  const firstStopIndex = Math.max(1, result.samples.indexOf(result.firstStop));
  drawPolyline(result.samples.slice(0, firstStopIndex + 1), "rgba(102, 185, 255, 0.95)", 2.8);
  drawPolyline(result.samples.slice(firstStopIndex), "rgba(255, 102, 118, 0.9)", 2.8);
  drawMarker(result.firstStop, "#ffc969", 7);
  drawMarker(result.origin, "#68e0a7", 5);
  drawMarker(result.target, "#ff6676", 5);
}

function drawPolyline(points, color, width) {
  if (!points || points.length < 2) {
    return;
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.stroke();
}

function drawMarker(point, color, radius) {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function resizeCanvas() {
  const rect = arena.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * pixelRatio);
  canvas.height = Math.round(rect.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  clearCanvas();
}

function clearCanvas() {
  const rect = arena.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
}

function setDot(element, point, size) {
  element.style.setProperty("--dot-size", `${size}px`);
  element.style.left = `${point.x}px`;
  element.style.top = `${point.y}px`;
}

function eventPoint(event) {
  const rect = arena.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function unitVector(from, to) {
  const length = Math.max(1, distanceBetween(from, to));
  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
  };
}

function project(origin, point, axis) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function traceLength(points) {
  return points.slice(1).reduce((length, point, index) => {
    return length + distanceBetween(points[index], point);
  }, 0);
}

function syncPathEfficiencyVisibility(enabled) {
  pathEfficiencyMetric.hidden = !enabled;
  trialPathEfficiencyDetail.hidden = !enabled;
}

function syncHitRateVisibility(enabled) {
  hitRateMetric.hidden = !enabled;
  trialHitDetail.hidden = !enabled;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(values, predicate) {
  return values.length ? values.filter(predicate).length / values.length : 0;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatMs(value) {
  return value ? `${Math.round(value)}ms` : "--";
}

function formatPx(value) {
  return Number.isFinite(value) ? `${Math.round(value)}px` : "--";
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function randomBetween(minimum, maximum) {
  return Math.random() * (maximum - minimum) + minimum;
}

anchor.addEventListener("pointerdown", beginTrial);
targetLayer.addEventListener("pointerdown", (event) => {
  const clickedTarget = event.target.closest(".target");
  if (!clickedTarget) {
    return;
  }
  completeTrial(event, Number(clickedTarget.dataset.targetIndex));
});
arena.addEventListener("pointermove", collectSample);
startRunButton.addEventListener("click", startRun);
fullscreenButton.addEventListener("click", () => {
  toggleFullscreen().catch(() => {
    showBadge("浏览器未允许全屏，请再点一次全屏按钮", "early-brake");
  });
});
stopRunButton.addEventListener("click", () => finishRun(true));
clearHistoryButton.addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
});

[roundCountInput, targetSizeInput, jumpScaleInput, spawnRangeInput, showTraceInput, pathEfficiencyInput, hitRateInput].forEach((input) => {
  input.addEventListener("input", syncOutputs);
});

window.addEventListener("resize", () => {
  resizeCanvas();
  if (run && trial?.state === "anchor") {
    prepareAnchor();
  }
});
document.addEventListener("fullscreenchange", syncFullscreenState);

resizeCanvas();
syncOutputs();
syncFullscreenState();
renderHistory();
