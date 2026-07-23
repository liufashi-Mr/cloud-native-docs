# Homepage Domain Cards and Search Removal Design

## Goal

Make the homepage technology catalog visually independent by domain and remove the duplicate homepage search button, while preserving the global VitePress search entry.

## Scope

- Remove the homepage search proxy button, its click handler, its icon import, and its focused test fixture/assertion.
- Keep the existing global navigation search unchanged.
- Render the six technology domains as independent responsive units.
- Keep the existing 24-topic catalog, Kubernetes link, planned-topic semantics, domain colors, theme switching, and route behavior unchanged.

## Visual Design

- The domain grid has no shared outer border.
- Each domain is an independent module panel with a neutral hairline boundary, a clean theme surface, and a small `3px` top accent in its domain tone. Do not use saturated fills or a prominent colored outline.
- Domain panels are separated by a stable `16px` grid gap and use `align-items: start`, so different topic counts produce intentional independent heights.
- Topic rows form a compact list inside each module: use subtle separators and no nested mini-card treatment. The Kubernetes row may use a very light brand-tinted surface, but its border must remain lighter than the module boundary.
- Wide layouts use three domain columns, medium layouts use two, and mobile layouts use one. The page must not overflow horizontally.
- Light/dark modes continue to use existing VitePress variables; domain tones remain small-area accents rather than large color fields.

## Behavior and Accessibility

- No homepage search button is rendered.
- Planned topics remain non-interactive `div` elements without keyboard focus.
- Kubernetes remains the only interactive topic and recommended-start link.
- Existing heading hierarchy, focus styles, theme behavior, and VitePress global search remain intact.

## Verification

- Focused homepage tests assert there is no homepage search button and continue to assert the five paths, six domains, 24 topics, exact path sequences, Kubernetes link, and planned-topic semantics.
- Typecheck and the full Vitest suite pass.
- Production build and browser checks verify independent domain boundaries, responsive layout, readable light/dark rendering, and working global search.

## Out of Scope

- No changes to Kubernetes content, route structure, global navigation labels, CI, or the existing diagram/fullscreen implementation.
