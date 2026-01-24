import { turnForAngle, stepLengthForAngle } from "./geometry.js";

export class TurtleProgram {
  constructor(position, heading, baseStep) {
    this.position = { ...position };
    this.heading = heading;
    this.baseStep = baseStep;
    this.stepProgress = 0;
    this.stepIndex = 0;
    this.angles = [60, 60, 60];
  }

  setAngles(angles) {
    this.angles = [...angles];
  }

  update(delta, speed) {
    const currentAngle = this.angles[this.stepIndex];
    const stepLength = stepLengthForAngle(currentAngle, this.baseStep);
    const advance = speed * delta;
    this.position.x += Math.cos(this.heading) * advance;
    this.position.y += Math.sin(this.heading) * advance;
    this.stepProgress += advance;

    if (this.stepProgress >= stepLength) {
      this.stepProgress = 0;
      this.heading += (turnForAngle(currentAngle) * Math.PI) / 180;
      this.stepIndex = (this.stepIndex + 1) % this.angles.length;
    }

    return this.position;
  }
}

export class TwoLinkArm {
  constructor(base, linkA, linkB) {
    this.base = { ...base };
    this.linkA = linkA;
    this.linkB = linkB;
    this.theta1 = 0;
    this.theta2 = 0;
    this.joint = { x: base.x + linkA, y: base.y };
    this.effector = { x: base.x + linkA + linkB, y: base.y };
  }

  setBase(base) {
    this.base.x = base.x;
    this.base.y = base.y;
  }

  update(target, delta, stiffness = 12) {
    const dx = target.x - this.base.x;
    const dy = target.y - this.base.y;
    const dist = Math.hypot(dx, dy);
    const reach = Math.min(dist, this.linkA + this.linkB - 4);

    const cos2 = (reach * reach - this.linkA * this.linkA - this.linkB * this.linkB) /
      (2 * this.linkA * this.linkB);
    const clampedCos2 = Math.max(-1, Math.min(1, cos2));
    const desiredTheta2 = Math.acos(clampedCos2);

    const k1 = this.linkA + this.linkB * Math.cos(desiredTheta2);
    const k2 = this.linkB * Math.sin(desiredTheta2);
    const desiredTheta1 = Math.atan2(dy, dx) - Math.atan2(k2, k1);

    const spring = 1 - Math.exp(-stiffness * delta);
    this.theta1 += (desiredTheta1 - this.theta1) * spring;
    this.theta2 += (desiredTheta2 - this.theta2) * spring;

    this.joint.x = this.base.x + Math.cos(this.theta1) * this.linkA;
    this.joint.y = this.base.y + Math.sin(this.theta1) * this.linkA;
    this.effector.x = this.joint.x + Math.cos(this.theta1 + this.theta2) * this.linkB;
    this.effector.y = this.joint.y + Math.sin(this.theta1 + this.theta2) * this.linkB;

    return this.effector;
  }
}
