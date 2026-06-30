# Saneea Brand File

## Identity

- Arabic name: سنيع
- English name: Saneea
- Tagline Arabic: نضبطها لك
- Tagline English: We'll set it up for you
- Category: Saudi event planning and supplier coordination platform

## Logo

The Saneea logo is an Arabic calligraphy wordmark in black with a small green tagline underneath.

Primary logo assets:

- Web wordmark: `client/src/assets/logo.png`
- Mobile wordmark: `saneea_mobile_react/assets/brand/logo.png`
- App icon: `saneea_mobile_react/assets/brand/app_icon.png`
- App icon foreground: `saneea_mobile_react/assets/brand/app_icon_foreground.png`
- Web app icon: `client/public/images/app_icon.png`
- Favicon: `client/public/favicon.svg`

## Logo Usage

- Use the full wordmark on login, splash, privacy, and public-facing pages.
- Use the app icon for mobile launcher icons, PWA icons, and square avatars.
- Keep clear space around the logo equal to at least the height of the Arabic tagline.
- Use the logo on white or very light neutral backgrounds.
- Do not recolor the Arabic wordmark.
- Do not crop the wordmark or remove the tagline in primary brand contexts.
- Do not stretch, rotate, shadow, or place the logo over busy images.

## Color Palette

Logo-derived colors:

| Token | Hex | Usage |
| --- | --- | --- |
| `ink` | `#000000` | Logo wordmark, high-emphasis text |
| `ink-soft` | `#111111` | Primary UI actions and headings |
| `tagline-green` | `#254C39` | Logo tagline color, refined brand accent |
| `brand-green` | `#1A5C32` | Existing app accent for buttons, active states, focus rings |
| `green-soft` | `#E8F4EC` | Subtle backgrounds and selected states |
| `surface` | `#FFFFFF` | Main backgrounds |
| `surface-soft` | `#FAFAFA` | Page and card backgrounds |
| `line` | `#EBEBEB` | Borders and dividers |
| `muted` | `#7A7A7A` | Secondary text |
| `danger` | `#EF4444` | Destructive actions |
| `warning` | `#F59E0B` | Pending states |
| `success` | `#22C55E` | Confirmed/success states |

Recommended usage:

- Primary CTAs: `#111111` with white text.
- Secondary CTAs and active navigation: `#1A5C32` with white text.
- Subtle selected states: `#E8F4EC` with `#1A5C32` text.
- Main text: `#111111`.
- Arabic logo/tagline surfaces: white or `#FAFAFA`.

## Typography

- Arabic UI font: Almarai
- Latin fallback: Roboto
- Base stack: `Almarai, Roboto, sans-serif`
- Use regular weight for body text and bold for headings, labels, and main actions.

## Voice

Saneea should feel practical, trustworthy, and Saudi-local. The writing should be clear and service-oriented, with short labels and direct confirmations.

Arabic tone:

- Friendly but professional.
- Prefer clear action words like: احجز، أضف، تأكيد، مراجعة، إرسال.
- Avoid long explanatory paragraphs inside operational screens.

English tone:

- Plain and helpful.
- Use direct labels like: Book, Add, Confirm, Review, Send.
- Keep descriptions short.

## UI Direction

- Keep admin screens dense, organized, and easy to scan.
- Mobile screens should prioritize one clear action per section.
- Cards should be functional, not decorative.
- Use icons for repeated actions where possible.
- Avoid heavy gradients and decorative shapes.
- Use green as an accent, not as the whole interface.

## Brand Tokens

Use `brand-tokens.json` in this repo as the machine-readable companion to this file.
