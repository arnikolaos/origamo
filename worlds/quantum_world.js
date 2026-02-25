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

  function normalize(vec) {
    const len = Math.hypot(vec.x, vec.y, vec.z) || 1;
    return { x: vec.x / len, y: vec.y / len, z: vec.z / len };
  }

  function rotate3D(p, rot) {
    // rotate around x then y then z
    let x = p.x;
    let y = p.y;
    let z = p.z;
    const cx = Math.cos(rot.x);
    const sx = Math.sin(rot.x);
    const cy = Math.cos(rot.y);
    const sy = Math.sin(rot.y);
    const cz = Math.cos(rot.z);
    const sz = Math.sin(rot.z);

    // x-rotation
    let y1 = y * cx - z * sx;
    let z1 = y * sx + z * cx;
    y = y1;
    z = z1;

    // y-rotation
    let x2 = x * cy + z * sy;
    let z2 = -x * sy + z * cy;
    x = x2;
    z = z2;

    // z-rotation
    let x3 = x * cz - y * sz;
    let y3 = x * sz + y * cz;
    x = x3;
    y = y3;

    return { x, y, z };
  }

  const state = {
    width: 0,
    height: 0,
    now: performance.now(),
    particles: [],
    orbital: {
      type: "p",
      energy: 0.4,
      collapse: 0,
      rot: { x: 0.2, y: 0.6, z: 0 },
      targetRot: { x: 0.2, y: 0.6, z: 0 },
      size: 1,
    },
    pointer: { x: 0, y: 0, down: false, lastX: 0, lastY: 0 },
    tapPending: null,
  };

  let host = null;
  let ctx = null;

  function setSize() {
    state.orbital.size = Math.min(state.width, state.height) * 0.85;
  }

  function orbitalWeight(p, type) {
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    const radial = r * r * Math.exp(-r * 0.9);
    const node = Math.abs(Math.sin(r * 3.4)) * 0.7 + 0.3;
    if (type === "s") return radial * node;
    if (type === "p") return radial * node * (p.z * p.z);
    if (type === "d") {
      const lobes = (p.x * p.y);
      return radial * node * (lobes * lobes + (p.z * p.z - 0.5 * (p.x * p.x + p.y * p.y)) ** 2 * 0.6);
    }
    return radial * node;
  }


  function samplePoint(type) {
    const shells = type === "s" ? [0.25, 0.65, 1.05] : type === "p" ? [0.5, 1.0] : [0.6, 1.15];
    for (let i = 0; i < 24; i += 1) {
      const dir = normalize({
        x: randNormal(),
        y: randNormal(),
        z: randNormal(),
      });
      const shell = shells[Math.floor(Math.random() * shells.length)];
      const r = Math.abs(randNormal() * 0.08 + shell);
      const p = { x: dir.x * r, y: dir.y * r, z: dir.z * r };
      const w = orbitalWeight(p, type);
      if (Math.random() < clamp(w * 2.2, 0, 1)) return p;
    }
    return { x: 0, y: 0, z: 0 };
  }

  function rebuildParticles() {
    const count = 26000;
    state.particles = new Array(count);
    for (let i = 0; i < count; i += 1) {
      state.particles[i] = samplePoint(state.orbital.type);
    }
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(
      state.width * 0.45,
      state.height * 0.3,
      state.width * 0.1,
      state.width * 0.5,
      state.height * 0.6,
      state.width * 0.9
    );
    g.addColorStop(0, "rgba(10, 12, 18, 1)");
    g.addColorStop(0.6, "rgba(4, 5, 8, 1)");
    g.addColorStop(1, "rgba(1, 2, 4, 1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    const nebula = ctx.createRadialGradient(
      state.width * 0.3,
      state.height * 0.4,
      state.width * 0.1,
      state.width * 0.3,
      state.height * 0.4,
      state.width * 0.7
    );
    nebula.addColorStop(0, "rgba(120, 170, 255, 0.08)");
    nebula.addColorStop(1, "rgba(120, 170, 255, 0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function drawParticles() {
    const center = { x: state.width * 0.5, y: state.height * 0.55 };
    const size = state.orbital.size * (1 - state.orbital.collapse * 0.35);
    const rot = {
      x: state.orbital.rot.x,
      y: state.orbital.rot.y,
      z: state.orbital.rot.z,
    };
    const color = state.orbital.type === "s"
      ? { r: 120, g: 170, b: 255 }
      : state.orbital.type === "p"
        ? { r: 210, g: 120, b: 255 }
        : { r: 200, g: 190, b: 90 };

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = rotate3D(state.particles[i], rot);
      const depth = 1 / (1 + p.z * 0.7);
      const x = center.x + p.x * size * 0.35 * depth;
      const y = center.y + p.y * size * 0.35 * depth;
      const alpha = clamp(0.12 * depth, 0.04, 0.35);
      const radius = 1.6 * depth;
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function update(dt, now) {
    state.now = now;
    const targetCollapse = state.pointer.down ? 1 : 0;
    state.orbital.collapse = lerp(state.orbital.collapse, targetCollapse, dt * 2.2);
    state.orbital.rot.x = lerp(state.orbital.rot.x, state.orbital.targetRot.x, dt * 4);
    state.orbital.rot.y = lerp(state.orbital.rot.y, state.orbital.targetRot.y, dt * 4);
    state.orbital.rot.z = lerp(state.orbital.rot.z, state.orbital.targetRot.z, dt * 4);

    host.setHud({
      world: "quantum",
      points: state.particles.length,
      signal: `${state.orbital.type}-orbital ${state.pointer.down ? "observe" : "free"}`,
    });
  }

  function render() {
    drawBackground();
    drawParticles();
  }

  function onPointer(type, x, y) {
    if (type === "down") {
      state.pointer.down = true;
      state.pointer.x = x;
      state.pointer.y = y;
      state.pointer.lastX = x;
      state.pointer.lastY = y;
      return;
    }
    if (type === "move") {
      const dx = x - state.pointer.lastX;
      const dy = y - state.pointer.lastY;
      state.pointer.x = x;
      state.pointer.y = y;
      if (state.pointer.down) {
        state.orbital.targetRot.y += dx * 0.01;
        state.orbital.targetRot.x += dy * 0.01;
      }
      state.pointer.lastX = x;
      state.pointer.lastY = y;
      return;
    }
    if (type === "up") {
      state.pointer.down = false;
      const now = state.now;
      const tap = state.tapPending;
      const sameSpot = tap && Math.hypot(tap.x - x, tap.y - y) < 25;
      if (tap && now - tap.t < 320 && sameSpot) {
        state.orbital.type = state.orbital.type === "s" ? "p" : state.orbital.type === "p" ? "d" : "s";
        rebuildParticles();
        state.tapPending = null;
      } else {
        const timer = window.setTimeout(() => {
          state.tapPending = null;
        }, 320);
        state.tapPending = { t: now, x, y, timer };
      }
      return;
    }
  }

  function init(nextHost) {
    host = nextHost;
    ctx = host.ctx;
    setSize();
    rebuildParticles();
  }

  function onResize(width, height) {
    state.width = width;
    state.height = height;
    setSize();
  }

  function getSnapshot() {
    return {
      orbital: {
        type: state.orbital.type,
        rot: state.orbital.targetRot,
      },
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || !snapshot.orbital) return;
    state.orbital.type = snapshot.orbital.type || "p";
    state.orbital.targetRot = snapshot.orbital.rot || { x: 0.2, y: 0.6, z: 0 };
    rebuildParticles();
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
