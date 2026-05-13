# GitHub Review Setup Guide

This package is cleaned for GitHub review. Secrets, local `.env` files, raw data, and generated model files are excluded.

## 1. Backend setup

```powershell
cd backend
```

Install dependencies using Poetry:

```powershell
poetry install --no-root
```

If Poetry is not on PATH on Windows, use the full path:

```powershell
& "$env:APPDATA\pypoetry\venv\Scripts\poetry.exe" install --no-root
```

Create the backend environment file:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
ALLOWED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
COMPETITION_ID=dm5ka0os1e3dxcp3vh05kmp33
DEFAULT_SEASON=25-26
```

Run the database migration in Supabase SQL Editor or with `psql`:

```sql
-- paste backend/migrations/001_initial_schema.sql into Supabase SQL Editor and run it
```

Start the backend:

```powershell
poetry run python -m uvicorn app.main:app --port 8000
```

Or on Windows with full Poetry path:

```powershell
& "$env:APPDATA\pypoetry\venv\Scripts\poetry.exe" run python -m uvicorn app.main:app --port 8000
```

Open:

```text
http://127.0.0.1:8000/docs
```

## 2. Data ingestion

Place match CSV files in:

```text
data/raw/
```

Run a safe dry-run first:

```powershell
poetry run python scripts/ingest_all_matches.py "..\data\raw" --dry-run -v
```

Run the real ingestion:

```powershell
poetry run python scripts/ingest_all_matches.py "..\data\raw" -v
```

## 3. Frontend setup

```powershell
cd frontend
npm.cmd install
Copy-Item .env.local.example .env.local
```

Confirm `frontend/.env.local` contains:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start frontend:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## 4. Minimum review checklist

- Backend docs open: `http://127.0.0.1:8000/docs`
- Standings API returns rows: `/api/standings?competition_id=dm5ka0os1e3dxcp3vh05kmp33&season=25-26`
- Frontend opens: `http://localhost:3000`
- `/standings` shows 18 teams after ingestion
- `/scorers` shows players after ingestion
- Dark/light mode works
- Fan/Pro toggle works
