# Aqua Alchemy — Liquid Sort Puzzle

A polished, responsive browser-based Water Sort Puzzle game built with React, TypeScript, Vite, Tailwind CSS, SVG graphics, and the Web Audio API.

## Features

- **Playable Puzzle Engine**: Deterministic level generation verified by a state-space solver so every level is guaranteed solvable.
- **Smooth Pour Animations**: Physical bottle lifting, tilting toward the target bottle, curved glowing liquid stream, meniscus surface highlights, and completion bubbles.
- **Responsive Layout**: Adapts dynamically from 320px smartphones to 1920px desktop monitors with zero horizontal overflow.
- **Audio & Accessibility**: Synthesized Web Audio API chimes and water droplets, optional ambient melody, vibration haptics, keyboard shortcuts (`1-0`, `R`, `Z`, `H`, `Esc`), and optional Colorblind liquid symbols.
- **Local Persistence**: Saves level progress, coin balance, settings, daily rewards, and active board state in `localStorage`.

## Local Development

```bash
npm install
npm run dev
```

Run engine verification tests:

```bash
npx tsx src/game/engine.test.ts
```

## Production Build & Hostinger Deployment

1. Build the static production bundle:

```bash
npm run build
```

2. Upload the entire contents of the generated `dist/` folder to your Hostinger `public_html/` directory (via File Manager, FTP, or Git deployment).
3. No backend server or environment variables are required for deployment.
