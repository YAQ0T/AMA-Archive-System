# AMA Archive System

AMA Archive System is a full-stack document archive for uploading, tagging, and searching business records. The backend is a Node/Express API backed by MongoDB for metadata, with files stored on disk in a year/merchant/month hierarchy. The frontend is a Vite + React app that lets users upload files, search by tags and filters, and manage document metadata.

## Project layout

- `backend/Archiev-Back` - Express API, MongoDB models, file storage
- `frontend/achive-front` - React UI built with Vite

## Features

- Upload PDFs, Word docs, or images (JPEG/PNG); images in the same upload are merged into a single PDF
- Add metadata: year, merchant, month, notes, and price tags
- Search by document name, tags, merchant, month, price range, and year
- Preview, download, and reprint archived documents from the UI
- Edit document metadata and move files into the correct storage hierarchy

## Prerequisites

- Node.js 18+
- npm
- MongoDB instance (local or hosted)

## Install and run (local)

### 1) Backend setup

```bash
cd backend/Archiev-Back
npm install
```

Create a `.env` file in `backend/Archiev-Back`:

```dotenv
PORT=4000
MONGO_URI=mongodb://localhost:27017/ama-archive
UPLOAD_DIR=uploads
```

Notes:
- `MONGO_URI` is required.
- `UPLOAD_DIR` is optional. If relative, it resolves from `backend/Archiev-Back`.

Start the API:

```bash
npm run dev
```

The backend listens on `http://localhost:4000` by default.

### 2) Frontend setup

```bash
cd frontend/achive-front
npm install
```

If the backend is not on `http://localhost:4000`, add a `.env` file in
`frontend/achive-front`:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

Start the UI:

```bash
npm run dev
```

Open the Vite URL shown in your terminal (usually `http://localhost:5173`). The app uses hash routes:

- `#/upload` - upload and tag new documents
- `#/search` - search, filter, and edit existing documents

## Backend API overview

Base path: `/api/documents`

- `POST /api/documents` - upload documents (`multipart/form-data`)
  - fields: `files` (required), `year`, `merchant`, `month`, `tags` (JSON array), `notes`
- `GET /api/documents` - list documents with filters
  - query: `name`, `price`, `year`, `merchant`, `month`, `limit`, `skip`, `includeTotal`
- `GET /api/documents/hierarchy` - grouped data by year/merchant/month
- `GET /api/documents/:id` - fetch a single document by ID
- `GET /api/documents/:id/file` - stream/download the stored file
- `PATCH /api/documents/:id` - update notes, tags, or metadata

Validation and limits:
- Upload limit: 50 MB per file
- Year must be between 1900 and 9999
- Month must match a calendar month name
- Tags require a `name` and numeric `price`

## Storage layout

Uploaded files are stored under:

```
backend/Archiev-Back/uploads/<year>/<merchant>/<month>/
```

Folder names are sanitized for safety, and files are renamed to include the merchant, month, and year.

## Frontend behavior

- Uses `VITE_API_BASE_URL` to locate the backend API
- Caches search results per filter/page in memory
- Computes summary stats (total documents, tags, and value) on the Search page
- Provides edit modal to update notes, tags, year, merchant, and month

## Build (optional)

Frontend production build:

```bash
cd frontend/achive-front
npm run build
```

Backend production start:

```bash
cd backend/Archiev-Back
npm run start
```
