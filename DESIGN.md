# Wavelength interface guide

Wavelength is a dark-first listening space. The interface should feel calm and immersive, with an editorial music mood and clear controls. Mint marks primary actions and active playback; soft blue supports secondary atmosphere. Avoid loud gradients, dense chrome, and decorative visualizers that imply audio analysis the app does not perform.

## Foundations

- **Canvas:** near-black blue graphite (`#080b10`) with a restrained teal ambient glow.
- **Surfaces:** raised blue graphite panels, fine low-contrast borders, and soft shadows. Reserve brighter borders for focus and hover.
- **Accent:** mint (`#83e6c0`) for primary actions and active states; pale blue (`#78bce8`) as a secondary atmospheric hue.
- **Typography:** Inter/system sans, compact uppercase eyebrow labels, clear sentence-case headings, and readable body copy.
- **Shape:** rounded controls and cards (12–28px); pill shapes for primary actions and status.
- **Spacing:** use Tailwind's 4px spacing scale. Keep page gutters around 20px on phones and 32–36px on wider screens.

## Interaction

- Provide visible keyboard focus, descriptive accessible names, and at least 44px touch targets for primary mobile controls.
- Use short opacity/transform transitions for hover, focus, and page entry. Honor `prefers-reduced-motion` globally.
- Motion timing tokens are fast `140ms`, normal `240ms`, emphasis `420ms`; ambient movement is slow, transform-only, and decorative.
- Keep playback persistent. On phones, prioritize artwork, play/pause, and seek; keep secondary volume controls in the wider player layout.
- Artwork is content: use the existing fallback, preserve aspect ratio, and lazy-load below-the-fold images.
- Loading and empty states should explain the next useful action without inventing songs, recommendations, or activity.

## Layout

- Desktop: fixed-width left navigation, scrollable content, persistent bottom player.
- Mobile: content first, fixed five-destination bottom navigation with safe-area padding, persistent compact bottom player.
- Responsive pages should use fluid columns and avoid horizontal overflow outside intentional song carousels.

## Shared implementation

Global color and motion foundations live in `packages/web/app/globals.css`; semantic Tailwind palette values live in `packages/web/tailwind.config.ts`. Reuse the shared `Button`, `Input`, `SongRow`, `SongCard`, and shell components rather than creating one-off control styles. Keep API contracts, playback behavior, authentication, and upload rights confirmation unchanged when styling screens.

Reusable motion primitives are the `page-enter`, `motion-reveal`, `motion-stagger`, `hover-lift`, `artwork-crossfade`, and `player-ambient` classes. They animate opacity and transforms; artwork/ambient blur is limited to the hero rather than applied to scrolling lists.
