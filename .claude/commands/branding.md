# RRR Branding Context

Use this context whenever working on visual/UI changes in Rum-Runner Rhapsody.

## Brand Palette

### Dark mode (default)
| Token | Value | Role |
|---|---|---|
| `--color-bg-deepest` | `#000000` | Titlebar, statusbar |
| `--color-bg-base` | `#0C0C0C` | Main app background |
| `--color-bg-raised` | `#161616` | Sound buttons, section headers |
| `--color-bg-surface` | `#202020` | Inputs, selects, dropdowns |
| `--color-bg-surface-hover` | `#2A2A2A` | Hover state |
| `--color-bg-surface-active` | `#333333` | Active/pressed |
| `--color-accent` | `#F9B71D` | Primary brand gold — buttons, active states, category headers |
| `--color-accent-dim` | `#D49A00` | Hover on accent elements |
| `--color-accent-glow` | `rgba(249,183,29,0.18)` | Box-shadow glow on sliders |
| `--color-text-primary` | `#F0EBE0` | Main text |
| `--color-text-secondary` | `#9A9080` | Muted/description text |
| `--color-text-dim` | `#5A5550` | Very muted (labels, placeholders) |
| `--color-text-on-accent` | `#000000` | Text sitting on gold background |
| `--color-danger` | `#FF5040` | Destructive actions, errors |
| `--color-border` | `#1E1E1E` | Dividers, section borders |
| `--color-border-light` | `#282828` | Input borders, card outlines |

### Light mode overrides (`html.light`)
Accent shifts to a darker brown-gold (`#BF7200`). Backgrounds become warm creams.

## Logo Assets (in `src/assets/images/`)
| File | Use |
|---|---|
| `wordmark.svg` | Full brandmark (bottle + "Rum-Runner Rhapsody" text) — used in TitleBar |

Source files are in `branding/`. Always prefer SVG over PNG for in-app display.

## Brand SVG Color Palette (from source files)
- **Gold**: `#F9B71D` (primary accent) and `#F8B209` (slight variant — treat as same)
- **Charcoal**: `#525151` (bottle body/fills — replaces black in transparent versions)
- **Near-white**: `#FEFEFE` (highlights and glints)
- No pure black in transparent assets — works on both dark and light backgrounds

## Typography
- **Body**: Outfit (variable, 400–600 weight) — all UI text
- **Display**: TavernloreBB — app name in titlebar, category section headers, version headings
- Body font is Tailwind `font-sans`; display font is `font-display`

## Design Aesthetic
Bold, high-contrast, street-art/speakeasy. Warm dark charcoal backgrounds (not cool blue-gray). Gold is used liberally for active states, highlights, and interactive elements. Never hardcode hex values — always use CSS tokens.

## Key Rules
- Tailwind-first: use `bg-bg-raised`, `text-accent`, `border-border-light`, etc.
- Raw CSS only for pseudo-elements, keyframes, `-webkit-app-region`
- Never use emoji or Unicode icons — use `<Icon name="..." />`
- SVG assets over rasters wherever Electron supports it
