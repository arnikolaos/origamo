# Origamo Manual

Origamo is a kinetic shape playground where geometry becomes a movement program.
The shape you edit is not the drawn path; it drives the tracing machine.

## How It Works
- The polygon's angles become a repeating turn list.
- The tracer moves forward, then turns by (180° - angle), then repeats.
- Edge lengths scale step length, so different shapes yield different motion.

## Core Interactions
- Drag a vertex to reshape the polygon.
- Double-click an edge to insert a new point (desktop).
- Double-tap an edge to insert a new point (mobile).
- Right-click a vertex to remove it (minimum 3 points, desktop).
- Long-press a vertex to remove it (mobile).
- Drag empty space to rotate the whole program.
- Click and hold empty space (no drag) to "breathe" the shape.
- Single click empty space to drop a morph seed.

## Sound
- Sound is meditative; it responds to motion and symmetry.
- Symmetry triggers a minor pentatonic chord; higher symmetry can become unison.
- Point count shifts the key (each n-gon sounds different).
- Use the top-right sound slider to adjust volume.

## Visual Language
- The tracer leaves a soft neon trail that fades over time.
- The polygon shows servo-like joints and minimal link lines.
- Background is a slow drifting gradient.

## Behaviors (Whispers)
- Breath: holding still gently expands the shape; release returns to neutral.
- Inertia: vertices lag slightly during drags for tactile feel.
- Energy breathing: when calm, the trace slows and thickens.
- Loop settle: when the trace closes a loop, it slows/thickens briefly.
- Ghost memory: recent shapes linger faintly in the background.
- Symmetry halo: a soft outline appears at high symmetry.
- Balance tension: edges near equal length brighten subtly.
- Edge whisper: midpoint glows when adjacent edges align.
- After-touch glow: the last moved vertex leaves a short glow ring.
- Quiet orbit: a tiny dot orbits the centroid when calm.
- Morph seed: a soft ring that gently attracts the nearest vertex.
- Portal: after sustained symmetry, a faint ring bends the trace slightly.
- Wrap portals: the tracer reappears on the opposite edge with a faint portal ring.
- Excited state: sustained fast motion adds a cyan emission glow.
- Emission wave: when excitement cools, a ripple wave emits.

## Tips
- Try building symmetry slowly; the system rewards it with subtle cues.
- Add a point, then drag it slightly to hear a new key and feel resistance.
- Fast sweeps build excitement; stopping releases a ripple.

## Constraints
- Offline, no dependencies.
- HTML + Canvas + Vanilla JS only.
