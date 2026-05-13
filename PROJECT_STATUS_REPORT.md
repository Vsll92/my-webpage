# Pressing Room — Current Status Report

## Current state

Pressing Room is now a real local full-stack project, not only a planning document.

The project contains:

- FastAPI backend
- Next.js 14 frontend
- Supabase/PostgreSQL database schema
- Opta-style CSV ingestion pipeline
- xG model pipeline
- aggregate computation pipeline
- QA pipeline
- public pages for fixtures, results, standings, scorers, team pages, match center, methodology, Pro page, and 404
- UI foundations for dark/light mode and Fan/Pro mode

## Confirmed local data status from the latest run

The latest successful ingestion run completed with:

- 306 matches processed
- 7,662 shots used for xG training/back-fill
- 18 teams rebuilt in `team_season_stats`
- 542 players rebuilt in `player_season_stats`
- QA: 6/7 checks passed, 1 warning

The backend standings endpoint was confirmed to return real data:

```text
/api/standings?competition_id=dm5ka0os1e3dxcp3vh05kmp33&season=25-26
```

## Known issues / review notes

1. **xG model calibration is not yet production-quality.**
   The pipeline works, but QA warns that many matches have unusually high xG totals. Long-range xG and central-header xG were too high in calibration checks. Treat xG as a technical prototype until the model is recalibrated.

2. **Frontend data rendering should be verified after every pull.**
   The backend returns standings data correctly, but the frontend pages must be tested against the exact `NEXT_PUBLIC_API_URL` and season value `25-26`.

3. **Secrets are removed from this GitHub-ready package.**
   Use `.env.example` files only. Create local `.env` and `.env.local` files manually.

4. **Raw match CSV files are not included.**
   Place them in `data/raw/` locally before running ingestion.

## Recommended next step

The next work package should focus on frontend data integration verification:

1. Confirm `/standings` renders the 18 backend teams.
2. Confirm `/scorers` renders player stats.
3. Confirm `/results` and `/fixtures` render match data.
4. Confirm team pages and match pages load valid IDs.
5. Only after that, start visual redesign.
