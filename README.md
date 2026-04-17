# work-notes-dashboard

Minimal monorepo with:
- a Nuxt frontend in `frontend/`
- an Express backend in `backend/`
- static frontend serving from the backend
- SQLite persistence for notes

## Layout

- `frontend/` generates a static site into `.output/public`
- `backend/` serves that generated output, exposes `/api/notes`, and falls back to `index.html`
- `backend/data/notes.sqlite` is the default SQLite file path

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
- `SQLITE_DB_PATH` overrides the SQLite database file path

## Notes API

- `GET /api/notes` lists notes
- `GET /api/notes/:id` reads a single note
- `POST /api/notes` creates a note with `{ "title": "...", "content": "..." }`
- `PUT /api/notes/:id` updates a note with `{ "title": "...", "content": "..." }`
- `DELETE /api/notes/:id` deletes a note

## Serving model

The backend does not build the frontend. It resolves the dist directory, checks that it exists, serves static assets, creates the SQLite schema on startup, exposes the notes API, and returns `index.html` for SPA-style routes.
