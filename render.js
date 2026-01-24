export function clear(ctx, width, height, t) {
  const gradient = ctx.createRadialGradient(
    width * 0.5 + Math.cos(t * 0.1) * width * 0.15,
    height * 0.3 + Math.sin(t * 0.1) * height * 0.1,
    width * 0.1,
    width * 0.5,
    height * 0.5,
    width * 0.9
  );
  gradient.addColorStop(0, "rgba(90, 15, 61, 0.9)");
  gradient.addColorStop(0.6, "rgba(43, 4, 27, 0.95)");
  gradient.addColorStop(1, "rgba(16, 3, 12, 1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawTrace(ctx, points, now) {
  ctx.save();
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const age = (now - current.t) / 1000;
    const alpha = Math.max(0, 1 - age / 5);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(255, 103, 179, ${alpha * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRobot(ctx, arm, pulse) {
  ctx.save();
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255, 213, 232, 0.5)";
  ctx.beginPath();
  ctx.moveTo(arm.base.x, arm.base.y);
  ctx.lineTo(arm.joint.x, arm.joint.y);
  ctx.lineTo(arm.effector.x, arm.effector.y);
  ctx.stroke();

  drawHub(ctx, arm.base.x, arm.base.y, 10, pulse);
  drawHub(ctx, arm.joint.x, arm.joint.y, 8, pulse * 1.2);
  drawHub(ctx, arm.effector.x, arm.effector.y, 6, pulse * 1.4, true);
  ctx.restore();
}

function drawHub(ctx, x, y, radius, pulse, glow) {
  ctx.save();
  const ring = radius + Math.sin(pulse) * 1.8;
  ctx.strokeStyle = glow ? "rgba(127, 232, 255, 0.8)" : "rgba(255, 103, 179, 0.8)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(x, y, ring, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 103, 179, 0.7)";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBloom(ctx, center, sides, size, alpha) {
  if (!sides) return;
  const angleStep = (Math.PI * 2) / sides;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(255, 213, 232, 0.6)";
  ctx.lineWidth = 1.6;
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
