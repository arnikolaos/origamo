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

  function rotate(point, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }

  const state = {
    width: 0,
    height: 0,
    now: performance.now(),
    orbital: {
      type: "p",
      angle: 0,
      energy: 0.3,
      collapse: 0,
      center: { x: 0, y: 0 },
      size: 1,
    },
    photons: [],
    flashes: [],
    pointer: { x: 0, y: 0, down: false },
    tapPending: null,
    measureTimer: null,
    fieldCanvas: null,
    fieldCtx: null,
    fieldSize: 200,
    coherence: 0,
    lastSnap: 0,
  };

  let host = null;
  let canvas = null;
  let ctx = null;

  function initFieldBuffer() {
    state.fieldCanvas = document.createElement("canvas");
    state.fieldCanvas.width = state.fieldSize;
    state.fieldCanvas.height = state.fieldSize;
    state.fieldCtx = state.fieldCanvas.getContext("2d");
  }

  function setCenter() {
    state.orbital.center.x = state.width * 0.5;
    state.orbital.center.y = state.height * 0.55;
    state.orbital.size = Math.min(state.width, state.height) * 0.22;
  }

  function orbitalField(x, y, type, angle) {
    const r = Math.hypot(x, y) || 1;
    let value = 0;
    if (type === "s") {
      value = Math.exp(-r * 1.6);
    } else if (type === "p") {
      const rot = rotate({ x, y }, angle);
      value = Math.abs(rot.x) * Math.exp(-r * 1.8);
    } else if (type === "d") {
      const rot = rotate({ x, y }, angle);
      const lobes = Math.abs(rot.x * rot.y);
      value = lobes * Math.exp(-r * 2.0);
    }
    return value;
  }

  function drawBackground() {
    const gradient = ctx.createRadialGradient(
      state.width * 0.4,
      state.height * 0.2,
      state.width * 0.1,
      state.width * 0.55,
      state.height * 0.6,
      state.width * 0.9
    );
    gradient.addColorStop(0, "rgba(18, 22, 30, 1)");
    gradient.addColorStop(0.6, "rgba(6, 8, 14, 1)");
    gradient.addColorStop(1, "rgba(2, 3, 6, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    ctx.lineWidth = 1;
    const step = 80;
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

  function renderOrbitalField() {
    const buffer = state.fieldCtx;
    const size = state.fieldSize;
    const image = buffer.createImageData(size, size);
    const data = image.data;
    const type = state.orbital.type;
    const angle = state.orbital.angle;
    const collapse = state.orbital.collapse;
    const intensity = 0.9 + collapse * 0.6;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x / size - 0.5) * 2;
        const ny = (y / size - 0.5) * 2;
        const r = Math.hypot(nx, ny);
        const field = orbitalField(nx * 1.2, ny * 1.2, type, angle);
        const density = clamp(field * intensity * (1 - r * 0.15), 0, 1);
        const idx = (y * size + x) * 4;
        data[idx] = 230; // R
        data[idx + 1] = 235; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = Math.floor(density * 255);
      }
    }
    buffer.putImageData(image, 0, 0);

    const targetSize = state.orbital.size * (1 - collapse * 0.3);
    const x = state.orbital.center.x - targetSize * 0.5;
    const y = state.orbital.center.y - targetSize * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(state.fieldCanvas, x, y, targetSize, targetSize);
    ctx.restore();
  }

  function drawPhotonWaves() {
    ctx.save();
    state.photons.forEach((photon) => {
      const age = (state.now - photon.t) / 1000;
      if (age > photon.life) return;
      const alpha = (1 - age / photon.life) * 0.25;
      const offset = age * photon.speed;
      ctx.strokeStyle = `rgba(120, 190, 255, ${alpha})`;
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i += 1) {
        const shift = i * 18;
        ctx.beginPath();
        for (let x = 0; x <= state.width; x += 40) {
          const y = state.height * 0.5 + Math.sin((x + offset + shift) * 0.02) * 18 + i * 12;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawFlashes() {
    state.flashes.forEach((flash) => {
      const age = (state.now - flash.t) / 1000;
      if (age > 0.6) return;
      const alpha = (1 - age / 0.6) * 0.8;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(flash.x - 10, flash.y);
      ctx.lineTo(flash.x + 10, flash.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(flash.x, flash.y - 10);
      ctx.lineTo(flash.x, flash.y + 10);
      ctx.stroke();
      ctx.restore();
    });
  }

  function sampleOrbitalPoint() {
    const type = state.orbital.type;
    const angle = state.orbital.angle;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 12; i += 1) {
      x = randNormal() * 0.6;
      y = randNormal() * 0.6;
      const field = orbitalField(x, y, type, angle);
      if (Math.random() < field * 1.8) break;
    }
    return {
      x: state.orbital.center.x + x * state.orbital.size * 0.45,
      y: state.orbital.center.y + y * state.orbital.size * 0.45,
    };
  }

  function update(dt, now) {
    state.now = now;

    const targetCollapse = state.pointer.down ? 1 : 0;
    state.orbital.collapse = lerp(state.orbital.collapse, targetCollapse, dt * 2.2);

    state.orbital.angle += dt * (0.15 + state.orbital.energy * 0.5);
    state.orbital.energy = lerp(state.orbital.energy, 0.3, dt * 0.4);

    state.photons.forEach((photon) => {
      photon.phase += dt;
    });
    state.photons = state.photons.filter((photon) => state.now - photon.t < photon.life * 1000);

    state.flashes = state.flashes.filter((flash) => state.now - flash.t < 700);

    const kinetic = Math.abs(state.orbital.collapse - targetCollapse) + Math.abs(state.orbital.energy - 0.3);
    if (kinetic < 0.08) {
      state.coherence = clamp(state.coherence + dt, 0, 1.4);
    } else {
      state.coherence = Math.max(0, state.coherence - dt * 1.1);
    }

    if (state.coherence > 1.2 && state.now - state.lastSnap > 2000) {
      state.lastSnap = state.now;
      host.saveSnapshot && host.saveSnapshot(world, world.getSnapshot());
    }

    host.setHud({
      world: "quantum",
      points: state.photons.length,
      signal: `${state.orbital.type}-orbital ${state.pointer.down ? "observe" : "free"}`,
    });
  }

  function render() {
    drawBackground();
    drawPhotonWaves();
    renderOrbitalField();
    drawFlashes();
  }

  function onPointer(type, x, y) {
    if (type === "down") {
      state.pointer.down = true;
      state.pointer.x = x;
      state.pointer.y = y;
      return;
    }
    if (type === "move") {
      state.pointer.x = x;
      state.pointer.y = y;
      if (state.pointer.down) {
        state.orbital.center.x = lerp(state.orbital.center.x, x, 0.05);
        state.orbital.center.y = lerp(state.orbital.center.y, y, 0.05);
      }
      return;
    }
    if (type === "up") {
      state.pointer.down = false;
      const now = state.now;
      const tap = state.tapPending;
      const sameSpot = tap && Math.hypot(tap.x - x, tap.y - y) < 25;
      if (tap && now - tap.t < 320 && sameSpot) {
        if (state.measureTimer) {
          window.clearTimeout(state.measureTimer);
          state.measureTimer = null;
        }
        state.orbital.energy = clamp(state.orbital.energy + 0.4, 0, 1);
        state.orbital.type = state.orbital.type === "s" ? "p" : state.orbital.type === "p" ? "d" : "s";
        state.photons.push({ t: now, life: 2.2, speed: 24, phase: 0 });
        const hit = sampleOrbitalPoint();
        state.flashes.push({ x: hit.x, y: hit.y, t: now });
        state.tapPending = null;
      } else {
        const timer = window.setTimeout(() => {
          state.tapPending = null;
        }, 320);
        state.tapPending = { t: now, x, y, timer };
        state.measureTimer = window.setTimeout(() => {
          const hit = sampleOrbitalPoint();
          state.flashes.push({ x: hit.x, y: hit.y, t: state.now });
          state.orbital.collapse = Math.max(state.orbital.collapse, 0.6);
        }, 320);
      }
      return;
    }
  }

  function init(nextHost) {
    host = nextHost;
    canvas = host.canvas;
    ctx = host.ctx;
    initFieldBuffer();
    setCenter();
  }

  function onResize(width, height) {
    state.width = width;
    state.height = height;
    setCenter();
  }

  function getSnapshot() {
    return {
      orbital: {
        type: state.orbital.type,
        angle: state.orbital.angle,
        energy: state.orbital.energy,
      },
      photons: state.photons.map((p) => ({ life: p.life, speed: p.speed, phase: p.phase })),
      t: Date.now(),
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot) return;
    if (snapshot.orbital) {
      state.orbital.type = snapshot.orbital.type || "p";
      state.orbital.angle = snapshot.orbital.angle || 0;
      state.orbital.energy = snapshot.orbital.energy || 0.3;
    }
    if (Array.isArray(snapshot.photons)) {
      state.photons = snapshot.photons.map((p) => ({
        t: state.now,
        life: p.life || 2,
        speed: p.speed || 24,
        phase: p.phase || 0,
      }));
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
