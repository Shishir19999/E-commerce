# ShopLane client

React 19 + Vite. See the repository README for how to run the full-stack and the browser-only live preview modes.

- `npm run dev` / `npm run build`: talk to the Express API (`VITE_API_URL`)
- `npm run dev:demo` / `npm run build:pages` / `npm run preview:pages`: in-browser backend for the live preview (build output in `dist`, base path `/E-commerce/`)
- `npm test`: unit tests (in-browser backend, shared rules, CSV, motion, checkout validation)
- `npm run lint`
