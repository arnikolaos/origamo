# Origamo Journal

## 2026-01-23
- Initialized local Git repository.
- Added `.gitignore` for macOS and editor artifacts.
- Built the single-mode shape playground with draggable vertices, point add/remove, rotation, and kinetic trace.
- Added discovery layers: soft symmetry constraints, depth hull, angle echoes, ghost memories, morph seeds, and surprise blooms.
- Kept everything offline-ready (HTML + Canvas + vanilla JS).

## 2026-01-23 (cont.)
- Added whisper layers: after-touch glow, edge whispers, loop-settle, quiet orbit, balance tension, energy breathing.
- Tuned breath to avoid overshrink; separated seed click from breath hold.
- Added excitation state with visual emission glow + audio shimmer.
- Adjusted emission to trigger on cooling threshold for a cleaner "energy release" cue.
- Added edge wrap portals for tracer wrap-around and removed debug HUD.
- Added edge-wrap glow rings and cleanup for wrap portal effects.
- Added mobile long-press delete and double-tap add-point handling.
- Added wrap-around portal rings at screen edges.
- Strengthened touch event prevention to block iOS selection popups.

## 2026-01-23 (engine lock)
- Locked current engine baseline for reuse across future projects.
- Added ENGINE_LOCK.md marker.

## 2026-01-24
- Added domain folder structure under `domains/`.
- Implemented the first world (Fold) with crease rendering, paper shading, and symmetry snap rings.
- Added a bottom world strip for switching between worlds.
- Added domain transition veil + portal ring effect.
- Strengthened Fold paper shading and crease contrast for higher legibility.
- Added Fold snap paper-click sound and short crease lock.
- Added radial world wheel (press-and-hold on empty space) for fast switching.
- Fold now uses stability-driven wrinkle overlays, crease growth on drag, and a snap sweep highlight.
- Implemented Fold-line gameplay: drag a fold line, preview reflection, release to fold.
- Added fold-line creases, fold quality snap logic, and a minimal Fold book snapshot list.
- Fold lines now fade quickly after the fold.
- Folding now splits edges at the fold line for more paper-accurate results.
