ORIGAMO ROADMAP
Project: Origamo
Role: Core Engine + Domain-Based Worlds
Status: Engine Locked

ENGINE BASELINE (LOCKED)

The Origamo engine is now considered stable and locked.

Locked scope includes:
	•	Core interaction model (points, edges, rotation)
	•	Motion, trace, symmetry, breath, excitation
	•	Touch and pointer handling (desktop and mobile)
	•	Portal wrap, bloom, memory seeds
	•	Rendering pipeline (Canvas 2D, offline-safe)

Engine-core files:
	•	app.js
	•	geometry.js
	•	robot.js
	•	render.js
	•	index.html
	•	styles.css

Documentation:
	•	ENGINE_LOCK.md
	•	MANUAL.md
	•	JOURNAL.md

Rule:
The engine must not be modified directly.
Any future changes must be implemented via domains or optional modules.
Regression must always be reversible to this locked state.

⸻

PHASE 1 — DOMAIN FRAMEWORK

Goal:
Transform Origamo from a single experience into a multi-world system without altering the engine.

Deliverables:
	1.	Domain State Layer
Add a domain controller to global state:

	•	active domain id
	•	pending domain during transition
	•	transition progress
	•	overlay alpha for visual veil

	2.	Domain Registry
Define all domains in a single registry.
Each domain specifies:

	•	name
	•	color bias
	•	rule hooks
	•	render hooks

No domain may override core engine logic.
	3.	Domain Switching UI

	•	Bottom world strip with domain cards
	•	Minimal glyphs and names
	•	Active domain highlighted
	•	Optional press-and-hold radial world selector

	4.	Domain Transition Effects

	•	Portal ring
	•	Background hue shift
	•	Veil fade
	•	Bloom on commit

Exit criteria:
	•	Domain switching feels magical, not like a menu
	•	Shape state and memory persist across domains
	•	No instructions required for switching

⸻

PHASE 2 — FOLD DOMAIN (ORIGAMI)

Goal:
Introduce the first meaning layer by reinterpreting shapes as fold patterns.

Concept:
	•	Vertices are fold control points
	•	Edges are creases
	•	Motion is the folding sequence
	•	Symmetry equals stability

Deliverables:
	1.	Fold State Layer
Add fold-specific state:

	•	per-edge crease strength
	•	per-vertex fold depth (mountain/valley)
	•	overall fold tension

	2.	Fold Logic

	•	High symmetry leads to stable folds
	•	Calm interaction refines creases
	•	Fast motion causes deformation
	•	Mountain and valley folds alternate naturally

	3.	Fold Rendering

	•	Paper-like shading using 2D depth illusion
	•	Solid lines for mountain folds
	•	Dashed lines for valley folds
	•	Reduced neon trace intensity

	4.	Fold Snap Event
Triggered when symmetry remains high for a sustained duration.
Effects:

	•	Creases lock momentarily
	•	Subtle visual confirmation
	•	Optional soft “paper click”
	•	Snapshot saved to memory

Exit criteria:
	•	Kids understand Fold as a new world without explanation
	•	Stable folds feel like discoveries, not achievements

⸻

PHASE 3 — RETENTION LAYER

Goal:
Give kids a reason to return the next day.

Deliverables:
	1.	Local Memory / Journal

	•	Automatically save discovered states
	•	Allow restoring or replaying saved states
	•	No accounts, no cloud dependency

	2.	Soft Discovery Prompts
Examples:

	•	“Try to make a stable fold.”
	•	“Find a shape that balances.”
	•	“This one never repeats.”

These are not tasks or goals.
They fade in and out gently.
	3.	Export / Share (Optional)

	•	Save image
	•	Save seed code
	•	Save fold pattern

Exit criteria:
	•	Kids return to continue something they created
	•	Sessions have continuity across days

⸻

PHASE 4 — ADDITIONAL DOMAINS

Domains are added one at a time and validated individually.

Recommended order:
	1.	Gravity
	•	Mass, sag, collapse
	•	Structural intuition
	2.	Architecture
	•	Plans, frames, circulation
	•	Stability versus flow
	3.	Machines
	•	Shapes as programs
	•	Behavior-first thinking
	4.	Electrons
	•	Repulsion, equilibrium
	•	Energy field intuition

Each domain:
	•	Reuses the same engine
	•	Changes interpretation and feedback only
	•	Has one signature “snap” or recognition moment

⸻

PHASE 5 — ENGINE-BASED PRODUCTS (SPIN-OFFS)

Goal:
Turn domains into standalone experiences for distribution and marketing.

Examples:
	•	Fold the City (Fold + Architecture)
	•	Gravity Paper (Fold + Gravity)
	•	Living Machines (Machines + motion)

Rules:
	•	No new engine
	•	Each product is a curated Origamo world
	•	Origamo remains the underlying core

⸻

STRATEGIC PRINCIPLES (LOCKED)
	•	Origamo is an engine, not a game
	•	Domains add meaning, not mechanics
	•	No gamification
	•	No forced teaching
	•	Discovery over instruction
	•	Memory over rewards

⸻

IMMEDIATE NEXT ACTION

Implement:
	1.	Domain framework
	2.	Fold domain MVP

Do not add additional domains before the retention layer is in place.

⸻

End of roadmap text.
