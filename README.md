# SCA AI Data Analysis Platform

Full-stack foundation for the SCA AI Data Analysis Platform.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, Clerk, shadcn/ui-style components
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Redis
- Local infrastructure: Docker Compose

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:8000
```

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `backend/.env` if you want to override defaults:

```bash
DATABASE_URL=postgresql+psycopg://sca:sca_password@localhost:5432/sca_platform
REDIS_URL=redis://localhost:6379/0
CLERK_JWT_ISSUER=
CLERK_JWT_AUDIENCE=
CLERK_JWKS_URL=
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
UPLOAD_DIR=storage/uploads
METADATA_DIR=storage/metadata
MAX_UPLOAD_SIZE_MB=50
```

Dataset uploads are available at `POST /api/datasets/upload`. The endpoint accepts
CSV, Excel (`.xlsx`, `.xls`), and SPSS (`.sav`) files up to 50MB. Files are stored
locally in `backend/storage/uploads`, and upload metadata is appended to
`backend/storage/metadata/datasets.jsonl`.

Dataset previews are available at `GET /api/datasets/{id}/preview` after upload.
The preview returns row/column counts, column schema, null percentages, sample rows,
and a fresh SHA256 integrity check.

Cleaning suggestions are available at `POST /api/datasets/{id}/clean/analyse`.
The endpoint only analyzes the stored dataset and returns suggestions such as
duplicate-row removal, missing-value filling, and text casing normalization. It does
not modify the uploaded file.

Study context is available at `POST /api/projects/{id}/context`. The frontend links
the context form to the uploaded dataset id and stores a browser-local copy. The
backend saves to PostgreSQL when available and falls back to
`backend/storage/metadata/study_contexts.jsonl` when the database is offline.

## Services

```bash
docker compose up -d
```

PostgreSQL runs on `localhost:5432`; Redis runs on `localhost:6379`.
