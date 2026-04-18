# work-notes-dashboard

Minimal monorepo with:
- a Nuxt frontend in `frontend/`
- an Express backend in `backend/`
- static frontend serving from the backend
- LangChain Converse-powered chat that can inspect and update notes
- SQLite persistence for notes
- file-based SQLite migrations that run automatically on backend startup

## Layout

- `frontend/` generates a static site into `.output/public`
- `backend/` serves that generated output, exposes `/api/notes` and `/api/chat`, and falls back to `index.html`
- `backend/data/notes.sqlite` is the default SQLite file path
- `backend/src/db/migrations/` stores sequential `.sql` migration files
- `backend/dist/db/migrations/` is populated during the backend build so the runtime can read the same files from `dist`

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

## SQLite Migrations

The backend applies SQLite migrations automatically when it opens the database.

- migration files live in `backend/src/db/migrations/`
- files are executed in sorted filename order, so use numeric prefixes like `001_` and `002_`
- the migration runner records applied files in the `_migrations` table
- each migration runs inside a transaction so a failed file rolls back cleanly
- the backend build copies the SQL files into `backend/dist/db/migrations/` before `npm run start` launches the compiled server

The current setup keeps the baseline schema in `001_initial.sql` and the timestamp backfill and related index changes in `002_add_timestamps.sql`. Existing databases that already have the chat timestamp columns still start cleanly because the runner detects that schema and only records the migration history.

## Chat API

`POST /api/chat` accepts a conversation history:

```json
{
  "messages": [
    { "role": "user", "content": "Refine the sprint plan." }
  ]
}
```

It returns the assistant reply plus note-change metadata:

```json
{
  "assistantMessage": { "role": "assistant", "content": "I updated the sprint plan note." },
  "changedNoteIds": [1],
  "notesChanged": true
}
```

The backend uses Bedrock Converse through LangChain and can call note tools while composing a reply. When the model changes notes, the frontend refreshes the notes workspace.

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
- `list_notes` lists a page of notes for discovery and update selection
- `list_notes` defaults to `{ "limit": 10, "offset": 0 }`
- `list_notes` accepts paging arguments like `{ "limit": 10, "offset": 20 }` to fetch later pages
- `update_note` updates a note with `{ "id": 123, "title": "...", "content": "..." }`

These tools reuse the same repository implementation as the HTTP API. They are backend-side utilities and do not add a second persistence layer.

## Serving model

The backend does not build the frontend. It resolves the dist directory, checks that it exists, serves static assets, applies SQLite migrations on startup, exposes the notes API, and returns `index.html` for SPA-style routes.
