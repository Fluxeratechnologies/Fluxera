# Fluxera Frontend

The React/Vite interface for Fluxera's live continuity control plane.

---

## 📂 Directory Structure

```
frontend/
├── public/
│   ├── favicon.svg               # Fluxera favicon
│   └── icons.svg                 # Shared SVG symbols
├── src/
│   ├── components/               # Reusable UI component library
│   │   ├── base/                 # Source-owned BoardUI primitives
│   │   ├── application/          # Application-level BoardUI components
│   │   ├── Globe.jsx             # Synthetic COBE execution globe
│   │   ├── ProductStages.jsx     # Keyboard-operated product previews
│   │   └── design-system.jsx     # Shared motion and status helpers
│   ├── hooks/
│   │   └── useLiveOperations.js  # Durable SSE reconnect and refresh logic
│   ├── styles/                   # BoardUI semantic theme and typography
│   ├── index.css                 # V2 design tokens and responsive styles
│   ├── App.jsx                   # Public, workspace, and staff route trees
│   └── main.jsx                  # React DOM entrypoint
├── index.html                    # Vite application root HTML
├── package.json                  # Frontend dependencies & build scripts
└── vite.config.js                # Vite build configuration
```

---

## 🛠️ Development & Build

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```

---

## Serving the app

React modules cannot be opened directly with `file://`. Use Vite during development:

```bash
npm run dev
```

Then open the HTTP URL printed by Vite, usually `http://localhost:5173/`.
