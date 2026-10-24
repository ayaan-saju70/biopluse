# Local Fonts Bundle Instructions

To run completely offline with custom webfonts without any CDN or Google Fonts tracking, place the following `.woff2` files in this `fonts/` directory:

### 1. Outfit (Sans-Serif for UI & Scientific Mode)
- `outfit-v11-latin-regular.woff2` (weight: 400)
- `outfit-v11-latin-600.woff2` (weight: 600)
- `outfit-v11-latin-700.woff2` (weight: 700)
- `outfit-v11-latin-800.woff2` (weight: 800)

### 2. JetBrains Mono (Monospace for HUD, Telemetry & Equations)
- `jetbrains-mono-v18-latin-regular.woff2` (weight: 400)
- `jetbrains-mono-v18-latin-700.woff2` (weight: 700)

### 3. Fredoka (Rounded Cursive for Kids Mode)
- `fredoka-v14-latin-regular.woff2` (weight: 400)
- `fredoka-v14-latin-600.woff2` (weight: 600)
- `fredoka-v14-latin-700.woff2` (weight: 700)

### Fallback Behavior
The app uses bulletproof native system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` and `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) so everything renders instantly and beautifully even before these files are placed!
