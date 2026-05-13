# Pressing Room

**France Ligue 1 Football Intelligence Platform**

> Public football data, explained with a Fan/Pro tactical layer.

---

## What this repository contains

Pressing Room is a local full-stack football analytics web app built around Opta-style event CSV data.

**Stack**

- Backend: FastAPI + asyncpg + pandas/scikit-learn pipeline
- Frontend: Next.js 14 + TypeScript + Tailwind CSS + SWR
- Database: PostgreSQL / Supabase

**Current V1 focus**

- Fixtures
- Results
- Standings
- Scorers
- Team pages
- Match center
- Methodology
- Fan/Pro mode
- Dark/light mode

---

## Current status

The latest local pipeline run confirmed:

- 306 matches ingested/processed
- 7,662 shots used for xG training/back-fill
- 18 teams rebuilt in `team_season_stats`
- 542 players rebuilt in `player_season_stats`
- QA: 6/7 checks passed, 1 warning

Known warning: the current xG model is technically working but not yet production-calibrated. Treat xG as a V1 prototype until recalibration.

---

## Repository structure

```text
pressing-room/
├── backend/                  # FastAPI API + ingestion/analytics pipeline
│   ├── app/                  # API app, routers, schemas
│   ├── migrations/           # SQL schema
│   ├── pipeline/             # ingestion, normalization, xG, aggregates, QA
│   ├── scripts/              # batch ingestion/training scripts
│   └── tests/                # pipeline tests
├── frontend/                 # Next.js app
│   ├── app/                  # page routes
│   ├── components/           # UI components
│   ├── contexts/             # theme + Fan/Pro mode
│   ├── hooks/                # SWR data hooks
│   └── lib/                  # API client/constants/formatters
├── data/raw/                 # local-only CSV input folder, not committed
├── PROJECT_STATUS_REPORT.md
├── GITHUB_REVIEW_SETUP.md
└── README.md
```

---

## Security note

Do not commit:

- `backend/.env`
- `frontend/.env.local`
- raw CSV files
- generated model files

This GitHub-ready package intentionally includes only `.env.example` templates.

If a real database password was ever shared or committed during testing, rotate/reset it in Supabase.

---

## Backend setup

```powershell
cd backend
```

Install dependencies:

```powershell
poetry install --no-root
```

If Poetry is not available on PATH on Windows:

```powershell
& "$env:APPDATA\pypoetry\venv\Scripts\poetry.exe" install --no-root
```

Create environment file:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
ALLOWED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
COMPETITION_ID=dm5ka0os1e3dxcp3vh05kmp33
DEFAULT_SEASON=25-26
CACHE_TTL_SECONDS=3600
SHOTS_CACHE_TTL=86400
ENVIRONMENT=development
LOG_LEVEL=INFO
```

Important: because the backend uses `asyncpg.create_pool()` directly, use `postgresql://` or `postgres://`, not `postgresql+asyncpg://`.

Run the schema migration in Supabase SQL Editor:

```text
backend/migrations/001_initial_schema.sql
```

Start backend:

```powershell
poetry run python -m uvicorn app.main:app --port 8000
```

Or with full Poetry path on Windows:

```powershell
& "$env:APPDATA\pypoetry\venv\Scripts\poetry.exe" run python -m uvicorn app.main:app --port 8000
```

Open:

```text
http://127.0.0.1:8000/docs
```

---

## Data ingestion

Place Opta-style CSV files in:

```text
data/raw/
```

Dry-run first:

```powershell
poetry run python scripts/ingest_all_matches.py "..\data\raw" --dry-run -v
```

Real ingestion:

```powershell
poetry run python scripts/ingest_all_matches.py "..\data\raw" -v
```

Expected successful phases:

1. CSV ingestion
2. xG model training/back-fill
3. team/player aggregate rebuild
4. QA checks

---

## Frontend setup

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

---

## Minimum review checklist

- `http://127.0.0.1:8000/docs` opens
- `/api/standings?competition_id=dm5ka0os1e3dxcp3vh05kmp33&season=25-26` returns rows
- `http://localhost:3000` opens
- `/standings` shows 18 teams after ingestion
- `/scorers` shows player stats after ingestion
- dark/light mode works
- Fan/Pro toggle works

---

## Next development priority

1. Verify frontend data rendering across standings, scorers, fixtures, results, teams, and match center.
2. Clean visual design of homepage, standings, and match center.
3. Recalibrate xG model before presenting xG as a professional-grade metric.
4. Prepare deployment configuration for Vercel + Railway/Render + Supabase.
