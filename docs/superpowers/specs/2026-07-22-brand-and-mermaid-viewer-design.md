# Kubernetes Brand and Mermaid Viewer Design

## Goal

Update the documentation brand to use the Kubernetes name and logo, and make every Mermaid diagram readable both inline and in an interactive full-screen viewer.

## Brand

- Replace the visible `云原生开发手册` brand with `Kubernetes`.
- Add a local Kubernetes logo asset to the left of the brand text.
- Make the logo and brand text one link to the documentation homepage, `/`.
- Keep the brand compact and stable at desktop, tablet, and mobile widths.
- Use an accessible logo description without repeating the visible brand name to screen readers.

The global VitePress title will also become `Kubernetes`, so browser titles no longer contain the old brand text.

## Mermaid Label Fix

The current edge-label clipping is caused by a line-height mismatch. Mermaid sizes a two-line HTML label using its `1.5` line height, while the site's global paragraph rule makes the nested label paragraph render at a larger line height. The text then exceeds the fixed `foreignObject` height.

The Mermaid component will isolate generated node and edge label paragraphs from the documentation paragraph typography. Generated labels will inherit Mermaid's own line height and use zero paragraph margins. The fix must apply to both light and dark rerenders without changing ordinary documentation paragraphs.

## Full-Screen Viewer

Each successfully rendered Mermaid figure will expose an icon-only full-screen button with a tooltip and accessible name. Activating it opens a teleported, viewport-sized modal overlay containing the same rendered SVG.

The viewer will provide:

- pointer drag panning for mouse, pen, and touch;
- zoom in, zoom out, and reset controls;
- mouse-wheel or trackpad zoom centered on the pointer position;
- an explicit close button;
- `Escape` close behavior;
- focus entry and focus restoration to the full-screen trigger;
- background scroll locking while open;
- a grab/grabbing cursor and restrained controls that do not cover diagram content unnecessarily.

The initial view will fit the complete diagram inside the available viewport while preserving its aspect ratio. Reset returns to that fitted view. Zoom will use bounded steps so the diagram cannot disappear through extreme scaling. Panning remains available at every zoom level, with no page-level overflow.

The implementation will use an in-page modal rather than the browser Fullscreen API. This avoids platform permission and mobile compatibility differences while still filling the viewport.

## Component Boundaries

`MermaidDiagram.vue` remains responsible for rendering, theme rerenders, wide inline sizing, and viewer state. A small dedicated viewer component may be extracted if it keeps pointer, keyboard, and focus behavior isolated and testable; otherwise the logic stays local to avoid unnecessary abstraction.

The viewer receives rendered SVG markup and never reparses Mermaid source. Opening the viewer therefore cannot trigger a second Mermaid render or create a theme mismatch.

## Accessibility

- The overlay uses `role="dialog"`, `aria-modal="true"`, and an accessible title.
- Icon buttons have accessible names and visible focus states.
- Opening moves focus into the viewer; closing restores focus to the originating trigger.
- Background content is not scrollable while the modal is open.
- Dragging is optional: all essential actions remain available through buttons and keyboard.
- Reduced-motion preferences disable nonessential transform transitions.

## Testing

Implementation follows test-driven development.

Automated tests will cover:

- the Kubernetes title, local logo, and homepage logo link;
- Mermaid label typography isolation;
- full-screen open and close behavior;
- `Escape` handling and focus restoration;
- zoom bounds and reset;
- pointer-driven panning;
- body scroll-lock cleanup on close and unmount;
- no second Mermaid render when the viewer opens;
- existing theme rerender and wide-diagram behavior.

Final browser verification will cover desktop and mobile layouts, label completeness, button placement, mouse/touch-equivalent dragging, zoom/reset, modal containment, light/dark themes, console output, and page-level overflow.

## Out of Scope

- Linking the brand to kubernetes.io.
- Editing diagram source text solely to avoid wrapping.
- Exporting diagrams as image files.
- Persisting viewer zoom or pan state between openings.
