Below is a clean, structured Markdown document you can drop directly into Codex as a project instruction / spec file.

It is written to be:
	•	implementation-oriented (clear for future you or collaborators),
	•	Mac-safe by design,
	•	aligned with everything we agreed so far,
	•	free of logos, frameworks, or unnecessary tooling.

You can name it something like:

/codex/Shape_Assembly_Robot_v1.md


⸻

Shape Assembly — Kinetic Origami Robot

Codex Project Specification (v1.0)

⸻

1. Purpose

Create a kid-friendly, visually rich, robotic geometry playground where basic shapes (starting from a triangle) are used as movement programs for an abstract robot mechanism.

The system emphasizes:
	•	intuitive exploration,
	•	constructive logic,
	•	smooth kinetic motion,
	•	and aesthetic pleasure (pink-forward, abstract robotics).

This is not a math app or a worksheet.
It is a kinetic construction lab where geometry emerges from motion.

⸻

2. Platform & Compatibility

Target
	•	All Macs (Intel + Apple Silicon)
	•	Safari, Chrome, Firefox
	•	Offline capable

Technology (locked)
	•	HTML + Vanilla JavaScript
	•	Canvas 2D
	•	No build tools
	•	No dependencies
	•	No server
	•	No Node.js

Deployment
	•	Single folder
	•	Double-click index.html to run

⸻

3. Core Concept

Triangle as a Robot Program

A triangle is not just a shape.
Its angles define a turning pattern for a robot.
	•	Interior angles: A, B, C
	•	Constraint: A + B + C = 180°
	•	External turn at each step:

turn = 180° − angle



The robot:
	1.	Moves forward
	2.	Turns using A → B → C repeatedly
	3.	Leaves a trace behind

From this trace:
	•	regular polygons,
	•	stars,
	•	rosettes,
	•	and circle-like forms emerge naturally.

⸻

4. The Twist (Signature Idea)

Kinetic Origami Robot

The shapes are not drawn directly.

They are:
	•	produced by a robotic mechanism
	•	traced by an end-effector
	•	stabilized by constraints

The geometry is the output of motion.

This makes the system feel:
	•	robotic,
	•	alive,
	•	exploratory,
	•	and original.

⸻

5. Visual Language

Overall Style
	•	Abstract robotics
	•	No mascots
	•	No logos
	•	No literal robots

Color
	•	Primary: hot pink / magenta
	•	Secondary: pale pink, off-white
	•	Accent: subtle cyan / violet
	•	Background: dark pink / purple gradients

Elements
	•	Joints → circular servo hubs (pulsing rings)
	•	Links → rigid arms with spring motion
	•	Trace → neon laser line
	•	Glow → subtle bloom, never overpowering

⸻

6. Layout

Main Canvas
	•	Fullscreen Canvas 2D
	•	Robot + trace in the center
	•	Slow drifting background gradient

Bottom Bar — “Parts Tray”
	•	Horizontal bar at the bottom
	•	Tappable cards:
	•	Triangle
	•	Pentagon
	•	Hexagon
	•	Octagon
	•	N-gon
	•	Circle
	•	Each card:
	•	name
	•	minimal abstract thumbnail
	•	Active card glows

Minimal HUD (top-left)
	•	Angle A / B / C
	•	Current detected shape (if any)
	•	Calibration feedback (soft, non-textbook)

⸻

7. Robotic Elements (MVP)

1. 2-Link Robot Arm (IK)
	•	Fixed base
	•	Two rigid links
	•	End-effector follows the trace target
	•	Smooth spring interpolation

Purpose:

Shows how robots “reach” and draw.

⸻

2. Servo Hubs
	•	Visible rings at:
	•	base
	•	joint 1
	•	joint 2
	•	Pulse gently
	•	React when angles change

Purpose:

Communicates joints and motors without explanation.

⸻

3. End-Effector Trace
	•	Laser-like trail
	•	Builds over time
	•	Older points fade slightly

Purpose:

Makes motion visible and beautiful.

⸻

4. Snap Bloom (Discovery Moment)

When the system detects a near-regular polygon:
	•	A faint, perfect polygon briefly appears
	•	The bottom bar highlights the detected shape
	•	Then returns to kinetic trace mode

Purpose:

Discovery instead of validation.

⸻

8. Shape Logic

Regular Polygon Detection
	•	Average external turn:

avgTurn = (turnA + turnB + turnC) / 3


	•	If avgTurn ≈ 360 / n (within tolerance):
	•	polygon n is detected

Circle Approximation
	•	Very small average turn
	•	High step count
	•	Trace becomes smooth and round

⸻

9. Interaction Model

Angle Control
	•	A and B adjustable
	•	C auto-computed
	•	Always valid triangle
	•	Changes animate smoothly

Modes (Behavior, not “Settings”)
	•	Servo Smooth (default)
	•	Stepper (discrete turns)
	•	Laser Trace (strong trail)
	•	Calibration (snap to clean forms)

⸻

10. Motion Rules
	•	All motion uses spring easing
	•	No instant snapping (except bloom)
	•	Inertia always visible
	•	Robot never “teleports”

⸻

11. File Structure (Codex)

/ShapeAssembly/
  index.html
  app.js        // main loop + state
  robot.js      // IK + servo logic
  geometry.js   // triangle + turn logic
  render.js     // drawing functions
  styles.css

(For MVP, a single index.html is acceptable.)

⸻

12. Non-Goals (Explicitly Excluded)
	•	No scores
	•	No timers
	•	No levels
	•	No ads
	•	No accounts
	•	No math quizzes
	•	No forced explanations

Learning happens through interaction.

⸻

13. Future Extensions (Not v1)
	•	WebGL visual mode
	•	Export shapes as SVG
	•	iPad / touch-first version
	•	Multi-arm robots
	•	Shape “recipes” library

⸻

14. Core Principle (Guiding Rule)

If it feels like a lesson, remove it.
If it feels like a toy, keep it.
If it feels like a machine, perfect it.

⸻

End of Codex Specification

⸻

If you want, next I can:
	•	convert this into Codex command blocks,
	•	version it (v1.0.0) with change-log,
	•	or generate the final unified index.html that fully matches this spec.

