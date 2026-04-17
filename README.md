# work-notes-dashboard

Minimal monorepo with:
- a Nuxt frontend in `frontend/`
- an Express backend in `backend/`
- backend static serving for the generated frontend dist

## Layout

- `frontend/` generates a static site into `.output/public`
- `backend/` serves that generated output and falls back to `index.html`

## Commands

- `npm install`
- `npm run build:frontend`
- `npm run build:backend`
- `npm run build`
- `npm run start`
- `npm run test`

## Environment

- `PORT` controls the backend port
- `FRONTEND_BUILD_DIR` overrides the frontend dist directory
- `FRONTEND_BASE_PATH` lets the backend mount the frontend under a subpath

## Serving model

The backend does not build the frontend. It only resolves the dist directory, checks that it exists, serves static assets, and returns `index.html` for SPA-style routes.
