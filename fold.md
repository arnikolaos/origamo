Agreed. Below is a concrete Fold-domain mechanics plan: what we implement, how it behaves, and exactly where it hooks into your existing engine (without breaking the engine lock).

I’m going to assume your current architecture: app.js owns state + input + loop, render.js draws, geometry.js gives measurements, and the engine already tracks things like symmetry / excitation / breath / seeds. (That matches your codebase structure and current “engine lock” milestone.)

⸻

Fold Domain: the mechanic you are building

Player experience (what the kid feels)
	•	“This shape is paper.”
	•	Dragging points “creases” the paper.
	•	Balanced shapes become “clean folds.”
	•	Unbalanced shapes “buckle” and “wrinkle” gently.
	•	When it stabilizes, it locks for a moment and you get a satisfying “fold click” (visual, optional sound).

No instructions needed. The material itself communicates.

⸻

Fold State Model (minimal, sufficient)

Add a fold state object (created/reset whenever point count changes):
	•	crease[i] per edge: 0..1
	•	depth[i] per vertex: -1..1 (valley/mountain)
	•	tension overall 0..1 (how “tight” the paper is)
	•	wrinkle overall 0..1 (noise amount, driven by instability)
	•	lockHold seconds of stable fold holding (for snap detection)

This is not physics; it is perceptual material modeling.

⸻

Fold Stability (the core intelligence)

Fold needs one single numeric “stability” value each frame:
	•	Stability goes up when:
	•	symmetry is high
	•	edge lengths are uniform
	•	angles are near-uniform
	•	motion is calm
	•	Stability goes down when:
	•	user is dragging hard / fast
	•	shape is irregular
	•	excitation is high

Practical formula (robust and simple)

Compute:
	•	sym = clamp(symmetryScore, 0..1) (you already have something similar)
	•	edgeVar = normalized variance of edge lengths (0 is perfect)
	•	angleVar = normalized variance of interior angles (0 is perfect)
	•	calm = 1 - clamp(speedEnergy, 0..1)

Then:
	•	regularity = 1 - clamp(0.55*edgeVar + 0.45*angleVar, 0..1)
	•	stability = clamp(0.65*sym + 0.35*regularity, 0..1) * (0.35 + 0.65*calm)

This produces a stable, intuitive signal.

⸻

Crease Growth (how folds “form”)

Creases should strengthen where the “paper is worked”.

Mechanic:
	•	When user drags near an edge/vertex, crease increases locally.
	•	When stable, creases slowly “set” (smooth out).
	•	When unstable, creases become noisy (wrinkle) rather than “disappearing.”

Implementation

Each frame:
	•	crease[i] += workAmountNearEdge(i) * delta
	•	crease[i] -= relaxRate * delta * (1 - tension) (very slow)
	•	clamp 0..1

Where workAmountNearEdge is derived from:
	•	pointer proximity to that edge or its vertices
	•	drag speed / energy

If you do not want pointer proximity, you can do a simpler version:
	•	increase crease on edges with high curvature / turning (use angle deltas)

⸻

Mountain/Valley Depth (the origami feeling)

Depth must feel purposeful. The simplest strong approach:
	1.	Base alternating pattern around polygon
	2.	Modulated by stability
	3.	Locally influenced by drag direction and speed

Base assignment:
	•	depth[i] = sin(i * 2π / n + phase) * 0.8 * stability

Local influence:
	•	when a vertex is dragged fast, invert that vertex depth slightly for a moment (fold “flip”)
	•	when calm, depths settle toward base assignment

This gives “craft” without teaching.

⸻

“Fold Snap” (signature moment)

This is the retention hook inside the domain.

Definition:
	•	If stability > 0.92 continuously for ~1.2s → snap

Snap behavior:
	•	freeze small wobble for 400ms
	•	brighten crease lines briefly
	•	show a soft paper highlight sweep across the polygon
	•	optionally play a short “tick”
	•	store a memory snapshot (“stable fold achieved”)

This is discovery, not reward.

⸻

Rendering: what changes visually in Fold

You already render neon trace. Fold adds a paper layer.

Render layers in Fold domain
	1.	Background stays pink, but more “paper-lab” (less cyber)
	2.	Paper polygon fill with subtle gradient shading
	3.	Crease lines (solid vs dashed)
	4.	Trace softer and slightly thicker, reduced glow
	5.	Wrinkle noise overlay (only when unstable)
	6.	Snap highlight sweep

Crease rendering rules
	•	Mountain: solid, brighter, slightly thicker
	•	Valley: dashed, slightly dimmer
	•	Thickness = 1 + 2*crease[i]
	•	Opacity = 0.25 + 0.55*crease[i]

Paper shading (2D illusion)

No 3D. Use:
	•	centroid c
	•	for each edge, normal direction
	•	shade intensity from depth near that edge

Even simpler:
	•	fill polygon with a radial gradient centered slightly off-centroid
	•	add a second gradient that oscillates with average depth

This looks “paper-like” immediately.

⸻

Engineering plan: where to implement what

A) app.js
	•	Add state.domain.id === 'fold' check
	•	Add state.fold initialization/reset when point count changes
	•	In update loop:
	•	compute stability inputs (symmetry, edgeVar, angleVar, calm)
	•	update fold (crease/depth/tension/wrinkle/lockHold)
	•	detect snap and trigger snap state

B) geometry.js

Add helpers (pure functions):
	•	edgeLengths(points)
	•	angles(points) (interior angles)
	•	varianceNormalized(arr)
	•	regularityScore(points) (optional convenience)

C) render.js

Add:
	•	renderFold(ctx, state, points):
	•	paper fill
	•	crease lines
	•	wrinkle overlay
	•	snap sweep
	•	adjusted trace rendering

Do not contaminate base renderer; domain renderer wraps it.

⸻

Minimal Fold MVP (you should implement first)

If you want the fastest high-impact version, do this in order:
	1.	Domain switch → fold toggles renderer and update hook
	2.	Paper fill shading
	3.	Crease lines (mountain/valley) based on alternating depth
	4.	Stability computed from symmetry + regularity
	5.	Snap moment when stable

That alone will feel like “origami”.

Then add:
	•	crease growth from drag energy
	•	wrinkle noise when unstable
	•	sound tick

⸻

Practical acceptance tests (kid test in 2 minutes)

Fold is “working” if a kid:
	•	switches to Fold
	•	says “it looks like paper” without being told
	•	drags 2–3 times and sees creases strengthen
	•	pauses and sees it settle
	•	gets a snap moment and tries again

If they do that, retention improves.

⸻



