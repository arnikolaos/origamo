const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const modeLabel = document.getElementById("modeLabel");
const pointsLabel = document.getElementById("pointsLabel");
const signalLabel = document.getElementById("signalLabel");
const volumeControl = document.getElementById("volumeControl");
const worldCards = Array.from(document.querySelectorAll(".domain-card"));

const TAU = Math.PI * 2;

const host = {
  canvas,
  ctx,
  ui: {
    volume: volumeControl,
  },
  setHud(data) {
    if (data.world !== undefined) modeLabel.textContent = data.world;
    if (data.points !== undefined) pointsLabel.textContent = data.points;
    if (data.signal !== undefined) signalLabel.textContent = data.signal;
  },
  saveSnapshot(world, snapshot) {
    try {
      const key = `origamo:gallery:${world.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.unshift({ t: Date.now(), snapshot });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 12)));
    } catch (err) {
      // ignore storage errors
    }
  },
};

const WORLD_REGISTRY = {
  geometry: window.GeometryWorld,
  fold: window.FoldWorld,
  quantum: window.QuantumWorld,
};

let currentWorld = null;
let nextWorld = null;
let transition = { active: false, t: 0, overlay: 0 };

function initWorld(world) {
  if (!world || world._initialized) return;
  world.init(host);
  world._initialized = true;
}

function switchWorld(id) {
  if (!WORLD_REGISTRY[id]) return;
  if (currentWorld && currentWorld.id === id) return;
  nextWorld = WORLD_REGISTRY[id];
  initWorld(nextWorld);
  transition.active = true;
  transition.t = 0;
}

function setActiveCard(id) {
  worldCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.domain === id);
  });
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (currentWorld && currentWorld.onResize) currentWorld.onResize(width, height, ratio);
  if (nextWorld && nextWorld.onResize) nextWorld.onResize(width, height, ratio);
}

function drawTransition() {
  if (!transition.active) return;
  const alpha = transition.overlay;
  if (alpha <= 0) return;
  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);
  const center = { x: width * 0.5, y: height * 0.52 };
  const pulse = Math.sin(transition.t * Math.PI);
  const radius = Math.min(width, height) * (0.18 + pulse * 0.04);
  ctx.save();
  ctx.fillStyle = `rgba(8, 2, 8, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = `rgba(255, 213, 232, ${alpha * 0.6})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (!currentWorld) {
    currentWorld = WORLD_REGISTRY.geometry;
    initWorld(currentWorld);
    currentWorld.onEnter && currentWorld.onEnter();
    currentWorld.onResize && currentWorld.onResize(
      canvas.width / (window.devicePixelRatio || 1),
      canvas.height / (window.devicePixelRatio || 1),
      window.devicePixelRatio || 1
    );
    setActiveCard(currentWorld.id);
  }

  if (transition.active) {
    transition.t += dt / 0.8;
    transition.overlay = Math.sin(Math.min(1, transition.t) * Math.PI) * 0.35;
    if (transition.t >= 0.5 && nextWorld) {
      currentWorld && currentWorld.onExit && currentWorld.onExit();
      currentWorld = nextWorld;
      nextWorld = null;
      currentWorld.onEnter && currentWorld.onEnter();
      currentWorld.onResize && currentWorld.onResize(
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1),
        window.devicePixelRatio || 1
      );
      setActiveCard(currentWorld.id);
    }
    if (transition.t >= 1) {
      transition.active = false;
      transition.t = 0;
      transition.overlay = 0;
    }
  }

  if (currentWorld) {
    currentWorld.update(dt, now);
    currentWorld.render(ctx);
  }

  drawTransition();
  requestAnimationFrame(loop);
}

function forwardPointer(type, event) {
  if (!currentWorld || !currentWorld.onPointer) return;
  const position = { x: event.clientX, y: event.clientY };
  currentWorld.onPointer(type, position.x, position.y, {
    pointerType: event.pointerType || "mouse",
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    button: event.button,
  });
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  forwardPointer("down", event);
}, { passive: false });

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") event.preventDefault();
  forwardPointer("move", event);
}, { passive: false });

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerType === "touch") event.preventDefault();
  try { canvas.releasePointerCapture(event.pointerId); } catch (err) { /* ignore */ }
  forwardPointer("up", event);
}, { passive: false });

canvas.addEventListener("dblclick", (event) => {
  forwardPointer("dblclick", event);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

worldCards.forEach((card) => {
  card.addEventListener("click", () => {
    switchWorld(card.dataset.domain);
  });
});

window.addEventListener("resize", resize);

resize();
requestAnimationFrame(loop);
