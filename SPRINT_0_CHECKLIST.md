# Sprint 0 — Acceptance Checklist
**Pressing Room | Foundation Verification**

Run through every item before marking Sprint 0 complete and starting Sprint 1.
No item is optional. Sprint 1 depends on all of these being green.

---

## 1. BACKEND RUNS LOCALLY

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

| # | Check | Expected | Pass |
|---|---|---|---|
| B1 | Server starts without error | Log: "Starting Pressing Room API" | ☐ |
| B2 | `GET http://localhost:8000/api/health/ping` | `{"pong": true}` | ☐ |
| B3 | `GET http://localhost:8000/api/health` | `{"status": "ok", "database": true}` | ☐ |
| B4 | `GET http://localhost:8000/docs` | OpenAPI UI loads | ☐ |

If B3 shows `"database": false`, the DATABASE_URL is wrong or the DB is unreachable.

---

## 2. DATABASE MIGRATION SUCCEEDED

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -c "\dt public.*"
psql $DATABASE_URL -c "\di public.*"
```

| # | Check | Expected | Pass |
|---|---|---|---|
| D1 | `competitions` table exists | Row count: 1 (Ligue 1 seeded) | ☐ |
| D2 | `teams` table exists | Row count: 0 (empty until ingestion) | ☐ |
| D3 | `matches` table exists | Row count: 0 | ☐ |
| D4 | `events_raw` table exists | Row count: 0 | ☐ |
| D5 | `team_match_stats` table exists | Row count: 0 | ☐ |
| D6 | `team_season_stats` table exists | Row count: 0 | ☐ |
| D7 | `player_season_stats` table exists | Row count: 0 | ☐ |
| D8 | Critical indexes exist | `idx_er_match_id`, `idx_er_shots`, `idx_er_dedup` visible | ☐ |

Verify the seeded competition:
```sql
SELECT * FROM competitions;
-- Expected: dm5ka0os1e3dxcp3vh05kmp33 | Ligue 1 | LI1 | France
```

---

## 3. ONE CSV INGESTED SUCCESSFULLY

```bash
cd backend
python scripts/ingest_one_match.py "../data/France League 1 25-26/10_Le Havre_Brest_7znx52cirafzl9sfcd5fcpd04_with_categories.csv"
```

| # | Check | Expected | Pass |
|---|---|---|---|
| I1 | Script runs without exception | Exit code 0 | ☐ |
| I2 | Row count printed | 1700–1900 rows | ☐ |
| I3 | Match metadata printed | "Le Havre 1 – 0 Brest, Week 10" | ☐ |
| I4 | `events_raw` now has rows | `SELECT COUNT(*) FROM events_raw` → ~1790 | ☐ |
| I5 | `matches` has 1 row | `SELECT match_id, home_goals, away_goals FROM matches` | ☐ |
| I6 | Both teams in `teams` | `SELECT team_name FROM teams` → 2 rows | ☐ |
| I7 | Re-run is idempotent | Second run: "Already ingested — 0 rows inserted" | ☐ |

Manual data spot-checks:
```sql
-- Verify goals match expected scoreline (Le Havre 1 – 0 Brest)
SELECT COUNT(*) FROM events_raw WHERE event = 'Goal' AND match_id = '7znx52cirafzl9sfcd5fcpd04';
-- Expected: 1

-- Verify away team coordinates are flipped (shots should be in x > 60)
SELECT team_position, AVG(x), COUNT(*) 
FROM events_raw 
WHERE match_id = '7znx52cirafzl9sfcd5fcpd04' AND macro_category = 'shot'
GROUP BY team_position;
-- Expected: both home and away rows should have AVG(x) > 60

-- Verify qualifiers JSONB is populated
SELECT qualifiers FROM events_raw 
WHERE match_id = '7znx52cirafzl9sfcd5fcpd04' AND event = 'Goal'
LIMIT 1;
-- Expected: {"Head": true} or {"Right footed": true} etc. — not null
```

---

## 4. NORMALIZATION TESTS PASS

```bash
cd backend
pytest tests/test_normalize.py -v
```

| # | Check | Expected | Pass |
|---|---|---|---|
| N1 | All tests pass | 0 failures, 0 errors | ☐ |
| N2 | `test_shot_attack_direction` passes | ≥80% of shots in x>60 | ☐ |
| N3 | `test_home_team_coordinates_unchanged` | Home x unchanged | ☐ |
| N4 | `test_away_team_x_is_flipped` | Away x = 100 - original | ☐ |
| N5 | `test_goal_maps_to_goal` | shot_outcome = "goal" | ☐ |
| N6 | `test_miss_with_blocked_si_is_blocked` | shot_outcome = "blocked" | ☐ |
| N7 | `test_progressive_pass_flagged` | is_progressive_pass = True | ☐ |
| N8 | `test_box_entry_flagged` | is_box_entry = True | ☐ |

If any normalization test fails, **do not proceed to Sprint 1** until it is fixed.
A failed normalization test means every shot map, every PPDA calculation, and every
defensive height metric will produce wrong values.

---

## 5. FRONTEND RUNS LOCALLY

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome.

| # | Check | Expected | Pass |
|---|---|---|---|
| F1 | Dev server starts | "Ready - started server on 0.0.0.0:3000" | ☐ |
| F2 | Homepage loads | Sprint 0 demo page visible | ☐ |
| F3 | No console errors | Chrome DevTools console: 0 errors | ☐ |
| F4 | No hydration warnings | Console: no "Hydration failed" messages | ☐ |
| F5 | TypeScript clean | `npm run type-check` → 0 errors | ☐ |

---

## 6. FONTS LOAD CORRECTLY

Open Chrome DevTools → Network → filter by "Font".

| # | Check | Expected | Pass |
|---|---|---|---|
| FO1 | Instrument Serif loaded | Request for `InstrumentSerif-Regular.woff2` | ☐ |
| FO2 | DM Sans loaded | Request for `DMSans*.woff2` | ☐ |
| FO3 | DM Mono loaded | Request for `DMMono*.woff2` | ☐ |
| FO4 | No FOUT visible | Headline text doesn't visibly swap fonts after load | ☐ |
| FO5 | Display headline renders | "Pressing Room" in Instrument Serif | ☐ |
| FO6 | Number renders in mono | Data values in DM Mono (tabular alignment) | ☐ |

---

## 7. DARK / LIGHT MODE

| # | Check | Action | Expected | Pass |
|---|---|---|---|---|
| TH1 | Default theme | Fresh browser / cleared localStorage | Dark mode active | ☐ |
| TH2 | Light mode switch | Click sun icon in TopNav | Page switches to light mode | ☐ |
| TH3 | Light mode persists | Refresh page | Still light mode | ☐ |
| TH4 | Dark mode switch | Click moon icon | Page switches to dark mode | ☐ |
| TH5 | Dark mode persists | Refresh page | Still dark mode | ☐ |
| TH6 | No theme flash | Hard refresh (Cmd+Shift+R) in dark mode | No white flash before dark renders | ☐ |
| TH7 | Background correct | Dark: `#0F1117`, Light: `#FAFAF8` | Check DevTools computed styles | ☐ |
| TH8 | Pitch color correct | Dark: `#1A4731`, Light: `#2D7D46` | Visible in pitch swatch | ☐ |
| TH9 | Accent color correct | Dark: `#4C8EFF`, Light: `#0052CC` | Check Pro badge or accent swatch | ☐ |

