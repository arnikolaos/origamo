const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const modeLabel = document.getElementById("modeLabel");
const pointsLabel = document.getElementById("pointsLabel");
const signalLabel = document.getElementById("signalLabel");
const volumeControl = document.getElementById("volumeControl");

const TAU = Math.PI * 2;
const SUBTLETY = 0.55;
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];

const state = {
  now: performance.now(),
  bloom: 0,
  detected: null,
  rotation: 0,
  dragging: null,
  lastBurst: 0,
  sweep: { strength: 0, angle: 0 },
  lastAngles: [],
  symmetry: 0,
  lastSound: 0,
  breathing: false,
  breath: 0,
  breathScale: 1,
  dragEnergy: 0,
  portal: null,
  lastPortal: 0,
  symmetryHold: 0,
  calm: 0,
  mood: 0,
  phaseBloom: 0,
  loopSettle: 0,
  lastTouch: { index: -1, t: 0 },
  lastWhisper: 0,
  fastHold: 0,
  excited: 0,
  prevExcited: 0,
  lastFlare: 0,
};

const trace = [];
const maxTrace = 900;
const bursts = [];
const sparkles = [];
const seeds = [];
const memories = [];
const maxMemories = 3;
const edgeWhispers = [];
const emissionWaves = [];
const portalWraps = [];

let width = 0;
let height = 0;
let center = { x: 0, y: 0 };
let baseStep = 60;
let speed = 90;

const shapePoints = [];
const pointTargets = [];
const pointAge = [];
const pointWobble = [];

const turtle = {
  position: { x: 0, y: 0 },
  heading: 0,
  stepIndex: 0,
  stepProgress: 0,
};

let audioCtx = null;
let masterGain = null;
let pendingVolume = Number(volumeControl.value);

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  center = { x: width * 0.5, y: height * 0.52 };
  baseStep = Math.min(width, height) * 0.07;
  speed = baseStep * 1.3;

  if (shapePoints.length === 0) {
    const radius = Math.min(width, height) * 0.18;
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * TAU - Math.PI / 2;
      shapePoints.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
      pointTargets.push(null);
      pointAge.push(999);
      pointWobble.push({ x: 0, y: 0, t: 0 });
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestEdge(point, poly) {
  let minDist = Infinity;
  let index = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const next = (i + 1) % poly.length;
    const a = poly[i];
    const b = poly[next];
    const t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
      ((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const clamped = clamp(t, 0, 1);
    const proj = { x: a.x + (b.x - a.x) * clamped, y: a.y + (b.y - a.y) * clamped };
    const d = distance(point, proj);
    if (d < minDist) {
      minDist = d;
      index = next;
    }
  }
  return { index, dist: minDist };
}

function polygonAngles(points) {
  const angles = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (mag < 1e-6) {
      angles.push(60);
      continue;
    }
    const angle = Math.acos(clamp(dot / mag, -1, 1)) * (180 / Math.PI);
    angles.push(angle);
  }
  return angles;
}

function polygonEdgeLengths(points) {
  const lengths = [];
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    lengths.push(distance(points[i], next));
  }
  return lengths;
}

function weightedAverageTurn(turns, lengths) {
  const total = lengths.reduce((sum, len) => sum + len, 0);
  const weighted = lengths.reduce((sum, len, index) => sum + len * turns[index], 0);
  return weighted / total;
}

function detectPolygon(avgTurn, tolerance = 2.5) {
  if (!Number.isFinite(avgTurn) || avgTurn <= 0) return null;
  const estimate = 360 / avgTurn;
  const rounded = Math.round(estimate);
  if (rounded < 3 || rounded > 12) return null;
  const targetTurn = 360 / rounded;
  const diff = Math.abs(avgTurn - targetTurn);
  if (diff > tolerance) return null;
  return rounded;
}

function resetTurtle() {
  turtle.position = { x: center.x + baseStep * 1.2, y: center.y };
  turtle.heading = state.rotation;
  turtle.stepIndex = 0;
  turtle.stepProgress = 0;
  trace.length = 0;
}

function angleDelta(target, source) {
  let diff = target - source;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return diff;
}

function ensureAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = pendingVolume * 0.1;
  masterGain.connect(audioCtx.destination);
}

function keyRatioForPoints(count) {
  const degree = MINOR_PENTATONIC[(count - 3) % MINOR_PENTATONIC.length];
  return Math.pow(2, degree / 12);
}

function moodForPoints(count) {
  return clamp((count - 3) / 7, 0, 1);
}

