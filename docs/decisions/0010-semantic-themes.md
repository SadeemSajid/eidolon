# 0010: Shared semantic themes for the interface, canvas and editor

Status: Accepted.

Define palette values and shared derived roles in src/theme/themes.css. Component
styles consume semantic roles such as background, foreground, accent, warning,
border, selection and syntax colors. Keep fixed color literals out of component
CSS, React Flow projections and editor extensions. Light and dark definitions
supply the same roles; the original dark palette remains the dark theme.

A small external store owns the Light/Dark/System preference. Initialize it before
React mounts and apply the resolved data-theme attribute to the document root.
Persist the preference under eidolon.theme, tolerate unavailable storage, and
follow live prefers-color-scheme changes only in System mode. Default to System
when no valid preference exists. A React context exposes stable snapshots to
React Flow's colorMode and CodeMirror. Footer Settings provides a labeled theme selector.

SVG edges, labels, markers, minimap and dimmed-selection colors use CSS variables
so changing themes cannot require regenerating a board or resetting canvas
positions. CodeMirror uses shared syntax/style tokens and a separate appearance
compartment for its dark-mode facet. Reconfigure that compartment without
recreating the editor, resetting Vim state, discarding drafts or losing history.

The theme applies to webview contents and native web form controls via CSS
color-scheme. Native OS window decorations remain controlled by the desktop
host/OS. No runtime process or hardware-model behavior changes.

Tests cover persisted/invalid/blocked preferences, live system changes, token
parity, removal of component color literals, and switching an active Vim editor
while preserving its document and undo history. Manual visual inspection in
both browser and native WebKitGTK remains part of release verification.