Verify CSS variable switching in DevTools:
1. Open DevTools → Elements → select `<html>` element
2. Switch theme
3. Verify `data-theme` attribute changes
4. Check Computed styles: `--bg-base` changes between `#FAFAF8` and `#0F1117`

---

## 8. FAN / PRO TOGGLE

| # | Check | Action | Expected | Pass |
|---|---|---|---|---|
| P1 | Default mode | Fresh browser / cleared localStorage | Fan mode | ☐ |
| P2 | State shown | Check demo page | "fan" / "pro" label reflects current mode | ☐ |
| P3 | Switch to Pro | Click "Pro" in toggle | Mode switches to Pro | ☐ |
| P4 | Pro persists | Refresh page | Still Pro mode | ☐ |
| P5 | Switch to Fan | Click "Fan" in toggle | Mode switches to Fan | ☐ |
| P6 | Fan persists | Refresh page | Still Fan mode | ☐ |
| P7 | ProLock in Fan | Set Fan mode, view demo | Pro card is blurred | ☐ |
| P8 | ProLock in Pro | Set Pro mode, view demo | Pro card content visible | ☐ |
| P9 | CTA visible | Fan mode, ProLock card | "Unlock Pro →" button visible | ☐ |
| P10 | CTA links to /pro | Click "Unlock Pro →" | Navigates to /pro (404 is OK in Sprint 0) | ☐ |

---

## 9. CSS VARIABLE INTEGRITY

Verify the full token set renders correctly. Use Chrome DevTools → Inspect the `<html>` element → Computed tab → search for `--`.

**Light mode token checks:**

| Token | Expected value |
|---|---|
| `--bg-base` | `#fafaf8` |
| `--bg-surface` | `#ffffff` |
| `--text-primary` | `#1a1a1a` |
| `--accent-primary` | `#0052cc` |
| `--shot-goal` | `#36b37e` |
| `--shot-saved` | `#4c8eff` |
| `--pitch-surface` | `#2d7d46` |

**Dark mode token checks (switch theme first):**

| Token | Expected value |
|---|---|
| `--bg-base` | `#0f1117` |
| `--bg-surface` | `#1a1e2a` |
| `--text-primary` | `#f0f0ec` |
| `--accent-primary` | `#4c8eff` |
| `--pitch-surface` | `#1a4731` |

---

## 10. CRITICAL FAILURES — DO NOT PROCEED TO SPRINT 1 IF ANY ARE RED

| # | Failure | Impact if unresolved |
|---|---|---|
| 🔴 C1 | Normalization test fails | Every shot map is wrong. PPDA is wrong. Block Sprint 1. |
| 🔴 C2 | Database connection fails | Nothing works. Block Sprint 1. |
| 🔴 C3 | CSV ingestion fails | No data. Block Sprint 1. |
| 🔴 C4 | Hydration errors in console | Pro/Fan toggle will misbehave. Fix before adding any interactive component. |
| 🔴 C5 | Fonts don't load | Typography is central to the premium identity. Fix before Sprint 2. |
| 🟡 C6 | CSS variables don't switch on theme change | Dark mode broken. Fix in Sprint 0, acceptable to carry to Sprint 1. |
| 🟡 C7 | Pro toggle doesn't persist | Annoying but not blocking. Fix in Sprint 1. |

---

## SIGN-OFF

```
Sprint 0 completed by: ________________________
Date: ________________________

Backend items passed:  __ / 7
Database items passed: __ / 8
Ingestion items passed: __ / 7
Normalization tests:   __ / 8
Frontend items passed: __ / 5
Font items passed:     __ / 6
Theme items passed:    __ / 9
Toggle items passed:   __ / 10
CSS variables:        __ / 14

All critical (🔴) items: PASS / FAIL

Ready to start Sprint 1: YES / NO
```