function playPulse(angle) {
  if (!audioCtx || !masterGain) return;
  if (state.now - state.lastSound < 520) return;
  state.lastSound = state.now;

  const keyRatio = keyRatioForPoints(shapePoints.length);
  const base = (150 + (angle / 180) * 180) * keyRatio;
  let partials = [1, 2.15, 2.9];
  if (state.symmetry > 0.95) {
    partials = [1];
  } else if (state.symmetry > 0.9) {
    partials = [1, 1.2, 1.333, 1.5, 1.8];
  }
  if (state.excited > 0.6) {
    partials = partials.concat([2.6]);
  }
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  const energy = clamp(state.dragEnergy, 0, 1);

  filter.type = "lowpass";
  filter.frequency.value = 900 + energy * 1200;
  filter.Q.value = 0.8;

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06 + energy * 0.05, audioCtx.currentTime + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3.0);

  partials.forEach((ratio, index) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base * ratio;
    osc.detune.value = (Math.random() - 0.5) * 12 + index * 2;
    osc.connect(filter);
    osc.start();
    osc.stop(audioCtx.currentTime + 3.2);
  });

  filter.connect(gain);
  gain.connect(masterGain);
}

function updateTurtle(delta, angles, lengths) {
  if (angles.length === 0) return;
  const currentAngle = angles[turtle.stepIndex % angles.length];
  const stepLength = lengths[turtle.stepIndex % lengths.length];
  const advance = speed * delta;
  const sweepTurn = state.sweep.strength * 0.04;
  const sweepBias = angleDelta(state.sweep.angle, turtle.heading) * state.sweep.strength * 0.02;
  turtle.heading += sweepTurn + sweepBias;
  if (state.portal) {
    const dx = state.portal.x - turtle.position.x;
    const dy = state.portal.y - turtle.position.y;
    const dist = Math.hypot(dx, dy);
    const field = state.portal.radius * 2.2;
    if (dist < field) {
      const targetAngle = Math.atan2(dy, dx);
      const pull = (1 - dist / field) * 0.025 * SUBTLETY;
      turtle.heading += angleDelta(targetAngle, turtle.heading) * pull;
    }
  }
  turtle.position.x += Math.cos(turtle.heading) * advance;
  turtle.position.y += Math.sin(turtle.heading) * advance;
  turtle.stepProgress += advance;

  if (turtle.stepProgress >= stepLength) {
    turtle.stepProgress = 0;
    turtle.heading += ((180 - currentAngle) * Math.PI) / 180;
    turtle.stepIndex = (turtle.stepIndex + 1) % angles.length;
    return currentAngle;
  }
  if (turtle.position.x < 0) {
    portalWraps.push({ x: 0, y: turtle.position.y, t: state.now, radius: 8 });
    turtle.position.x = width;
  }
  if (turtle.position.x > width) {
    portalWraps.push({ x: width, y: turtle.position.y, t: state.now, radius: 8 });
    turtle.position.x = 0;
  }
  if (turtle.position.y < 0) {
    portalWraps.push({ x: turtle.position.x, y: 0, t: state.now, radius: 8 });
    turtle.position.y = height;
  }
  if (turtle.position.y > height) {
    portalWraps.push({ x: turtle.position.x, y: height, t: state.now, radius: 8 });
    turtle.position.y = 0;
  }
  return null;
}

