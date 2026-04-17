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
- `BEDROCK_AWS_REGION` sets the AWS region for the LangChain Bedrock client
- `BEDROCK_AWS_ACCESS_KEY_ID` and `BEDROCK_AWS_SECRET_ACCESS_KEY` optionally override the AWS default credential chain
- `BEDROCK_AWS_SESSION_TOKEN` optionally sets a temporary session token when using explicit credentials
- `BEDROCK_MODEL_ID` selects the Bedrock model used by the LangChain client

## Notes API

- `GET /api/notes` lists notes
- `GET /api/notes/:id` reads a single note
- `POST /api/notes` creates a note with `{ "title": "...", "content": "..." }`
- `PUT /api/notes/:id` updates a note with `{ "title": "...", "content": "..." }`
- `DELETE /api/notes/:id` deletes a note

## LangChain Notes Tools

The backend exposes LangChain tools that wrap the existing SQLite repository:

- `create_note` creates a note with `{ "title": "...", "content": "..." }`
- `get_note` reads a note by `{ "id": 123 }`
- `update_note` updates a note with `{ "id": 123, "title": "...", "content": "..." }`

These tools reuse the same repository implementation as the HTTP API. They are backend-side utilities and do not add a second persistence layer.

## Serving model

The backend does not build the frontend. It resolves the dist directory, checks that it exists, serves static assets, creates the SQLite schema on startup, exposes the notes API, and returns `index.html` for SPA-style routes.
