# Design System — Calm · Close · Neutral

The feel: warm paper, graphite ink, quiet photography, and room to breathe. Warm, not clinical; gentle, not loud. Botanical line art can add character, but the interface itself must not carry a green tint.

## Principles

- **Space is a feature.** Generous padding, few elements per screen, one clear focus.
- **Soft, never harsh.** Large radii, low-contrast borders, feathered shadows, gradient washes.
- **Neutral palette.** Warm paper, stone, graphite, muted clay, and blue-grey. Green is reserved for semantic success, not the brand or screen tint.
- **Motion breathes.** Slow, eased, spring-based. Things settle in; nothing snaps.
- **Two voices.** "You" is neutral graphite; "them" is warm clay — labels and position also carry meaning so color is never the only distinction.
- **Language stays precise.** Streaks say “6 day streak” with a short encouragement. Never use relationship-duration wording such as “days together,” or garden/bloom progress metaphors.

## Color tokens

Defined in `constants/theme.ts` as `Palette`. Light is primary; dark is a dusk variant.

### Light (default)
| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#F6F3EE` | app background (warm paper) |
| `bgDeep` | `#ECE8E1` | grouped sections |
| `surface` | `#FCFAF7` | raised surfaces |
| `surfaceAlt`| `#F0ECE6` | insets, wells |
| `text` | `#262625` | primary graphite |
| `textSoft` | `#5F5D59` | secondary |
| `textFaint`| `#8A8781` | tertiary / captions |
| `line` | `#E2DDD6` | hairline borders |
| `primary` | `#704936` | warm umber actions / "you" |
| `primaryDeep`|`#4B2F24` | pressed / emphasis |
| `primarySoft`|`#E9DDD6` | selected warm-neutral surface |
| `partner` | `#A8765C` | warm clay / "them" |
| `accent` | `#7B838A` | blue-grey highlight |
| `bloom` | `#B97E82` | muted rose — hearts, nudges |
| `gold` | `#B79358` | streak flame / milestones |
| `success` | `#6F846F` | semantic completion only |

### Gradients
- **Dawn:** `#F6F3EE → #EFECE7 → #E5E2DD`.
- **Neutral field:** `#EBE8E2 → #D9D5CE → #CBC5BD`.
- **Dusk:** `#232323 → #1C1C1C → #161616`.

### Dark (dusk)
| Token | Hex |
| --- | --- |
| `bg` | `#161616` |
| `surface` | `#202020` |
| `surfaceAlt`| `#292929` |
| `text` | `#F0EEE9` |
| `textSoft` | `#B8B4AD` |
| `line` | `#343434` |
| `primary` | `#E0B09A` |
| `primaryDeep` | `#F2C8B4` |
| `primarySoft` | `#3B2E29` |
| `partner` | `#D0A08A` |

## Typography

- **Display / headings:** Fraunces, for a warm editorial voice.
- **Body / UI:** Inter.
- Scale: `hero 34/40` · `display 27/34` · `title 21/28` · `heading 16/22` · `body 15/23` · `caption 13/19` · `micro 11/14`.
- Weights: 400 body, 600 headings, 700 display. Generous line-height everywhere.
- Letter-spacing: slight negative on display (`-0.3`), positive on all-caps micro labels (`+0.6`).

## Spacing & shape

- **Spacing scale** (`space`): `4, 8, 12, 16, 20, 24, 32, 40, 56` — call them xs…3xl.
- **Screen padding:** 20 horizontal.
- **Radii** (`Radius`): `card 28`, `hero 34`, `pill 999`, `chip 14`, `tile 22`, `inset 18`.
- **Shadows:** single soft shadow token — low opacity (0.06–0.10), large blur (20–30), small y-offset. Cards float faintly, never hard.

## Components (in `components/ui/`)

- `Screen` — safe-area padded scroll container with the app background.
- `Card` — rounded surface with soft shadow + optional gradient.
- `SectionHeader` — small overline + title, lots of space above.
- `Pill` / `Chip` — soft rounded tags and toggles.
- `Avatar` — circular, with an optional presence ring (graphite=you, clay=them).
- `StreakCounter` — an unboxed flame + plain day count.
- `Button` — filled warm action, soft, light, and ghost variants; 52px standard / 44px compact; pill-shaped; haptic on press. Disabled controls alone use dedicated inert grey tokens. — [codex · done-unverified]
- `MoodDot` — small mood swatch.
- `RecordingWaveform` — small live bars driven by microphone metering; it visibly responds without overwhelming the composer.

## Motion

- Springs: gentle (`damping 18, stiffness 140`). Fades 250–400ms ease-out.
- Press: scale to 0.97 + light haptic (`expo-haptics`).
- Reveal (question, partner pick): slow spring + subtle opacity.
- Nudge send: a heart/leaf floats up and fades.
- Respect reduce-motion.

## Accessibility

- Text contrast ≥ 4.5:1 for body on surfaces (palette chosen to pass).
- Min tap target 44×44.
- Every icon-only control has an `accessibilityLabel`.
- Don't encode meaning in color alone (mood has a label; you/them also differ by position/label).
- Dynamic type friendly; avoid fixed heights on text containers.

## Mobile text entry

- Every input screen must be keyboard-aware; the focused field and its submit action must remain reachable when the software keyboard opens.
- Android uses resize behavior for the software keyboard. iOS uses keyboard avoidance inside the current native header rather than a hard-coded top offset.
- Scrollable forms dismiss the keyboard interactively/on drag and keep taps available for switches, selectors, and submit buttons.
- Text inputs use at least 16px text, theme-aware cursor/selection color, autocorrect where appropriate, clear accessibility labels, and dismiss the keyboard after successful submission.