function clear(t) {
  const gradient = ctx.createRadialGradient(
    center.x + Math.cos(t * 0.08) * width * 0.2,
    center.y + Math.sin(t * 0.08) * height * 0.2,
    width * 0.1,
    center.x,
    center.y,
    width * 0.9
  );
  gradient.addColorStop(0, "rgba(70, 10, 48, 0.9)");
  gradient.addColorStop(0.5, "rgba(26, 3, 20, 0.95)");
  gradient.addColorStop(1, "rgba(8, 2, 8, 1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawTrace(now) {
  ctx.save();
  ctx.lineWidth = 2.4 + (state.calm * 1.5 + state.loopSettle * 1.2) * SUBTLETY;
  ctx.lineCap = "round";
    const hue = 330;
    const saturation = 80 + state.mood * 10 + state.excited * 6;
    const lightness = 58 + state.mood * 8 + state.excited * 6;
  for (let i = 1; i < trace.length; i += 1) {
    const prev = trace[i - 1];
    const current = trace[i];
    const jump = Math.hypot(current.x - prev.x, current.y - prev.y);
    if (jump > Math.min(width, height) * 0.6) continue;
    const age = (now - current.t) / 1000;
    const alpha = Math.max(0, 1 - age / 6);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();

    if (state.phaseBloom > 0) {
      const dx = current.x - prev.x;
      const dy = current.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = state.phaseBloom * 2;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness + 8}%, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(prev.x + nx * offset, prev.y + ny * offset);
      ctx.lineTo(current.x + nx * offset, current.y + ny * offset);
      ctx.stroke();
    }
    if (state.excited > 0.15) {
      const glowAlpha = Math.min(0.35, state.excited * 0.35);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(120, 205, 255, ${alpha * glowAlpha})`;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBloom(sides, alpha) {
  if (!sides || alpha <= 0) return;
  const size = baseStep * 2.2;
  const angleStep = TAU / sides;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(255, 213, 232, 0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= sides; i += 1) {
    const angle = i * angleStep - Math.PI / 2;
    const x = center.x + Math.cos(angle) * size;
    const y = center.y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  points.forEach((point) => {
    x += point.x;
    y += point.y;
  });
  return { x: x / points.length, y: y / points.length };
}

function drawDepthHull(now) {
  const centroid = polygonCentroid(shapePoints);
  const driftX = Math.cos(now * 0.0004) * 12;
  const driftY = Math.sin(now * 0.0005) * 10;
  const scale = 1.03 + Math.sin(now * 0.0006) * 0.01;
  ctx.save();
  ctx.fillStyle = "rgba(12, 3, 10, 0.55)";
  ctx.shadowColor = "rgba(255, 103, 179, 0.15)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  shapePoints.forEach((point, index) => {
    const x = centroid.x + (point.x - centroid.x) * scale + driftX;
    const y = centroid.y + (point.y - centroid.y) * scale + driftY;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhostPolygon(sides, alpha) {
  if (!sides || alpha <= 0) return;
  const size = baseStep * 2.6;
  const angleStep = TAU / sides;
  const origin = polygonCentroid(shapePoints);
  ctx.save();
  ctx.globalAlpha = alpha * 0.7;
  ctx.strokeStyle = "rgba(255, 213, 232, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= sides; i += 1) {
    const angle = i * angleStep - Math.PI / 2 + state.rotation * 0.2;
    const x = origin.x + Math.cos(angle) * size;
    const y = origin.y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSymmetryHalo(symmetry) {
  if (symmetry < 0.8) return;
  const alpha = (symmetry - 0.8) / 0.2;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 213, 232, ${alpha * 0.12 * SUBTLETY})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  shapePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawShapeField(now) {
  ctx.save();
  ctx.lineWidth = 1.2;
  const moodLight = 52 + state.mood * 10;
  ctx.strokeStyle = `hsla(330, 75%, ${moodLight}%, 0.3)`;
  ctx.beginPath();
  shapePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();

  if (state.symmetry > 0.85) {
    const edges = polygonEdgeLengths(shapePoints);
    const avgEdge = edges.reduce((sum, len) => sum + len, 0) / edges.length;
    edges.forEach((edge, index) => {
      const diff = Math.abs(edge - avgEdge) / avgEdge;
      if (diff > 0.12) return;
      const alpha = (0.12 - diff) / 0.12;
      const next = (index + 1) % shapePoints.length;
      ctx.strokeStyle = `rgba(255, 213, 232, ${alpha * 0.18 * SUBTLETY})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(shapePoints[index].x, shapePoints[index].y);
      ctx.lineTo(shapePoints[next].x, shapePoints[next].y);
      ctx.stroke();
    });
  }

  if (state.lastTouch.index >= 0) {
    const age = (now - state.lastTouch.t) / 1000;
    if (age < 1.1) {
      const point = shapePoints[state.lastTouch.index];
      const alpha = (1 - age / 1.1) * 0.35 * SUBTLETY;
      ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 16, 0, TAU);
      ctx.stroke();
    }
  }

  shapePoints.forEach((point, index) => {
    const pulse = Math.sin(now * 0.002 + index) * 2;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 213, 232, 0.7)";
    ctx.arc(point.x, point.y, 6 + pulse * 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 103, 179, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 12 + pulse, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
}

function drawAngleEchoes(angles) {
  const threshold = 6;
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < angles.length; i += 1) {
    for (let j = i + 1; j < angles.length; j += 1) {
      const diff = Math.abs(angles[i] - angles[j]);
      if (diff > threshold) continue;
      const alpha = 1 - diff / threshold;
      ctx.strokeStyle = `rgba(255, 213, 232, ${alpha * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(shapePoints[i].x, shapePoints[i].y);
      ctx.lineTo(shapePoints[j].x, shapePoints[j].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBursts(now) {
  ctx.save();
  bursts.forEach((burst) => {
    const age = (now - burst.t) / 1000;
    const progress = age / 1.2;
    if (progress >= 1) return;
    const alpha = 1 - progress;
    const radius = burst.radius + progress * burst.radius * 2.4;
    ctx.strokeStyle = `rgba(255, 103, 179, ${alpha * 0.2 * SUBTLETY})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, TAU);
    ctx.stroke();
  });
  sparkles.forEach((sparkle) => {
    const age = (now - sparkle.t) / 1000;
    const progress = age / 0.6;
    if (progress >= 1) return;
    const alpha = 1 - progress;
    const x = sparkle.x + Math.cos(sparkle.angle) * sparkle.radius * (0.6 + progress);
    const y = sparkle.y + Math.sin(sparkle.angle) * sparkle.radius * (0.6 + progress);
    ctx.fillStyle = `rgba(255, 213, 232, ${alpha * 0.35 * SUBTLETY})`;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawPortal(now) {
  if (!state.portal) return;
  const age = (now - state.portal.t) / 1000;
  const progress = age / state.portal.life;
  if (progress >= 1) return;
  const alpha = (1 - progress) * 0.12 * SUBTLETY;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(state.portal.x, state.portal.y, state.portal.radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawSeeds(now) {
  ctx.save();
  seeds.forEach((seed) => {
    const age = (now - seed.t) / 1000;
    const progress = age / seed.duration;
    if (progress >= 1) return;
    const alpha = 1 - progress;
    const radius = seed.radius + progress * 18;
    ctx.strokeStyle = `rgba(255, 213, 232, ${alpha * 0.35})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(seed.x, seed.y, radius, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
}

function drawEdgeWhispers(now) {
  ctx.save();
  edgeWhispers.forEach((whisper) => {
    const age = (now - whisper.t) / 1000;
    const progress = age / 1.1;
    if (progress >= 1) return;
    const alpha = (1 - progress) * 0.22 * SUBTLETY;
    ctx.fillStyle = `rgba(255, 213, 232, ${alpha})`;
    ctx.beginPath();
    ctx.arc(whisper.x, whisper.y, 2.4, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawQuietOrbit(now) {
  if (state.calm < 0.75) return;
  const centroid = polygonCentroid(shapePoints);
  const radius = baseStep * 0.35;
  const angle = now * 0.0006;
  const x = centroid.x + Math.cos(angle) * radius;
  const y = centroid.y + Math.sin(angle) * radius;
  ctx.save();
  ctx.fillStyle = `rgba(255, 213, 232, ${0.25 * SUBTLETY})`;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawEmissionWaves(now) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  emissionWaves.forEach((wave) => {
    const age = (now - wave.t) / 1000;
    const progress = age / 1.1;
    if (progress >= 1) return;
    const alpha = (1 - progress) * 0.65 * SUBTLETY;
    const radius = wave.radius + progress * wave.radius * 3;
    ctx.strokeStyle = `rgba(120, 205, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, radius, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
}

function drawWrapPortals(now) {
  ctx.save();
  portalWraps.forEach((portal) => {
    const age = (now - portal.t) / 1000;
    const progress = age / 1.1;
    if (progress >= 1) return;
    const alpha = (1 - progress) * 0.2 * SUBTLETY;
    const radius = portal.radius + progress * portal.radius * 1.6;
    ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, radius, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
}

function updateHUD() {
  modeLabel.textContent = "shape";
  pointsLabel.textContent = shapePoints.length;
  signalLabel.textContent = state.detected ? `${state.detected}-gon` : "—";
}

function pushMemory() {
  const snapshot = shapePoints.map((point) => ({ x: point.x, y: point.y }));
  memories.unshift({ points: snapshot, t: state.now });
  if (memories.length > maxMemories) memories.pop();
}

function drawMemories(now) {
  ctx.save();
  memories.forEach((memory, index) => {
    const age = (now - memory.t) / 1000;
    const alpha = Math.max(0, 0.2 - age * 0.04) * (1 - index * 0.15);
    if (alpha <= 0) return;
    ctx.strokeStyle = `rgba(255, 103, 179, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    memory.points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
}

function applySeeds(delta) {
  seeds.forEach((seed) => {
    const timeLeft = seed.t + seed.duration * 1000 - state.now;
    if (timeLeft <= 0) return;
    let closest = 0;
    let closestDist = Infinity;
    shapePoints.forEach((point, index) => {
      const d = distance(point, seed);
      if (d < closestDist) {
        closestDist = d;
        closest = index;
      }
    });
    const point = shapePoints[closest];
    const influence = clamp(timeLeft / (seed.duration * 1000), 0, 1);
    const pull = 0.6 * influence * delta;
    point.x += (seed.x - point.x) * pull;
    point.y += (seed.y - point.y) * pull;
  });
}

function applySoftConstraints(delta) {
  if (shapePoints.length < 3) return;
  const angles = polygonAngles(shapePoints);
  const edges = polygonEdgeLengths(shapePoints);
  const avgEdge = edges.reduce((sum, len) => sum + len, 0) / edges.length;
  const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
  const edgeDiff = Math.max(...edges.map((edge) => Math.abs(edge - avgEdge))) / avgEdge;
  const angleDiff = Math.max(...angles.map((angle) => Math.abs(angle - avgAngle))) / avgAngle;
  const coherence = clamp(1 - (edgeDiff + angleDiff) * 0.5, 0, 1);
  if (coherence < 0.45) return;
  const dragActive = state.dragging && state.dragging.type === "point";
  const settleFade = dragActive ? clamp(1 - coherence, 0.7, 1) : clamp(1 - coherence, 0.5, 1);
  const holdFade = state.symmetryHold > 1.2 ? clamp(1 - (state.symmetryHold - 1.2) / 0.8, 0.35, 1) : 1;
  const dragBoost = state.dragging && state.dragging.type === "point"
    ? (coherence > 0.85 ? 1.6 : 1.35)
    : 1;
  const strength = ((coherence - 0.45) / 0.55) * delta * 0.22 * SUBTLETY * settleFade * holdFade * dragBoost;
  const centroid = polygonCentroid(shapePoints);
  const baseAngle = Math.atan2(shapePoints[0].y - centroid.y, shapePoints[0].x - centroid.x);
  const radius = shapePoints.reduce((sum, point) => sum + distance(point, centroid), 0) / shapePoints.length;
  shapePoints.forEach((point, index) => {
    const targetAngle = baseAngle + (TAU / shapePoints.length) * index;
    const target = {
      x: centroid.x + Math.cos(targetAngle) * radius,
      y: centroid.y + Math.sin(targetAngle) * radius,
    };
    point.x += (target.x - point.x) * strength;
    point.y += (target.y - point.y) * strength;
  });
  return coherence;
}

function applyPointInertia(delta) {
  const dragActive = state.dragging && state.dragging.type === "point";
  const stiffness = dragActive ? 28 : 18;
  const damping = dragActive ? 0.78 : 0.85;
  shapePoints.forEach((point, index) => {
    const target = pointTargets[index];
    if (target) {
      const ease = (1 - Math.exp(-10 * delta)) * (dragActive ? 0.85 : 1);
      point.x += (target.x - point.x) * ease * SUBTLETY;
      point.y += (target.y - point.y) * ease * SUBTLETY;
      if (distance(point, target) < 0.5) {
        pointTargets[index] = null;
      }
    }
    const wobble = pointWobble[index];
    if (wobble && state.now - wobble.t < 700) {
      const age = (state.now - wobble.t) / 1000;
      const decay = Math.exp(-5 * age);
      const osc = Math.sin(age * 10);
      point.x += wobble.x * decay * osc;
      point.y += wobble.y * decay * osc;
    }
  });
}

function applyBreath(delta) {
  const target = state.breathing ? 1 : 0;
  const rate = state.breathing ? 0.8 : 0.5;
  state.breath = clamp(state.breath + (target ? rate : -rate) * delta, 0, 1);
  const scale = 1 + state.breath * 0.075;
  const ratio = scale / state.breathScale;
  if (Math.abs(ratio - 1) < 0.0001) return;
  const centroid = polygonCentroid(shapePoints);
  shapePoints.forEach((point) => {
    point.x = centroid.x + (point.x - centroid.x) * ratio;
    point.y = centroid.y + (point.y - centroid.y) * ratio;
  });
  state.breathScale = scale;
}

function applyBalanceField(delta) {
  if (shapePoints.length < 3) return;
  const dragActive = state.dragging && state.dragging.type === "point";
  const dragBoost = dragActive ? (state.symmetry > 0.85 ? 1.4 : 1.2) : 1;
  const edges = polygonEdgeLengths(shapePoints);
  const avgEdge = edges.reduce((sum, len) => sum + len, 0) / edges.length;
  shapePoints.forEach((point, index) => {
    const prev = shapePoints[(index - 1 + shapePoints.length) % shapePoints.length];
    const next = shapePoints[(index + 1) % shapePoints.length];
    const prevLen = edges[(index - 1 + edges.length) % edges.length] || 0;
    const nextLen = edges[index] || 0;
    const diff = avgEdge > 0 ? Math.abs(prevLen - nextLen) / avgEdge : 0;
    if (diff > 0.08) return;
    const midpoint = { x: (prev.x + next.x) * 0.5, y: (prev.y + next.y) * 0.5 };
    const settleFade = dragActive ? clamp(1 - state.symmetry, 0.7, 1) : clamp(1 - state.symmetry, 0.5, 1);
    const holdFade = state.symmetryHold > 1.2 ? clamp(1 - (state.symmetryHold - 1.2) / 0.8, 0.35, 1) : 1;
    const recentTouch = state.lastTouch.index === index && state.now - state.lastTouch.t < 1200;
    const ageBoost = pointAge[index] > 1.5 ? 1.4 : 1.12;
    const releaseBoost = !dragActive && recentTouch ? ageBoost : 1;
    const strength = (0.08 - diff) * delta * 0.36 * SUBTLETY * settleFade * holdFade * dragBoost * releaseBoost;
    point.x += (midpoint.x - point.x) * strength;
    point.y += (midpoint.y - point.y) * strength;

    if (state.symmetry > 0.85 && diff < 0.04 && state.now - state.lastWhisper > 320) {
      edgeWhispers.push({ x: midpoint.x, y: midpoint.y, t: state.now });
      state.lastWhisper = state.now;
    }
  });
}

function updateProgram(delta) {
  applySeeds(delta);
  const symmetry = applySoftConstraints(delta);

  const angles = polygonAngles(shapePoints);
  const edges = polygonEdgeLengths(shapePoints);
  const lengths = edges.map((edge) => Math.max(baseStep * 0.4, Math.min(edge, baseStep * 2)));
  state.lastAngles = angles;
  state.symmetry = symmetry || 0;
  state.mood = moodForPoints(shapePoints.length);
  if (state.symmetry > 0.92) {
    state.symmetryHold = Math.min(2, state.symmetryHold + delta);
  } else {
    state.symmetryHold = Math.max(0, state.symmetryHold - delta * 0.6);
  }

  const calmSpeed = 1 - (state.calm * 0.65 + state.loopSettle * 0.45) * SUBTLETY;
  const steppedAngle = updateTurtle(delta * calmSpeed, angles, lengths);
  trace.push({ x: turtle.position.x, y: turtle.position.y, t: state.now });
  while (trace.length > maxTrace) trace.shift();

  const minIndex = Math.max(0, trace.length - 240);
  for (let i = 0; i < minIndex; i += 30) {
    const point = trace[i];
    if (distance(point, turtle.position) < baseStep * 0.6 && state.now - state.lastBurst > 1800) {
      bursts.push({ x: turtle.position.x, y: turtle.position.y, t: state.now, radius: baseStep * 0.4 });
      state.loopSettle = 1;
      for (let i = 0; i < 6; i += 1) {
        sparkles.push({
          x: turtle.position.x,
          y: turtle.position.y,
          t: state.now,
          angle: Math.random() * TAU,
          radius: baseStep * 0.6,
        });
      }
      state.lastBurst = state.now;
      break;
    }
  }

  const turns = angles.map((angle) => 180 - angle);
  const avgTurn = weightedAverageTurn(turns, lengths);
  const detected = detectPolygon(avgTurn);
  if (detected !== state.detected) {
    state.detected = detected;
    state.bloom = 1;
    pushMemory();
  }

  if (state.symmetryHold > 1.2 && !state.portal && state.now - state.lastPortal > 6000) {
    const centroid = polygonCentroid(shapePoints);
    const offset = baseStep * 0.6;
    state.portal = {
      x: centroid.x + (Math.random() - 0.5) * offset,
      y: centroid.y + (Math.random() - 0.5) * offset,
      radius: baseStep * 0.7,
      t: state.now,
      life: 1.1,
    };
    state.lastPortal = state.now;
  }

  if (steppedAngle !== null) {
    playPulse(steppedAngle);
  }
}

function updateSurprises(delta) {
  if (state.sweep.strength > 0) {
    state.sweep.strength = Math.max(0, state.sweep.strength - delta * 1.2);
  }
  state.dragEnergy = Math.max(0, state.dragEnergy - delta * 0.8);
  state.calm = clamp(state.calm + (state.dragEnergy < 0.15 ? delta : -delta * 2), 0, 1);
  state.phaseBloom = Math.max(0, state.phaseBloom - delta * 0.8);
  state.loopSettle = Math.max(0, state.loopSettle - delta * 0.4);
  if (state.dragEnergy > 0.85) {
    state.fastHold = Math.min(0.6, state.fastHold + delta);
  } else {
    state.fastHold = Math.max(0, state.fastHold - delta * 0.6);
  }

  const exciteTarget = state.dragEnergy > 0.6 ? 1 : 0;
  state.excited = clamp(state.excited + (exciteTarget ? delta * 1.2 : -delta * 0.8), 0, 1);
  if (state.prevExcited > 0.5 && state.excited <= 0.5 && state.dragEnergy < 0.4 && state.now - state.lastFlare > 350) {
    emissionWaves.push({
      x: turtle.position.x,
      y: turtle.position.y,
      t: state.now,
      radius: baseStep * 0.7,
    });
    state.lastFlare = state.now;
  }
  state.prevExcited = state.excited;

  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    if (state.now - bursts[i].t > 1400) bursts.splice(i, 1);
  }

  for (let i = seeds.length - 1; i >= 0; i -= 1) {
    const elapsed = (state.now - seeds[i].t) / 1000;
    if (elapsed > seeds[i].duration) seeds.splice(i, 1);
  }

  for (let i = sparkles.length - 1; i >= 0; i -= 1) {
    if (state.now - sparkles[i].t > 700) sparkles.splice(i, 1);
  }

  for (let i = edgeWhispers.length - 1; i >= 0; i -= 1) {
    if (state.now - edgeWhispers[i].t > 1200) edgeWhispers.splice(i, 1);
  }

  for (let i = emissionWaves.length - 1; i >= 0; i -= 1) {
    if (state.now - emissionWaves[i].t > 1200) emissionWaves.splice(i, 1);
  }
  for (let i = portalWraps.length - 1; i >= 0; i -= 1) {
    if (state.now - portalWraps[i].t > 1200) portalWraps.splice(i, 1);
  }

  for (let i = 0; i < pointAge.length; i += 1) {
    pointAge[i] += delta;
  }

  if (state.portal && (state.now - state.portal.t) / 1000 > state.portal.life) {
    state.portal = null;
  }
}

function animate(now) {
  const delta = Math.min(0.033, (now - state.now) / 1000);
  state.now = now;

  if (state.bloom > 0) state.bloom = Math.max(0, state.bloom - delta * 0.6);

  if (state.dragging && state.dragging.type === "rotate" && !state.dragging.moved) {
    const holdTime = state.now - state.dragging.startTime;
    if (holdTime > 180) {
      state.breathing = true;
      state.dragging.isBreath = true;
    }
  }

  applyBreath(delta);
  applyPointInertia(delta);
  applyBalanceField(delta);
  updateProgram(delta);
  updateSurprises(delta);

  clear(now / 1000);
  drawDepthHull(now);
  drawTrace(now);
  drawMemories(now);
  drawBloom(state.detected, state.bloom);
  drawGhostPolygon(state.detected, state.bloom);
  drawBursts(now);
  drawEdgeWhispers(now);
  drawPortal(now);
  drawSeeds(now);
  drawQuietOrbit(now);
  drawEmissionWaves(now);
  drawWrapPortals(now);
  drawShapeField(now);
  drawAngleEchoes(state.lastAngles);
  drawSymmetryHalo(state.symmetry);

  updateHUD();
  requestAnimationFrame(animate);
}

function pickPoint(position, points, radius = 18) {
  for (let i = 0; i < points.length; i += 1) {
    if (distance(points[i], position) < radius) return i;
  }
  return -1;
}

canvas.addEventListener("pointerdown", (event) => {
  const position = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
  ensureAudio();
  state.breathing = false;

  const idx = pickPoint(position, shapePoints);
  if (idx >= 0) {
    state.dragging = { type: "point", index: idx, last: position, moved: false };
    state.dragging.holdTimer = window.setTimeout(() => {
      if (!state.dragging || state.dragging.type !== "point") return;
      if (state.dragging.moved) return;
      if (shapePoints.length <= 3) return;
      shapePoints.splice(idx, 1);
      pointTargets.splice(idx, 1);
      pointAge.splice(idx, 1);
      pointWobble.splice(idx, 1);
      if (state.lastTouch.index === idx) {
        state.lastTouch = { index: -1, t: 0 };
      }
      state.dragging = null;
    }, 650);
    return;
  }

  state.dragging = {
    type: "rotate",
    origin: position,
    start: state.rotation,
    last: position,
    isBreath: false,
    moved: false,
    startTime: state.now,
  };
});

volumeControl.addEventListener("input", (event) => {
  pendingVolume = Number(event.target.value);
  if (masterGain) {
    masterGain.gain.value = pendingVolume * 0.1;
  }
});

canvas.addEventListener("pointermove", (event) => {
  const position = { x: event.clientX, y: event.clientY };

  if (!state.dragging) return;

  if (state.dragging.last) {
    const dx = position.x - state.dragging.last.x;
    const dy = position.y - state.dragging.last.y;
    const speed = Math.hypot(dx, dy);
    state.dragging.lastDelta = { x: dx, y: dy };
    if (state.dragging.type === "point" && speed > 6) {
      state.dragging.moved = true;
      if (state.dragging.holdTimer) {
        window.clearTimeout(state.dragging.holdTimer);
        state.dragging.holdTimer = null;
      }
    }
    state.dragEnergy = Math.max(state.dragEnergy, clamp(speed / 40, 0, 1));
    if (speed > 18) {
      state.sweep.strength = Math.min(2, state.sweep.strength + speed * 0.01);
      state.sweep.angle = Math.atan2(dy, dx);
    }
    if (speed > 6 && state.dragging.type === "rotate") {
      state.breathing = false;
      state.dragging.moved = true;
      state.dragging.isBreath = false;
    }
  }
  state.dragging.last = position;

  if (state.dragging.type === "point") {
    const margin = 24;
    const bounded = {
      x: clamp(position.x, margin, width - margin),
      y: clamp(position.y, margin, height - margin),
    };
    pointTargets[state.dragging.index] = bounded;
    state.breathing = false;
    state.lastTouch = { index: state.dragging.index, t: state.now };
  } else if (state.dragging.type === "rotate") {
    const dx = position.x - state.dragging.origin.x;
    state.rotation = state.dragging.start + dx * 0.002;
  }
});

canvas.addEventListener("pointerup", (event) => {
  canvas.releasePointerCapture(event.pointerId);
  const wasBreathing = state.dragging && state.dragging.isBreath;
  state.breathing = false;
  if (state.dragging && state.dragging.holdTimer) {
    window.clearTimeout(state.dragging.holdTimer);
  }
  if (state.dragging && state.dragging.type === "point") {
    pushMemory();
    pointTargets[state.dragging.index] = null;
    state.lastTouch = { index: state.dragging.index, t: state.now };
    if (pointAge[state.dragging.index] > 1.5) {
      const delta = state.dragging.lastDelta || { x: 0, y: 0 };
      pointWobble[state.dragging.index] = {
        x: delta.x * 0.9,
        y: delta.y * 0.9,
        t: state.now,
      };
    } else {
      pointWobble[state.dragging.index] = { x: 0, y: 0, t: 0 };
    }
  }
  if (state.dragging && state.dragging.type === "rotate") {
    const moved = distance(state.dragging.origin, state.dragging.last || state.dragging.origin);
    if (moved < 6 && !wasBreathing) {
      seeds.push({
        x: event.clientX,
        y: event.clientY,
        t: state.now,
        duration: 2.6,
        radius: 10,
      });
    } else {
      pushMemory();
    }
  }
  state.dragging = null;
});

canvas.addEventListener("dblclick", (event) => {
  const position = { x: event.clientX, y: event.clientY };
  const { index, dist } = closestEdge(position, shapePoints);
  if (dist < 40) {
    const margin = 24;
    const bounded = {
      x: clamp(position.x, margin, width - margin),
      y: clamp(position.y, margin, height - margin),
    };
    shapePoints.splice(index, 0, bounded);
    pointTargets.splice(index, 0, null);
    pointAge.splice(index, 0, 0);
    pointWobble.splice(index, 0, { x: 0, y: 0, t: 0 });
    state.phaseBloom = 1;
  }
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const position = { x: event.clientX, y: event.clientY };

  if (shapePoints.length > 3) {
    const idx = pickPoint(position, shapePoints);
    if (idx >= 0) {
      shapePoints.splice(idx, 1);
      pointTargets.splice(idx, 1);
      pointAge.splice(idx, 1);
      pointWobble.splice(idx, 1);
      if (state.lastTouch.index === idx) {
        state.lastTouch = { index: -1, t: 0 };
      }
    }
  }
});

window.addEventListener("resize", () => {
  resize();
  resetTurtle();
});

resize();
resetTurtle();
requestAnimationFrame(animate);
