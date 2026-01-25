Perfect. Below is the final, clean Markdown file containing both:
	1.	Domain UI Switching design
	2.	Complete Origami / Fold domain implementation spec

You can paste this directly into Terminal with cat > origamo_domains_ui_and_fold.md or save it in Codex.

⸻


# Origamo Domains — UI Switching & Fold Domain
**Engine:** Origamo  
**Status:** Design + Implementation Spec  
**Version:** v1.0

---

## Part I — Domain UI Switching

### 1. Purpose

Domains allow Origamo to become a multi-world system without changing controls.
Switching domains should feel like changing **the rules of reality**, not toggling settings.

Goals:
- Zero instructions
- Discovery-based
- Magical, not technical
- Reversible at any time

---

### 2. UX Concept

Domains are presented as **worlds**.

The user never “opens a menu”.
They **move between realities**.

---

### 3. Primary UI: World Strip (Bottom)

A persistent bottom strip shows available domains:

- Geometry
- Fold
- Gravity
- Electrons
- Architecture
- Machines

Each world has:
- a name
- a minimal abstract glyph
- a subtle color bias (still pink-first)

Only the active world is fully opaque.
Others are quiet, not disabled.

---

### 4. Switching Gestures

Kids can switch domains in multiple intuitive ways:

1. **Tap a world card**  
   → immediate transition

2. **Press & hold anywhere (≈0.6s)**  
   → radial “world wheel” appears under the finger  
   → drag to a world and release

3. *(Optional)* **Two-finger swipe left / right**  
   → cycle worlds sequentially

Multiple paths reduce friction and increase discovery.

---

### 5. Transition Language (Critical)

Switching a domain must feel rewarding.

Visual sequence:
1. A soft **portal ring** appears near the shape centroid
2. Background gradient slowly shifts hue
3. A thin veil fades in (≈300ms)
4. Domain commits at midpoint
5. Veil fades out + small bloom

Sound (optional):
- soft phase-shift tone
- no “button click” sounds

---

### 6. State Architecture

Add a domain controller to global state:

```js
state.domain = {
  id: "geometry",
  pending: null,
  t: 0,
  overlayAlpha: 0
};

Domain registry:

const DOMAINS = {
  geometry: { name: "Geometry" },
  fold: { name: "Fold" },
  gravity: { name: "Gravity" },
  electrons: { name: "Electrons" },
  architecture: { name: "Architecture" },
  machines: { name: "Machines" }
};

Switch function:

function switchDomain(nextId) {
  if (nextId === state.domain.id) return;
  state.domain.pending = nextId;
  state.domain.t = 0;
}

The animation loop handles the transition and commits the new domain at midpoint.

⸻

7. Domain Switching Rules
	•	Switching never resets the shape
	•	Trace may fade, not clear
	•	Memory snapshots are preserved
	•	Domains reinterpret existing state

This reinforces continuity.

⸻

Part II — Fold Domain (Origami)

8. Domain Identity

Name: Fold
Concept: Folding space
Metaphor: Origami / paper engineering

In Fold:
	•	Shapes are not polygons
	•	They are crease patterns
	•	Motion represents folding sequences

⸻

9. Interpretation Mapping

Origamo Element	Fold Meaning
Vertex	Fold control point
Edge	Crease
Trace	Fold sequence
Symmetry	Structural stability
Instability	Buckling / collapse


⸻

10. Fold State Model

Add a fold-specific state layer:

state.fold = {
  crease: [],        // per-edge 0..1
  depth: [],         // per-vertex -1..1 (valley/mountain)
  tension: 0         // overall fold tension
};

Initialize arrays whenever point count changes.

⸻

11. Fold Stability Logic

Fold stability is derived from existing metrics:
	•	symmetry score
	•	edge length variance
	•	angle variance

Rules:
	•	High symmetry → stable folds
	•	Low symmetry → noisy creases
	•	Calm interaction → refinement
	•	Fast motion → deformation

No explicit scoring.

⸻

12. Mountain / Valley Assignment

Mountain and valley folds alternate naturally:

depth[i] = sin(i * TAU / n + rotation) * stability;

Interaction effects:
	•	Slow drag → smooth crease refinement
	•	Fast drag → local inversion (fold flip)
	•	Rotation → rotates crease polarity

This feels intentional and craft-like.

⸻

13. Rendering — Paper Illusion (2D)

No real physics simulation.
Use perceptual tricks.

Paper Surface
	•	Use centroid-based shading
	•	One side lighter, one darker
	•	Depth derived from fold.depth

Crease Lines
	•	Mountain folds: solid lines
	•	Valley folds: dashed lines
	•	Thickness scales with crease strength

ctx.setLineDash(isMountain ? [] : [4,4]);

Trace
	•	Reduced neon intensity
	•	Thicker, softer stroke
	•	Feels like pressure on paper

⸻

14. Fold Snap (Stability Moment)

When:
	•	symmetry > ~0.92
	•	held for ~1–2 seconds

Then:
	•	creases stabilize
	•	a soft outline appears briefly
	•	optional quiet “paper click” sound
	•	snapshot saved to memory

This replaces “winning”.

⸻

15. Interaction Mapping (No New Controls)

All existing interactions remain unchanged:
	•	Drag points → reshape folds
	•	Add point → new crease intersection
	•	Remove point → simplify pattern
	•	Rotate → rotate paper
	•	Hold still → tension settles

Meaning changes, controls do not.

⸻

16. Fold Domain Feedback (Soft)

No instructions.
Only subtle cues:
	•	“Fold settling”
	•	“Crease stabilizing”
	•	“Twist forming”

These can appear briefly in the HUD or be purely visual.

⸻

17. Engineering Checklist (Fold)
	1.	Add domain state + registry
	2.	Implement domain switching transitions
	3.	Add fold state arrays
	4.	Map symmetry → stability
	5.	Implement crease rendering
	6.	Implement paper shading
	7.	Add stable-fold snap detection
	8.	Save fold snapshots to memory

⸻

18. Strategic Note

Fold is the first domain that introduces materiality.
It is the strongest bridge between play, intuition, and real-world thinking.

Once Fold works, other domains follow naturally.

⸻

End of Document

---

### Next recommended step (very concrete)
Implement **only**:
1. the **domain switch bar**
2. the **Fold rendering layer** (no physics yet)

That alone will already change next-day retention.

When you’re ready, I can:
- break this into **implementation tickets**, or
- write **exact code stubs** for Fold rendering inside `render.js`, or
- design the **Gravity domain** with the same level of detail.
