# Mermaid Diagram Container Polish Design

**Date:** 2026-07-22

## Goal

Present each inline Mermaid diagram as one cohesive, polished tool surface. The diagram and its full-screen action must read as one component instead of a chart followed by a detached action row.

## Approved Visual Direction

Use the approved **A: lightweight overlay** direction:

- Wrap the diagram in a single framed container with an 8px radius, a subtle divider border, and a quiet soft background derived from existing VitePress theme tokens.
- Keep the container visually restrained. It must support the documentation content rather than resemble a dashboard card or add a branded accent strip.
- Place the full-screen control inside the container at the top-right, outside the horizontally scrolling layer.
- Size the button to exactly `24px` square with a `14px` Maximize icon, a 5px radius, and a clear hover and keyboard-focus state.
- Reserve enough space above the diagram so the button never covers Mermaid labels or edges.
- Preserve an uncluttered appearance in both light and dark modes.

### Full-Screen Operation Bar

Use the approved **A: compact segmented** toolbar direction for the full-screen viewer:

- Keep one light-weight toolbar surface with a 7px radius, 3px inner padding, and 2px control gaps.
- Use four stable `30px` icon buttons with `16px` Lucide icons: zoom in, zoom out, reset, and close.
- Add a one-pixel divider before the close button so the destructive exit action is visually grouped but still distinct.
- In light mode use a white surface with a quiet gray border and restrained shadow. In dark mode use a neutral charcoal surface with a lighter border; do not introduce a purple or saturated gradient.
- Keep hover states subtle and provide a high-contrast `:focus-visible` ring. Respect reduced motion by removing the toolbar transition.
- Preserve the existing desktop top-right placement and mobile bottom-centered placement with safe-area insets. The compact controls must not change the diagram's fit geometry or cover diagram content.

## Layout And Scrolling

The outer `.mermaid-diagram` remains the semantic `figure` and must not create a horizontal scroll container. A new inner shell owns the border, background, clipping, and positioned action.

Only the diagram viewport scrolls horizontally. The full-screen control remains fixed at the shell's top-right while a wide diagram scrolls underneath the reserved content area. The layout must not create nested horizontal scrollbars or page-level overflow on mobile.

The source fallback and error message remain readable and do not show the full-screen action until Mermaid has produced a valid SVG.

## Interaction And Accessibility

- The action remains an icon-only button with `aria-label` and `title` set to `全屏查看图表`.
- The 24px control is the approved target size. It must have a visible high-contrast focus outline and must not move when the diagram width changes.
- Opening continues to reuse the existing rendered SVG rather than invoking Mermaid again.
- Closing restores focus to the same button.
- Reduced-motion users receive no decorative transition.

## Integration Corrections

The visual change will also resolve three issues found during integration review:

1. The full-screen SVG copy must namespace every SVG `id` and rewrite local references such as `url(#...)`, `href`, `xlink:href`, and ARIA IDREF attributes. The inline diagram and full-screen copy must not introduce duplicate document IDs.
2. `MermaidDiagram` must react when `encodedSource` changes. A new source rerenders the inline SVG, updates an open viewer through the existing `svg` prop, and remains protected by the current render-generation guard.
3. Horizontal scrolling must exist only on the inner viewport, eliminating the current nested figure and viewport scroll containers.

The viewer continues to accept only SVG produced by the existing Mermaid renderer configured with `securityLevel: 'strict'`; no arbitrary external HTML is added to this data path.

## Verification

Automated tests must cover:

- the approved shell structure and 24px action contract;
- the action remaining outside the horizontal scroller;
- no horizontal overflow rule on the outer figure;
- no duplicate IDs or broken local references between inline and full-screen SVGs;
- rerendering after `encodedSource` updates without stale render races;
- existing open, close, focus restoration, theme update, pointer, zoom, and cleanup behavior.

Browser QA must verify the container at desktop and mobile widths in light and dark modes, including a wide diagram, button placement, internal scrolling, focus visibility, label readability, and full-screen interaction.
