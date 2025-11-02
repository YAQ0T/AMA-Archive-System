# AMA Archive System Monorepo

This repository houses the TypeScript-based backend and React frontend for the AMA Archive System. Each project ships with a consistent developer experience powered by ESLint, Prettier, and shared npm scripts.

## Project structure

```
├── backend/   # Node.js + TypeScript service
├── frontend/  # React + Vite single page application
└── docs/      # Project documentation
```

## Getting started

Both projects manage their own dependencies. Install them from the repository root:

```bash
cd backend && npm install
cd ../frontend && npm install
```

> **Note:** The development environment requires Node.js 18 or newer.

## Shared npm scripts

Each package exposes a consistent set of scripts to streamline common tasks:

| Script   | Backend                                    | Frontend                 |
|----------|---------------------------------------------|--------------------------|
| `dev`    | Runs the API with live reload via `ts-node-dev`. | Starts the Vite dev server. |
| `build`  | Compiles TypeScript to `dist/`.             | Type-checks and builds the SPA. |
| `lint`   | Lints `.ts` files with ESLint + Prettier.   | Lints `.ts`/`.tsx` files. |
| `format` | Formats sources using Prettier.             | Formats sources using Prettier. |

Run a script by changing into the desired project directory, e.g.:

```bash
cd backend
npm run dev
```

## Environment variables

Each project provides a `.env.example` template. Copy the file to `.env` and adjust values as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

- Backend: configure the `PORT` used by the API server.
- Frontend: configure `VITE_API_BASE_URL` for API requests.

Environment files are automatically loaded during development via the respective tooling (`dotenv` in the backend, Vite in the frontend).

## Linting and formatting

ESLint and Prettier are preconfigured for both projects. To lint or format the entire codebase:

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Formatting can be applied with `npm run format` in each project directory.

## Additional resources

Consult the [`docs/`](docs/) directory for high-level architectural and product documentation.
