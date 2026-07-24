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
- Domains have no individual border, radius, shadow, or colored outline. They remain visually independent through generous internal padding and very light grid separators only where an adjacent domain exists.
- Use a zero-gap grid with separators between columns and rows. Wide layouts separate three columns, medium layouts separate two, and mobile layouts separate each stacked neighbor; no line should appear beside an empty grid slot.
- Topic rows form a compact list inside each module: use subtle separators and no nested mini-card treatment. The Kubernetes row has no special background or border; its title and arrow change to the active theme color on hover.
- Wide layouts use three domain columns, medium layouts use two, and mobile layouts use one. The page must not overflow horizontally.
- Light/dark modes continue to use existing VitePress variables; domain tones remain small-area accents rather than large color fields.

## Behavior and Accessibility

- No homepage search button is rendered.
- The Kubernetes row does not render a completed-status label or icon. Its right-side arrow is the only action affordance.
- Planned topics remain non-interactive `div` elements without keyboard focus.
- Kubernetes remains the only interactive topic and recommended-start link.
- Existing heading hierarchy, focus styles, theme behavior, and VitePress global search remain intact.

## Topic Icons

- Every one of the 24 topic rows has a decorative `20px` icon with stable dimensions.
- Use Lucide icons for all 24 topics so the catalog has one consistent visual language and no asset-loading or dark-mode inversion exceptions.
- Topic icons use a soft neutral color by default. The available Kubernetes row changes its icon, title, and arrow to the active theme color on hover and keyboard focus; planned topics remain neutral and non-interactive.
- Decorative icons use `aria-hidden`; the adjacent topic title remains the accessible name.

## Verification

- Focused homepage tests assert there is no homepage search button and continue to assert the five paths, six domains, 24 topics, exact path sequences, Kubernetes link, and planned-topic semantics.
- Typecheck and the full Vitest suite pass.
- Production build and browser checks verify independent domain boundaries, responsive layout, readable light/dark rendering, and working global search.

## Out of Scope

- No changes to Kubernetes content, route structure, global navigation labels, CI, or the existing diagram/fullscreen implementation.
