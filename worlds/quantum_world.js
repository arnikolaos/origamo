(function () {
  const TAU = Math.PI * 2;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randNormal() {
    const u = Math.random() || 0.0001;
    const v = Math.random() || 0.0001;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
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

  const state = {
    width: 0,
    height: 0,
    now: performance.now(),
    clouds: [],
    barriers: [],
    pulses: [],
    snaps: [],
    coherence: 0,
    lastSnap: 0,
    pointer: { x: 0, y: 0, down: false, mode: "observe" },
    dragLine: null,
    tapPending: null,
  };

  let host = null;
  let canvas = null;
  let ctx = null;

  function initClouds() {
    const center = { x: state.width * 0.5, y: state.height * 0.5 };
    state.clouds = [
      {
        mx: center.x,
        my: center.y,
        sigma: Math.min(state.width, state.height) * 0.12,
        sigma0: Math.min(state.width, state.height) * 0.12,
        vx: 12,
        vy: -8,
        phase: Math.random() * TAU,
        energy: 0.4,
        collapsed: false,
        collapseT: 0,
      },
    ];
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(
      state.width * 0.25,
      state.height * 0.2,
      state.width * 0.1,
      state.width * 0.5,
      state.height * 0.55,
      state.width * 0.9
    );
    gradient.addColorStop(0, "rgba(70, 10, 48, 0.95)");
    gradient.addColorStop(0.5, "rgba(26, 3, 20, 0.98)");
    gradient.addColorStop(1, "rgba(8, 2, 8, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 103, 179, 0.05)";
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < state.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.height);
      ctx.stroke();
    }
    for (let y = 0; y < state.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCloud(cloud) {
    const samples = 90;
    const alpha = cloud.collapsed ? 0.06 : 0.035;
    ctx.save();
    for (let i = 0; i < samples; i += 1) {
      const gx = randNormal() * cloud.sigma;
      const gy = randNormal() * cloud.sigma;
      const x = cloud.mx + gx;
      const y = cloud.my + gy;
      ctx.fillStyle = `rgba(255, 103, 179, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    }

    if (cloud.collapsed) {
      ctx.fillStyle = "rgba(255, 213, 232, 0.9)";
      ctx.beginPath();
      ctx.arc(cloud.mx, cloud.my, 4.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(127, 232, 255, 0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cloud.mx, cloud.my, 18, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPointerRing() {
    const ringAlpha = state.pointer.down ? 0.45 : 0.2;
    const radius = state.pointer.down ? 34 : 24;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 213, 232, ${ringAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(state.pointer.x, state.pointer.y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function closestPointOnSegment(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const denom = abx * abx + aby * aby || 1;
    const t = clamp((apx * abx + apy * aby) / denom, 0, 1);
    return { x: a.x + abx * t, y: a.y + aby * t, t };
  }

  function drawBarriers() {
    const cloud = state.clouds[0];
    state.barriers.forEach((barrier) => {
      const strength = clamp(barrier.thickness, 0.2, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 213, 232, ${0.35 + strength * 0.4})`;
      ctx.lineWidth = 1.2 + strength * 1.6;
      ctx.beginPath();
      ctx.moveTo(barrier.ax, barrier.ay);
      ctx.lineTo(barrier.bx, barrier.by);
      ctx.stroke();
      const dist = Math.abs(signedDistanceToLine({ x: cloud.mx, y: cloud.my }, barrier));
      const shimmer = clamp(1 - dist / (cloud.sigma * 0.9), 0, 1);
      if (shimmer > 0.2) {
        const closest = closestPointOnSegment(
          { x: cloud.mx, y: cloud.my },
          { x: barrier.ax, y: barrier.ay },
          { x: barrier.bx, y: barrier.by }
        );
        ctx.fillStyle = `rgba(127, 232, 255, ${shimmer * 0.35})`;
        ctx.beginPath();
        ctx.arc(closest.x, closest.y, 4 + shimmer * 4, 0, TAU);
        ctx.fill();
      }
      if (barrier.leak && state.now - barrier.leak < 600) {
        const t = (state.now - barrier.leak) / 600;
        const alpha = (1 - t) * 0.5;
        ctx.strokeStyle = `rgba(127, 232, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barrier.ax, barrier.ay);
        ctx.lineTo(barrier.bx, barrier.by);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawPulses() {
    state.pulses.forEach((pulse) => {
      const age = (state.now - pulse.t) / 1000;
      if (age > 1.2) return;
      const radius = pulse.radius + age * pulse.radius * 2.4;
      const alpha = (1 - age / 1.2) * 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 103, 179, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, radius, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = `rgba(127, 232, 255, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, radius * 1.2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawSnapEffects() {
    state.snaps.forEach((snap) => {
      const age = (state.now - snap.t) / 1000;
      if (age > 1.2) return;
      const progress = age / 1.2;
      const alpha = (1 - progress) * 0.4;
      const radius = snap.radius + progress * snap.radius * 1.8;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 213, 232, ${alpha})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(snap.x, snap.y, radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    });
  }

  function updateCloud(cloud, dt) {
    const drift = 0.05 + cloud.energy * 0.12;
    cloud.mx += cloud.vx * drift * dt;
    cloud.my += cloud.vy * drift * dt;

    if (cloud.mx < 40 || cloud.mx > state.width - 40) cloud.vx *= -1;
    if (cloud.my < 40 || cloud.my > state.height - 40) cloud.vy *= -1;

    const observe = state.pointer.down && state.pointer.mode === "observe";
    const pointerPos = { x: state.pointer.x, y: state.pointer.y };
    const dist = distance(pointerPos, { x: cloud.mx, y: cloud.my });
    const inRange = dist < cloud.sigma;

    if (observe && inRange) {
      cloud.collapsed = true;
      cloud.collapseT = clamp(cloud.collapseT + dt * 2.4, 0, 1);
      cloud.sigma = lerp(cloud.sigma, cloud.sigma0 * 0.25, 0.12);
      cloud.mx = lerp(cloud.mx, pointerPos.x, 0.06);
      cloud.my = lerp(cloud.my, pointerPos.y, 0.06);
    } else {
      cloud.collapsed = false;
      cloud.collapseT = clamp(cloud.collapseT - dt * 1.4, 0, 1);
      cloud.sigma = lerp(cloud.sigma, cloud.sigma0 * (0.9 + cloud.energy * 0.4), 0.04);
    }

    const tunnelBase = 0.08 * cloud.energy * (cloud.sigma / cloud.sigma0);
    state.barriers.forEach((barrier) => {
      const s = signedDistanceToLine({ x: cloud.mx, y: cloud.my }, barrier);
      const distTo = Math.abs(s);
      if (distTo > cloud.sigma * 0.8) return;
      const chance = tunnelBase * barrier.permeability / barrier.thickness;
      if (Math.random() < chance * dt) {
        const reflected = reflectPointAcrossLine({ x: cloud.mx, y: cloud.my }, barrier);
        cloud.mx = lerp(cloud.mx, reflected.x, 0.7);
        cloud.my = lerp(cloud.my, reflected.y, 0.7);
        barrier.leak = state.now;
      }
    });

    cloud.energy = lerp(cloud.energy, 0.35, dt * 0.5);
    cloud.phase += dt * (0.6 + cloud.energy * 0.4);
  }

  function update(dt, now) {
    state.now = now;
    state.clouds.forEach((cloud) => updateCloud(cloud, dt));

    for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
      if (state.now - state.pulses[i].t > 1400) state.pulses.splice(i, 1);
    }
    for (let i = state.snaps.length - 1; i >= 0; i -= 1) {
      if (state.now - state.snaps[i].t > 1400) state.snaps.splice(i, 1);
    }

    const cloud = state.clouds[0];
    const kinetic = Math.hypot(cloud.vx, cloud.vy) * 0.01 + Math.abs(cloud.sigma - cloud.sigma0) * 0.002;
    if (kinetic < 0.25) {
      state.coherence = clamp(state.coherence + dt, 0, 1.4);
    } else {
      state.coherence = Math.max(0, state.coherence - dt * 1.2);
    }
    if (state.coherence > 1.2 && state.now - state.lastSnap > 2000) {
      state.lastSnap = state.now;
      state.snaps.push({
        x: cloud.mx,
        y: cloud.my,
        t: state.now,
        radius: cloud.sigma * 0.45,
      });
      host.saveSnapshot && host.saveSnapshot(world, world.getSnapshot());
    }

    host.setHud({
      world: "quantum",
      points: state.barriers.length,
      signal: cloud.collapsed ? "collapse" : "fog",
    });
  }

  function render() {
    drawBackground();
    drawPointerRing();
    drawBarriers();
    drawPulses();
    state.clouds.forEach(drawCloud);
    drawSnapEffects();

    if (state.coherence > 1.2) {
      const c = state.clouds[0];
      ctx.save();
      ctx.strokeStyle = "rgba(255, 213, 232, 0.25)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(c.mx, c.my, c.sigma * 0.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (state.dragLine) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 213, 232, 0.6)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(state.dragLine.ax, state.dragLine.ay);
      ctx.lineTo(state.dragLine.bx, state.dragLine.by);
      ctx.stroke();
      ctx.restore();
    }
  }

  function onPointer(type, x, y, data = {}) {
    if (type === "down") {
      state.pointer.down = true;
      state.pointer.x = x;
      state.pointer.y = y;
      if (data.shiftKey) {
        state.pointer.mode = "barrier";
        state.dragLine = { ax: x, ay: y, bx: x, by: y };
      } else {
        state.pointer.mode = "observe";
      }
      return;
    }
    if (type === "move") {
      state.pointer.x = x;
      state.pointer.y = y;
      if (state.pointer.mode === "barrier" && state.dragLine) {
        state.dragLine.bx = x;
        state.dragLine.by = y;
      }
      return;
    }
    if (type === "up") {
      if (state.pointer.mode === "barrier" && state.dragLine) {
        const len = Math.hypot(state.dragLine.bx - state.dragLine.ax, state.dragLine.by - state.dragLine.ay);
        if (len > 40) {
          state.barriers.push({
            ax: state.dragLine.ax,
            ay: state.dragLine.ay,
            bx: state.dragLine.bx,
            by: state.dragLine.by,
            thickness: 0.6,
            permeability: 0.5,
          });
        }
        state.dragLine = null;
      } else {
        const now = state.now;
        const tap = state.tapPending;
        const sameSpot = tap && Math.hypot(tap.x - x, tap.y - y) < 25;
        if (tap && now - tap.t < 320 && sameSpot) {
          const cloud = state.clouds[0];
          cloud.energy = clamp(cloud.energy + 0.5, 0, 1);
          cloud.sigma = cloud.sigma0 * (1.2 + cloud.energy * 0.6);
          state.pulses.push({ x, y, t: now, radius: 20 });
          state.tapPending = null;
        } else {
          const timer = window.setTimeout(() => {
            state.tapPending = null;
          }, 320);
          state.tapPending = { t: now, x, y, timer };
        }
      }
      state.pointer.down = false;
      state.pointer.mode = "observe";
    }
  }

  function init(nextHost) {
    host = nextHost;
    canvas = host.canvas;
    ctx = host.ctx;
    initClouds();
  }

  function onResize(width, height) {
    state.width = width;
    state.height = height;
    initClouds();
  }

  function getSnapshot() {
    return {
      clouds: state.clouds.map((cloud) => ({
        mx: cloud.mx,
        my: cloud.my,
        sigma: cloud.sigma,
        energy: cloud.energy,
        phase: cloud.phase,
      })),
      barriers: state.barriers.map((barrier) => ({
        ax: barrier.ax,
        ay: barrier.ay,
        bx: barrier.bx,
        by: barrier.by,
        thickness: barrier.thickness,
        permeability: barrier.permeability,
      })),
      t: Date.now(),
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot) return;
    if (Array.isArray(snapshot.clouds)) {
      state.clouds = snapshot.clouds.map((cloud) => ({
        mx: cloud.mx,
        my: cloud.my,
        sigma: cloud.sigma,
        sigma0: cloud.sigma || Math.min(state.width, state.height) * 0.12,
        vx: 12,
        vy: -8,
        phase: cloud.phase || 0,
        energy: cloud.energy || 0.3,
        collapsed: false,
        collapseT: 0,
      }));
    }
    if (Array.isArray(snapshot.barriers)) {
      state.barriers = snapshot.barriers.map((barrier) => ({ ...barrier }));
    }
  }

  const world = {
    id: "quantum",
    name: "Quantum",
    init,
    onEnter() {},
    onExit() {},
    update,
    render,
    onPointer,
    getSnapshot,
    loadSnapshot,
  };

  window.QuantumWorld = world;
})();
