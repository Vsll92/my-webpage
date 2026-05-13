# Pressing Room — Repository Structure
**Sprint 0 Complete File Tree**

```
pressing-room/
│
├── README.md                              # Project overview, quick start, architecture
├── SPRINT_0_CHECKLIST.md                  # Sprint 0 acceptance tests (run before Sprint 1)
├── .gitignore
│
├── backend/                               # FastAPI application + data pipeline
│   ├── pyproject.toml                     # Python dependencies, build config
│   ├── .env.example                       # Environment variable template
│   ├── .gitignore
│   │
│   ├── app/                               # FastAPI application
│   │   ├── __init__.py
│   │   ├── main.py                        # App factory, lifespan, middleware, router registration
│   │   ├── config.py                      # Settings via pydantic-settings (.env parsing)
│   │   ├── database.py                    # asyncpg pool, get_db() dependency, check_connection()
│   │   ├── cache.py                       # In-process TTL cache (Sprint 0: no Redis)
│   │   │
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── health.py                  # GET /api/health, GET /api/health/ping
│   │       # Sprint 1+ additions:
│   │       # ├── standings.py             # GET /api/standings
│   │       # ├── fixtures.py              # GET /api/fixtures
│   │       # ├── results.py               # GET /api/results
│   │       # ├── scorers.py               # GET /api/scorers
│   │       # ├── teams.py                 # GET /api/teams/{id}/*
│   │       # ├── matches.py               # GET /api/matches/{id}/*
│   │       # └── homepage.py              # GET /api/homepage (aggregated)
│   │
│   ├── pipeline/                          # Data ingestion and transformation
│   │   ├── __init__.py
│   │   ├── validate.py                    # validate_match_df() — 10 validation rules
│   │   ├── normalize.py                   # normalize_coordinates(), prepare_dataframe()
│   │   │                                  # CRITICAL: away team x-flip lives here
│   │   └── ingest.py                      # ingest_match() — CSV → events_raw + matches + teams
│   │   # Sprint 1+ additions:
│   │   # ├── xg_model.py                  # xG model training + scoring
│   │   # ├── aggregates.py                # team_match_stats, team_season_stats computation
│   │   # └── qa.py                        # Post-ingestion data quality checks
│   │
│   ├── scripts/                           # Runnable CLI utilities
│   │   ├── __init__.py
│   │   └── ingest_one_match.py            # $ python scripts/ingest_one_match.py path/to.csv
│   │   # Sprint 1+ additions:
│   │   # ├── ingest_all_matches.py        # Batch ingestion of all 181 CSVs
│   │   # └── rebuild_aggregates.py        # Recompute all season/match stats
│   │
│   ├── migrations/
│   │   └── 001_initial_schema.sql         # All 5 tables + indexes + Ligue 1 seed data
│   │   # Sprint 1+ additions:
│   │   # └── 002_add_xg_model_version.sql # Track xG model versioning
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_normalize.py              # Normalization unit tests — MUST ALL PASS
│   │   # Sprint 1+ additions:
│   │   # ├── test_validate.py             # Validation rule tests
│   │   # ├── test_ingest.py               # End-to-end ingestion tests
│   │   # ├── test_xg_model.py             # xG model sanity checks
│   │   # └── test_api.py                  # API endpoint smoke tests
│   │
│   └── models/                            # Trained ML model files (git-ignored, large)
│       # Sprint 1+ additions:
│       # └── xg_v1.pkl                    # Trained xG logistic regression model
│
└── frontend/                              # Next.js 14 application
    ├── package.json                       # Dependencies + scripts
    ├── tsconfig.json                      # TypeScript configuration
    ├── tailwind.config.ts                 # Tailwind CSS + CSS variable color extensions
    ├── postcss.config.js
    ├── next.config.ts
    ├── .env.local.example                 # Frontend environment variable template
    ├── .gitignore
    ├── .eslintrc.json
    │
    ├── app/                               # Next.js App Router pages
    │   ├── layout.tsx                     # Root layout: providers, TopNav, Footer, anti-flash script
    │   ├── page.tsx                       # Homepage (Sprint 0: demo page; Sprint 3: real homepage)
    │   └── globals.css                    # CSS custom properties, typography, resets, Tailwind
    │   # Sprint 1+ additions:
    │   # ├── fixtures/page.tsx
    │   # ├── results/page.tsx
    │   # ├── standings/page.tsx
    │   # ├── scorers/page.tsx
    │   # ├── teams/[teamId]/page.tsx
    │   # ├── matches/[matchId]/page.tsx
    │   # ├── methodology/page.tsx
    │   # ├── pro/page.tsx
    │   # └── not-found.tsx
    │
    ├── components/                        # Reusable React components
    │   │
    │   ├── layout/                        # Structural layout components
    │   │   ├── TopNav.tsx                 # Sticky nav: logo, links, FanProToggle, ThemeToggle
    │   │   └── Footer.tsx                 # Minimal footer with methodology link
    │   │   # Sprint 1+ additions:
    │   │   # ├── PageShell.tsx            # SEO head wrapper
    │   │   # ├── SectionHeader.tsx        # Section title + subtitle + CTA slot
    │   │   # └── TabNav.tsx               # Tab navigation (team page, match center)
    │   │
    │   ├── ui/                            # Primitive UI components
    │   │   ├── ThemeToggle.tsx            # Sun/moon icon button
    │   │   ├── FanProToggle.tsx           # Pill toggle: Fan | Pro
    │   │   └── ProLock.tsx                # Blur overlay for gated Pro content
    │   │   # Sprint 1+ additions:
    │   │   # ├── StatTile.tsx             # Metric display tile (label + value + tooltip)
    │   │   # ├── MetricBadge.tsx          # Colored badge (positive/negative/pro)
    │   │   # ├── Tooltip.tsx              # Radix UI tooltip wrapper
    │   │   # ├── FilterBar.tsx            # Filter chips + reset
    │   │   # ├── SkeletonCard.tsx         # Skeleton loaders (shaped per component)
    │   │   # ├── SkeletonTableRow.tsx
    │   │   # ├── SkeletonTile.tsx
    │   │   # ├── EmptyState.tsx           # "No data" with explanation
    │   │   # └── ErrorState.tsx           # API failure UI
    │   │
    │   ├── visualizations/                # Data visualization components ("use client")
    │   │   # Sprint 4+ additions:
    │   │   # ├── PitchSVG.tsx             # Base football pitch SVG
    │   │   # ├── ShotDot.tsx              # Individual shot dot (xG-sized, outcome-colored)
    │   │   # ├── ShotMap.tsx              # Full shot map (PitchSVG + dots + legend + caption)
    │   │   # ├── ShotMapLegend.tsx
    │   │   # └── XGFlowChart.tsx          # Cumulative xG line chart (Recharts)
    │   │
    │   └── pages/                         # Page-specific components
    │       └── SprintZeroDemo.tsx         # Sprint 0 foundation check page
    │       # Sprint 1+ additions:
    │       # ├── homepage/
    │       # ├── team/
    │       # └── match-center/
    │
    ├── contexts/                          # React Context providers
    │   ├── ThemeContext.tsx               # dark/light mode + THEME_INIT_SCRIPT
    │   └── ViewModeContext.tsx            # fan/pro toggle
    │
    ├── hooks/                             # SWR data-fetching hooks
    │   # Sprint 1+ additions:
    │   # ├── useHomepage.ts
    │   # ├── useFixtures.ts
    │   # ├── useResults.ts
    │   # ├── useStandings.ts
    │   # ├── useScorers.ts
    │   # ├── useTeamOverview.ts
    │   # ├── useMatch.ts
    │   # ├── useMatchShots.ts
    │   # ├── useXGFlow.ts
    │   # └── useMatchTactical.ts
    │
    ├── lib/                               # Shared utilities
    │   ├── api.ts                         # Base SWR fetcher, APIError class
    │   └── constants.ts                   # Shot colors, pitch dimensions, toSVGCoords()
    │   # Sprint 1+ additions:
    │   # └── formatters.ts                # formatDate, formatXG, formatMinute
    │
    └── public/
        └── crests/                        # Team crest images (SVG or PNG)
                                           # Filename: {team_id}.png
                                           # Added manually or via scrape script in Sprint 1
```

