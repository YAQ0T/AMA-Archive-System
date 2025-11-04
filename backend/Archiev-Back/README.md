# AMA Archive Backend

This service provides REST APIs for ingesting and retrieving uploaded archive documents. It stores metadata in MongoDB and the files on local disk.

## Requirements

- Node.js 18+
- MongoDB instance reachable from the server

## Installation

```bash
cd backend/Archiev-Back
npm install
```

## Environment configuration

Create a `.env` file alongside `index.js` (see `.env.example`).

| Variable   | Description |
|------------|-------------|
| `PORT`     | (Optional) Port for the HTTP server. |
| `MONGO_URI`| MongoDB connection string (required). |
| `UPLOAD_DIR` | Optional custom directory for uploads (absolute path or relative to `backend/Archiev-Back`). |

Example `.env`:

```dotenv
PORT=4000
MONGO_URI=mongodb://localhost:27017/ama-archive
UPLOAD_DIR=uploads
```

## npm scripts

- `npm run start` – start the server with Node.js
- `npm run dev` – start the server with `nodemon` for automatic reloads

## API Overview

All endpoints are prefixed with `/api/documents`.

### POST `/api/documents`

Upload a document file with associated metadata.

- **Content type:** `multipart/form-data`
- **Fields:**
  - `file` – required, PDF or Word (`.pdf`, `.doc`, `.docx`)
  - `tags` – optional JSON array (stringified in multipart) with objects `{ "name": string, "price": number }`
  - `notes` – optional string
- **Response:** 201 with created document metadata

### GET `/api/documents`

List documents with optional filters.

- **Query params:**
  - `name` – partial match on tag name or document name
  - `price` – exact match on tag price
  - `limit` – page size (default 50, max 100)
  - `skip` – number of records to skip (default 0)
  - `year` – exact match on document year
  - `merchant` – exact match on merchant name
  - `month` – exact match on month name
- **Response:** 200 with array of documents

### GET `/api/documents/:id`

Fetch a single document's metadata by MongoDB object ID.

- **Response:** 200 with document metadata or 404 if not found

### GET `/api/documents/:id/file`

Stream/download the stored file contents.

- **Response:** 200 streaming file, 404 if metadata or file missing

### PATCH `/api/documents/:id`

Update metadata (tags and notes).

- **Content type:** `application/json` or `multipart/form-data`
- **Body:**
  - `tags` – JSON array as described above
  - `notes` – string
- **Response:** 200 with updated document metadata

## Validation, security & limits

- Helmet sets common security headers.
- File uploads are limited to 50 MB.
- Validation errors return HTTP 422 with details.
- Morgan logs HTTP requests to stdout.

## Local storage

Files are stored in the `uploads/` directory (configurable through `UPLOAD_DIR`). Ensure the running process has write permissions.

## Error handling

Errors are serialized as JSON with a `message`. Unknown routes return a 404 response.
