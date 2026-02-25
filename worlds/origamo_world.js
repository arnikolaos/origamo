function createOrigamoWorld(mode = "geometry") {
  let canvas = null;
  let ctx = null;
  let host = null;
  let volumeControl = null;

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
  tapPending: null,
  touchHandledAt: 0,
  domain: {
    id: mode,
  },
  fold: {
    tool: "foldline",
    foldLine: { ax: 0, ay: 0, bx: 0, by: 0, active: false, previewSide: 1, sideHint: null },
    creases: [],
    book: [],
    crease: [],
    depth: [],
    tension: 0,
    phase: 0,
    lastSnap: 0,
    lock: 0,
    wrinkle: 0,
  },
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
const foldSnaps = [];
const fibers = [];

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
let pendingVolume = 0.3;
let noiseBuffer = null;

function resize(nextWidth, nextHeight, ratio = 1) {
  width = nextWidth;
  height = nextHeight;
  if (canvas && ctx) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
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

function nearestPointInfo(position, points) {
  let closest = -1;
  let minDist = Infinity;
  points.forEach((point, index) => {
    const d = distance(point, position);
    if (d < minDist) {
      minDist = d;
      closest = index;
    }
  });
  return { index: closest, dist: minDist };
}

function signedDistanceToLine(point, line) {
  const dx = line.bx - line.ax;
  const dy = line.by - line.ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const apx = point.x - line.ax;
  const apy = point.y - line.ay;
  return apx * nx + apy * ny;
}

function reflectPointAcrossLine(point, line) {
  const dx = line.bx - line.ax;
  const dy = line.by - line.ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const apx = point.x - line.ax;
  const apy = point.y - line.ay;
  const s = apx * nx + apy * ny;
  return { x: point.x - 2 * s * nx, y: point.y - 2 * s * ny };
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

function linePolygonIntersections(line, points) {
  const hits = [];
  const eps = 0.0001;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const sa = signedDistanceToLine(a, line);
    const sb = signedDistanceToLine(b, line);
    if (Math.abs(sa) < eps && Math.abs(sb) < eps) continue;
    if (sa === 0) {
      hits.push({ x: a.x, y: a.y });
      continue;
    }
    if (sb === 0) {
      hits.push({ x: b.x, y: b.y });
      continue;
    }
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  const unique = [];
  hits.forEach((pt) => {
    const exists = unique.some((u) => distance(u, pt) < 2);
    if (!exists) unique.push(pt);
  });
  return unique;
}

function clipFoldLineToPolygon(line, points) {
  const intersections = linePolygonIntersections(line, points);
  if (intersections.length >= 2) {
    const dx = line.bx - line.ax;
    const dy = line.by - line.ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sorted = intersections
      .map((pt) => ({ pt, t: (pt.x - line.ax) * ux + (pt.y - line.ay) * uy }))
      .sort((a, b) => a.t - b.t);
    return { a: sorted[0].pt, b: sorted[sorted.length - 1].pt };
  }
  return { a: { x: line.ax, y: line.ay }, b: { x: line.bx, y: line.by } };
}

function buildFoldedPoints(line, sideSign, points) {
  if (!points || points.length < 3) return null;
  const augmented = [];
  const intersectionIndices = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    augmented.push({ x: p.x, y: p.y });
    const sP = signedDistanceToLine(p, line);
    const sQ = signedDistanceToLine(q, line);
    if (sP * sQ < 0) {
      const t = sP / (sP - sQ);
      const hit = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      augmented.push(hit);
      intersectionIndices.push(augmented.length - 1);
    }
  }

  if (intersectionIndices.length < 2) return null;
  const idxA = intersectionIndices[0];
  const idxB = intersectionIndices[1];
  const total = augmented.length;

  const pathForward = [];
  for (let i = idxA; ; i = (i + 1) % total) {
    pathForward.push(i);
    if (i === idxB) break;
  }
  const pathBackward = [];
  for (let i = idxB; ; i = (i + 1) % total) {
    pathBackward.push(i);
    if (i === idxA) break;
  }

  const avgSigned = (path) => {
    let sum = 0;
    let count = 0;
    path.forEach((idx) => {
      if (idx === idxA || idx === idxB) return;
      sum += signedDistanceToLine(augmented[idx], line);
      count += 1;
    });
    return count > 0 ? sum / count : 0;
  };

  const forwardSign = avgSigned(pathForward);
  const foldPath = forwardSign * sideSign > 0 ? pathForward : pathBackward;
  const foldSet = new Set(foldPath);

  const dx = line.bx - line.ax;
  const dy = line.by - line.ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hingeSpan = baseStep * 1.6;
  const hingeOffset = baseStep * 0.08;

  const folded = augmented.map((point, idx) => {
    if (!foldSet.has(idx)) return { x: point.x, y: point.y };
    if (idx === idxA || idx === idxB) return { x: point.x, y: point.y };
    const s = signedDistanceToLine(point, line);
    const reflected = reflectPointAcrossLine(point, line);
    const factor = clamp(1 - Math.abs(s) / hingeSpan, 0, 1);
    const offsetSign = -Math.sign(s) || 0;
    return {
      x: reflected.x + nx * hingeOffset * factor * offsetSign,
      y: reflected.y + ny * hingeOffset * factor * offsetSign,
    };
  });

  return folded;
}

function mergeClosePoints(points, eps) {
  if (points.length <= 3) return points.slice();
  const merged = [];
  points.forEach((point) => {
    const last = merged[merged.length - 1];
    if (last && distance(last, point) < eps) {
      last.x = (last.x + point.x) * 0.5;
      last.y = (last.y + point.y) * 0.5;
    } else {
      merged.push({ x: point.x, y: point.y });
    }
  });
  if (merged.length > 2 && distance(merged[0], merged[merged.length - 1]) < eps) {
    const last = merged.pop();
    merged[0].x = (merged[0].x + last.x) * 0.5;
    merged[0].y = (merged[0].y + last.y) * 0.5;
  }
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    const prev = merged[(i - 1 + merged.length) % merged.length];
    if (distance(prev, merged[i]) < eps && merged.length > 3) {
      merged.splice(i, 1);
    }
  }
  return merged;
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
  const bufferSize = audioCtx.sampleRate * 0.08;
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.6;
  }
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

function playFoldSnap() {
  if (!audioCtx || !masterGain || !noiseBuffer) return;
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 1.2;
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(now);
  source.stop(now + 0.14);
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
  const foldMode = state.domain.id === "fold";
  const baseWidth = foldMode ? 3.2 : 2.4;
  const widthBoost = (state.calm * 1.5 + state.loopSettle * 1.2) * SUBTLETY;
  ctx.lineWidth = baseWidth + widthBoost;
  ctx.lineCap = "round";
  const hue = 330;
  const saturation = 80 + state.mood * 10 + state.excited * 6 - (foldMode ? 18 : 0);
  const lightness = 58 + state.mood * 8 + state.excited * 6 - (foldMode ? 6 : 0);
  for (let i = 1; i < trace.length; i += 1) {
    const prev = trace[i - 1];
    const current = trace[i];
    const jump = Math.hypot(current.x - prev.x, current.y - prev.y);
    if (jump > Math.min(width, height) * 0.6) continue;
    const age = (now - current.t) / 1000;
    const alpha = Math.max(0, 1 - age / 6) * (foldMode ? 0.75 : 1);
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function ensureFoldState() {
  const count = shapePoints.length;
  while (state.fold.crease.length < count) {
    state.fold.crease.push(0.5);
  }
  while (state.fold.depth.length < count) {
    state.fold.depth.push(0);
  }
  if (state.fold.crease.length > count) state.fold.crease.length = count;
  if (state.fold.depth.length > count) state.fold.depth.length = count;
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

function drawFoldSurface(now) {
  if (state.domain.id !== "fold") return;
  if (shapePoints.length < 3) return;
  const centroid = polygonCentroid(shapePoints);
  const radius = shapePoints.reduce((sum, point) => sum + distance(point, centroid), 0) / shapePoints.length;
  const phase = state.fold.phase;
  const lightX = centroid.x + Math.cos(phase) * radius * 0.35;
  const lightY = centroid.y + Math.sin(phase) * radius * 0.35;
  const lockBoost = state.fold.lock * 12;
  const baseLight = 20 + state.fold.tension * 14 + lockBoost;
  const highlight = 34 + state.fold.tension * 22 + lockBoost;
  const gradient = ctx.createLinearGradient(lightX - radius, lightY - radius, lightX + radius, lightY + radius);
  gradient.addColorStop(0, `hsla(332, 34%, ${highlight}%, 0.6)`);
  gradient.addColorStop(1, `hsla(330, 30%, ${baseLight}%, 0.75)`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  shapePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFoldCreases() {
  if (state.domain.id !== "fold") return;
  if (shapePoints.length < 3) return;
  ctx.save();
  for (let i = 0; i < shapePoints.length; i += 1) {
    const next = (i + 1) % shapePoints.length;
    const depth = (state.fold.depth[i] + state.fold.depth[next]) * 0.5;
    const strength = clamp(state.fold.crease[i], 0.15, 1);
    const lockBoost = state.fold.lock * 0.5;
    const mountain = depth >= 0;
    ctx.setLineDash(mountain ? [] : [6, 6]);
    ctx.strokeStyle = mountain
      ? `rgba(255, 213, 232, ${0.32 + strength * 0.35 + lockBoost})`
      : `rgba(255, 171, 208, ${0.24 + strength * 0.3 + lockBoost})`;
    ctx.lineWidth = 1.3 + strength * 1.6 + lockBoost * 1.1;
    ctx.beginPath();
    ctx.moveTo(shapePoints[i].x, shapePoints[i].y);
    ctx.lineTo(shapePoints[next].x, shapePoints[next].y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([]);
}

function drawFoldLineCreases() {
  if (state.domain.id !== "fold") return;
  if (state.fold.creases.length === 0) return;
  ctx.save();
  state.fold.creases.forEach((crease) => {
    const age = crease.t ? (state.now - crease.t) / (crease.duration || 1400) : 0;
    const fade = clamp(1 - age, 0, 1);
    const strength = clamp(crease.strength * fade, 0.05, 1);
    const mountain = crease.type === "mountain";
    ctx.setLineDash(mountain ? [] : [6, 6]);
    ctx.strokeStyle = mountain
      ? `rgba(255, 213, 232, ${0.2 + strength * 0.4})`
      : `rgba(255, 171, 208, ${0.18 + strength * 0.35})`;
    ctx.lineWidth = 1.1 + strength * 1.6;
    ctx.beginPath();
    ctx.moveTo(crease.ax, crease.ay);
    ctx.lineTo(crease.bx, crease.by);
    ctx.stroke();
  });
  ctx.restore();
  ctx.setLineDash([]);
}

function drawFoldLinePreview() {
  if (state.domain.id !== "fold") return;
  const line = state.fold.foldLine;
  if (!line.active) return;
  const length = Math.hypot(line.bx - line.ax, line.by - line.ay);
  if (length < 4) return;
  if (!buildFoldedPoints(line, line.previewSide, shapePoints)) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 213, 232, 0.7)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(line.ax, line.ay);
  ctx.lineTo(line.bx, line.by);
  ctx.stroke();

  const preview = buildFoldedPoints(line, line.previewSide, shapePoints) || shapePoints;

  ctx.strokeStyle = "rgba(255, 213, 232, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  preview.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawFoldWrinkles(now) {
  if (state.domain.id !== "fold") return;
  if (shapePoints.length < 3) return;
  const intensity = clamp(state.fold.wrinkle, 0, 1);
  if (intensity < 0.08) return;
  const centroid = polygonCentroid(shapePoints);
  const radius = shapePoints.reduce((sum, point) => sum + distance(point, centroid), 0) / shapePoints.length;
  const count = 10;
  ctx.save();
  ctx.beginPath();
  shapePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = `rgba(255, 171, 208, ${intensity * 0.12})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    const phase = now * 0.0006 + i * 1.4;
    const angle = phase + Math.sin(phase * 1.7) * 0.4;
    const offset = (Math.sin(phase * 2.3) * 0.5 + 0.5) * radius * 0.6 - radius * 0.3;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const cx = centroid.x + -dy * offset;
    const cy = centroid.y + dx * offset;
    ctx.beginPath();
    ctx.moveTo(cx - dx * radius, cy - dy * radius);
    ctx.lineTo(cx + dx * radius, cy + dy * radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFoldFibers(now) {
  if (state.domain.id !== "fold") return;
  ctx.save();
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const phase = now * 0.00015 + i * 0.6;
    const x = (width * 0.2 + Math.sin(phase) * width * 0.3 + (i * 73) % width);
    const y = (height * 0.2 + Math.cos(phase * 1.2) * height * 0.35 + (i * 41) % height);
    const len = baseStep * 0.9 + (i % 5) * 6;
    const angle = phase * 0.6 + i * 0.4;
    const alpha = 0.04 + Math.sin(phase + i) * 0.02;
    ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFoldSnaps(now) {
  if (state.domain.id !== "fold") return;
  ctx.save();
  foldSnaps.forEach((snap) => {
    const age = (now - snap.t) / 1000;
    const progress = age / 1.2;
    if (progress >= 1) return;
    const alpha = (1 - progress) * 0.25;
    const radius = snap.radius + progress * snap.radius * 1.3;
    ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(snap.x, snap.y, radius, 0, TAU);
    ctx.stroke();
    const sweepAlpha = alpha * 0.6;
    const sweepAngle = snap.angle + progress * 0.6;
    const dx = Math.cos(sweepAngle);
    const dy = Math.sin(sweepAngle);
    ctx.strokeStyle = `rgba(255, 213, 232, ${sweepAlpha})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(snap.x - dx * radius, snap.y - dy * radius);
    ctx.lineTo(snap.x + dx * radius, snap.y + dy * radius);
    ctx.stroke();
  });
  ctx.restore();
}


function updateHUD() {
  if (!host || !host.setHud) return;
  host.setHud({
    world: state.domain.id,
    points: shapePoints.length,
    signal: state.detected ? `${state.detected}-gon` : "—",
  });
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

function updateFoldState(delta, angles, edges) {
  if (state.domain.id !== "fold") return;
  if (shapePoints.length < 3) return;
  ensureFoldState();

  const avgEdge = edges.reduce((sum, len) => sum + len, 0) / edges.length;
  const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
  if (!Number.isFinite(avgEdge) || avgEdge <= 0) return;
  const edgeVar = edges.reduce((max, edge) => Math.max(max, Math.abs(edge - avgEdge) / avgEdge), 0);
  const angleVar = angles.reduce((max, angle) => Math.max(max, Math.abs(angle - avgAngle) / avgAngle), 0);
  const calm = 1 - clamp(state.dragEnergy * 1.1, 0, 1);
  const regularity = clamp(1 - (edgeVar * 0.55 + angleVar * 0.45), 0, 1);
  const stability = clamp((0.65 * state.symmetry + 0.35 * regularity), 0, 1) * (0.35 + 0.65 * calm);
  const dragInfluence = clamp(state.dragEnergy, 0, 1);
  const phase = state.rotation * 0.8 + state.sweep.angle * 0.25 + Math.sin(state.now * 0.0006) * 0.2 * dragInfluence;

  state.fold.tension = clamp(stability + (state.symmetry - 0.85) * 0.6, 0, 1);
  state.fold.phase = phase;
  state.fold.wrinkle = lerp(state.fold.wrinkle, 1 - stability, clamp(delta * 2.2, 0, 1));

  for (let i = 0; i < edges.length; i += 1) {
    const diff = Math.abs(edges[i] - avgEdge) / avgEdge;
    const target = clamp(1 - diff * 6, 0, 1) * (0.45 + stability * 0.55);
    state.fold.crease[i] = lerp(state.fold.crease[i], target, clamp(delta * 3, 0, 1));
  }

  if (state.dragging && state.dragging.last) {
    const pointer = state.dragging.last;
    const { index } = closestEdge(pointer, shapePoints);
    const boost = clamp(dragInfluence * 0.9 + 0.1, 0, 1);
    if (Number.isFinite(index)) {
      state.fold.crease[index] = clamp(state.fold.crease[index] + delta * 1.4 * boost, 0, 1);
    }
    if (state.dragging.type === "point") {
      const left = (state.dragging.index - 1 + shapePoints.length) % shapePoints.length;
      const right = state.dragging.index % shapePoints.length;
      state.fold.crease[left] = clamp(state.fold.crease[left] + delta * 1.1 * boost, 0, 1);
      state.fold.crease[right] = clamp(state.fold.crease[right] + delta * 1.1 * boost, 0, 1);
    }
  }

  const wobble = dragInfluence > 0.7 ? Math.sin(state.now * 0.008) * 0.18 * dragInfluence : 0;
  const count = shapePoints.length;
  for (let i = 0; i < count; i += 1) {
    const targetDepth = Math.sin((i / count) * TAU + phase + wobble) * stability;
    state.fold.depth[i] = lerp(state.fold.depth[i], targetDepth, clamp(delta * 4, 0, 1));
  }
}

function foldQualityFromPoints(points) {
  const edges = polygonEdgeLengths(points);
  const angles = polygonAngles(points);
  const avgEdge = edges.reduce((sum, len) => sum + len, 0) / edges.length;
  const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
  if (!Number.isFinite(avgEdge) || avgEdge <= 0) return 0;
  const edgeVar = edges.reduce((max, edge) => Math.max(max, Math.abs(edge - avgEdge) / avgEdge), 0);
  const angleVar = angles.reduce((max, angle) => Math.max(max, Math.abs(angle - avgAngle) / avgAngle), 0);
  const regularity = clamp(1 - (edgeVar * 0.55 + angleVar * 0.45), 0, 1);
  const symmetryScore = clamp(1 - (edgeVar + angleVar) * 0.6, 0, 1);
  return clamp(regularity * 0.6 + symmetryScore * 0.4, 0, 1);
}

function applyFoldLine(line, sideSign, previewOnly = false) {
  if (!line.active) return;
  const length = Math.hypot(line.bx - line.ax, line.by - line.ay);
  if (length < 12) return;
  if (!sideSign) sideSign = 1;
  const eps = 0.5;
  if (previewOnly) return;

  const folded = buildFoldedPoints(line, sideSign, shapePoints);
  if (!folded) return;

  const merged = mergeClosePoints(folded, 8);
  if (merged.length >= 3) {
    const margin = 24;
    shapePoints.length = 0;
    merged.forEach((point) => {
      shapePoints.push({
        x: clamp(point.x, margin, width - margin),
        y: clamp(point.y, margin, height - margin),
      });
    });
  }

  pointTargets.length = shapePoints.length;
  pointAge.length = shapePoints.length;
  pointWobble.length = shapePoints.length;
  for (let i = 0; i < shapePoints.length; i += 1) {
    pointTargets[i] = null;
    pointAge[i] = 0;
    pointWobble[i] = { x: 0, y: 0, t: 0 };
  }

  ensureFoldState();

  const clipped = clipFoldLineToPolygon(line, shapePoints);
  state.fold.creases.push({
    ax: clipped.a.x,
    ay: clipped.a.y,
    bx: clipped.b.x,
    by: clipped.b.y,
    strength: 0.7,
    type: sideSign > 0 ? "mountain" : "valley",
    t: state.now,
    duration: 1400,
  });

  state.fold.creases.forEach((crease) => {
    const mid = { x: (crease.ax + crease.bx) * 0.5, y: (crease.ay + crease.by) * 0.5 };
    const dist = Math.abs(signedDistanceToLine(mid, line));
    if (dist < 18) crease.strength = clamp(crease.strength + 0.2, 0, 1);
  });

  const quality = foldQualityFromPoints(shapePoints);
  if (quality > 0.82 && state.now - state.fold.lastSnap > 1200) {
    const centroid = polygonCentroid(shapePoints);
    foldSnaps.push({
      x: centroid.x,
      y: centroid.y,
      t: state.now,
      radius: baseStep * 0.6,
      angle: state.rotation + Math.random() * 0.6,
    });
    state.fold.lastSnap = state.now;
    state.fold.lock = 1;
    playFoldSnap();
    pushMemory();
    state.fold.book.push({
      id: `${state.now}`,
      timestamp: state.now,
      points: shapePoints.map((pt) => ({ x: pt.x, y: pt.y })),
      creases: state.fold.creases.map((crease) => ({ ...crease })),
      screenshotSeed: quality,
    });
  }
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
  updateFoldState(delta, angles, edges);
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
  state.fold.lock = Math.max(0, state.fold.lock - delta * 0.35);
  if (state.domain.id === "fold" && state.fold.creases.length > 0) {
    for (let i = state.fold.creases.length - 1; i >= 0; i -= 1) {
      const crease = state.fold.creases[i];
      if (crease.t && crease.duration && state.now - crease.t > crease.duration) {
        state.fold.creases.splice(i, 1);
      }
    }
  }

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
  for (let i = foldSnaps.length - 1; i >= 0; i -= 1) {
    if (state.now - foldSnaps[i].t > 1400) foldSnaps.splice(i, 1);
  }

  for (let i = 0; i < pointAge.length; i += 1) {
    pointAge[i] += delta;
  }

  if (state.portal && (state.now - state.portal.t) / 1000 > state.portal.life) {
    state.portal = null;
  }
}

function update(dt, now) {
  const delta = Math.min(0.033, dt);
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

  updateHUD();
}

function render() {
  const now = state.now;
  clear(now / 1000);
  if (state.domain.id === "fold") {
    drawFoldSurface(now);
  } else {
    drawDepthHull(now);
  }
  if (state.domain.id !== "fold") {
    drawTrace(now);
  } else {
    drawFoldFibers(now);
  }
  drawMemories(now);
  drawBloom(state.detected, state.bloom);
  drawGhostPolygon(state.detected, state.bloom);
  drawFoldWrinkles(now);
  drawFoldCreases();
  drawFoldLineCreases();
  drawBursts(now);
  drawEdgeWhispers(now);
  drawPortal(now);
  drawSeeds(now);
  drawQuietOrbit(now);
  drawEmissionWaves(now);
  drawWrapPortals(now);
  drawFoldSnaps(now);
  drawShapeField(now);
  drawAngleEchoes(state.lastAngles);
  drawSymmetryHalo(state.symmetry);
  drawFoldLinePreview();
}

function pickPoint(position, points, radius = 18) {
  for (let i = 0; i < points.length; i += 1) {
    if (distance(points[i], position) < radius) return i;
  }
  return -1;
}
function handleTap(position, pointerType) {
  const now = state.now;
  const tap = state.tapPending;
  const sameSpot = tap && distance({ x: tap.x, y: tap.y }, position) < 25;
  if (tap && now - tap.t < 320 && sameSpot) {
    window.clearTimeout(tap.timer);
    state.tapPending = null;
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
  } else {
    const timer = window.setTimeout(() => {
      seeds.push({
        x: position.x,
        y: position.y,
        t: state.now,
        duration: 2.6,
        radius: 10,
      });
      state.tapPending = null;
    }, 320);
    state.tapPending = { t: now, x: position.x, y: position.y, timer };
  }
  state.touchHandledAt = now;
}

function onPointer(type, x, y, data = {}) {
  const position = { x, y };
  const pointerType = data.pointerType || "mouse";
  if (type === "down") {
    ensureAudio();
    state.breathing = false;

    const idx = pickPoint(position, shapePoints);
    if (idx >= 0) {
      if (data.button === 2 && shapePoints.length > 3) {
        shapePoints.splice(idx, 1);
        pointTargets.splice(idx, 1);
        pointAge.splice(idx, 1);
        pointWobble.splice(idx, 1);
        if (state.lastTouch.index === idx) {
          state.lastTouch = { index: -1, t: 0 };
        }
        return;
      }
      state.dragging = {
        type: "point",
        index: idx,
        last: position,
        origin: position,
        moved: false,
        startTime: state.now,
      };
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
      }, pointerType === "touch" ? 650 : 900);
      return;
    }

    if (state.domain.id === "fold") {
      const nearest = nearestPointInfo(position, shapePoints);
      const sideHint = nearest.dist < baseStep * 1.2 ? { ...shapePoints[nearest.index] } : null;
      state.fold.foldLine = {
        ax: position.x,
        ay: position.y,
        bx: position.x,
        by: position.y,
        active: true,
        previewSide: 1,
        sideHint,
      };
      state.dragging = {
        type: "foldline",
        origin: position,
        last: position,
        moved: false,
        startTime: state.now,
        previewOnly: data.altKey,
      };
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
    return;
  }

  if (type === "move") {
    if (!state.dragging) return;
    if (state.dragging.last) {
      const dx = position.x - state.dragging.last.x;
      const dy = position.y - state.dragging.last.y;
      const speed = Math.hypot(dx, dy);
      state.dragging.lastDelta = { x: dx, y: dy };
      if ((state.dragging.type === "point" || state.dragging.type === "rotate" || state.dragging.type === "foldline") && speed > 6) {
        state.dragging.moved = true;
        if (state.dragging.holdTimer) {
          window.clearTimeout(state.dragging.holdTimer);
          state.dragging.holdTimer = null;
        }
      }
      if (state.dragging.type === "point" && state.dragging.origin) {
        const dragDist = distance(state.dragging.origin, position);
        if (dragDist > 2.5) {
          state.dragging.moved = true;
          if (state.dragging.holdTimer) {
            window.clearTimeout(state.dragging.holdTimer);
            state.dragging.holdTimer = null;
          }
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
    } else if (state.dragging.type === "foldline") {
      state.fold.foldLine.bx = position.x;
      state.fold.foldLine.by = position.y;
      const hint = state.fold.foldLine.sideHint;
      if (hint) {
        const sign = Math.sign(signedDistanceToLine(hint, state.fold.foldLine));
        if (sign !== 0) state.fold.foldLine.previewSide = sign;
      } else {
        const centroid = polygonCentroid(shapePoints);
        const sign = Math.sign(signedDistanceToLine(centroid, state.fold.foldLine));
        if (sign !== 0) state.fold.foldLine.previewSide = -sign;
      }
    } else if (state.dragging.type === "rotate") {
      const dx = position.x - state.dragging.origin.x;
      state.rotation = state.dragging.start + dx * 0.002;
    }
    return;
  }

  if (type === "up") {
    if (pointerType === "touch" && state.now - state.touchHandledAt < 50) {
      state.dragging = null;
      return;
    }
    const wasBreathing = state.dragging && state.dragging.isBreath;
    const wasFoldLine = state.dragging && state.dragging.type === "foldline";
    state.breathing = false;
    if (state.dragging && state.dragging.holdTimer) {
      window.clearTimeout(state.dragging.holdTimer);
    }
    if (wasFoldLine) {
      const previewOnly = state.dragging.previewOnly || data.altKey;
      const line = state.fold.foldLine;
      applyFoldLine(line, line.previewSide, previewOnly);
      state.fold.foldLine.active = false;
      state.dragging = null;
      state.touchHandledAt = state.now;
      return;
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
        if (pointerType === "touch") {
          handleTap(position, pointerType);
        } else {
          seeds.push({
            x: position.x,
            y: position.y,
            t: state.now,
            duration: 2.6,
            radius: 10,
          });
        }
      } else {
        pushMemory();
      }
    }
    state.dragging = null;
    return;
  }

  if (type === "dblclick") {
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
  }
}

function init(nextHost) {
  host = nextHost;
  canvas = host.canvas;
  ctx = host.ctx;
  volumeControl = host.ui ? host.ui.volume : null;
  pendingVolume = volumeControl ? Number(volumeControl.value) : pendingVolume;
  if (volumeControl) {
    volumeControl.addEventListener("input", (event) => {
      pendingVolume = Number(event.target.value);
      if (masterGain) {
        masterGain.gain.value = pendingVolume * 0.1;
      }
    });
  }
  ensureFoldState();
}

function onResize(width, height, ratio) {
  resize(width, height, ratio);
  resetTurtle();
}

function onEnter() {
  resetTurtle();
}

function onExit() {
  state.dragging = null;
}

function getSnapshot() {
  return {
    points: shapePoints.map((point) => ({ x: point.x, y: point.y })),
    rotation: state.rotation,
    detected: state.detected,
    domain: state.domain.id,
  };
}

function loadSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.points)) return;
  shapePoints.length = 0;
  snapshot.points.forEach((pt) => shapePoints.push({ x: pt.x, y: pt.y }));
  state.rotation = snapshot.rotation || 0;
  resetTurtle();
}

return {
  id: state.domain.id,
  name: state.domain.id === "fold" ? "Fold" : "Geometry",
  init,
  onResize,
  onEnter,
  onExit,
  update,
  render,
  onPointer,
  getSnapshot,
  loadSnapshot,
};
}

window.GeometryWorld = createOrigamoWorld("geometry");
window.FoldWorld = createOrigamoWorld("fold");