---

## Files generated in Sprint 0

### Backend (12 files)
| File | Purpose |
|---|---|
| `backend/pyproject.toml` | Python deps: FastAPI, asyncpg, pandas, scikit-learn |
| `backend/.env.example` | Environment variable template |
| `backend/.gitignore` | Python, venv, model files |
| `backend/app/__init__.py` | Package marker |
| `backend/app/main.py` | App factory, lifespan, CORS, GZip |
| `backend/app/config.py` | Pydantic-settings config |
| `backend/app/database.py` | asyncpg pool management |
| `backend/app/cache.py` | In-process TTL cache |
| `backend/app/routers/__init__.py` | Package marker |
| `backend/app/routers/health.py` | `/api/health` endpoint |
| `backend/migrations/001_initial_schema.sql` | All 5 tables + all indexes |
| `backend/pipeline/__init__.py` | Package marker |
| `backend/pipeline/validate.py` | `validate_match_df()` — 10 rules |
| `backend/pipeline/normalize.py` | `normalize_coordinates()`, `prepare_dataframe()` |
| `backend/pipeline/ingest.py` | `ingest_match()` — full CSV → DB flow |
| `backend/scripts/__init__.py` | Package marker |
| `backend/scripts/ingest_one_match.py` | CLI ingestion script |
| `backend/tests/__init__.py` | Package marker |
| `backend/tests/test_normalize.py` | Normalization unit tests |

### Frontend (16 files)
| File | Purpose |
|---|---|
| `frontend/package.json` | Node deps: Next.js, Tailwind, SWR, Recharts, Radix |
| `frontend/tsconfig.json` | TypeScript config with `@/*` path alias |
| `frontend/tailwind.config.ts` | Font families + CSS variable color extensions |
| `frontend/postcss.config.js` | PostCSS with Tailwind + autoprefixer |
| `frontend/next.config.ts` | Next.js config: strictMode, env vars |
| `frontend/.env.local.example` | `NEXT_PUBLIC_API_URL` template |
| `frontend/.gitignore` | node_modules, .next, .env.local |
| `frontend/.eslintrc.json` | next/core-web-vitals rules |
| `frontend/app/globals.css` | All CSS tokens, dark/light vars, typography, resets |
| `frontend/app/layout.tsx` | Root layout: providers, nav, footer, anti-flash script |
| `frontend/app/page.tsx` | Homepage (Sprint 0: demo page) |
| `frontend/contexts/ThemeContext.tsx` | Dark/light mode context + THEME_INIT_SCRIPT |
| `frontend/contexts/ViewModeContext.tsx` | Fan/Pro view mode context |
| `frontend/components/layout/TopNav.tsx` | Navigation bar |
| `frontend/components/layout/Footer.tsx` | Footer |
| `frontend/components/ui/ThemeToggle.tsx` | Sun/moon toggle button |
| `frontend/components/ui/FanProToggle.tsx` | Fan/Pro pill toggle |
| `frontend/components/ui/ProLock.tsx` | Blur overlay for gated content |
| `frontend/components/pages/SprintZeroDemo.tsx` | Sprint 0 foundation check page |
| `frontend/lib/api.ts` | Base fetcher + APIError |
| `frontend/lib/constants.ts` | Shot colors, pitch dimensions, helpers |

### Root (3 files)
| File | Purpose |
|---|---|
| `README.md` | Project overview + quick start |
| `SPRINT_0_CHECKLIST.md` | Sprint 0 acceptance criteria |
| `.gitignore` | Root-level catch-all |
