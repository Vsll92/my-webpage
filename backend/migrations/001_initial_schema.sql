-- =============================================================================
-- PRESSING ROOM — INITIAL DATABASE SCHEMA
-- Migration: 001_initial_schema.sql
-- Run: psql $DATABASE_URL -f migrations/001_initial_schema.sql
--
-- Tables created in dependency order (no FK violations):
--   1. competitions  (reference)
--   2. teams         (reference)
--   3. matches       (FK → competitions, teams)
--   4. events_raw    (FK → matches)
--   5. team_match_stats (FK → matches, teams)
--   6. team_season_stats (FK → teams)
--   7. player_season_stats (FK → teams)
-- =============================================================================

BEGIN;

-- =============================================================================
-- REFERENCE TABLES
-- =============================================================================

-- competitions — one row per league/cup
CREATE TABLE IF NOT EXISTS competitions (
    competition_id     TEXT PRIMARY KEY,
    competition_name   TEXT NOT NULL,       -- "Ligue 1"
    competition_code   TEXT,               -- "LI1"
    country            TEXT,               -- "France"
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Ligue 1 (competition_id from the CSV data)
INSERT INTO competitions (competition_id, competition_name, competition_code, country)
VALUES ('dm5ka0os1e3dxcp3vh05kmp33', 'Ligue 1', 'LI1', 'France')
ON CONFLICT (competition_id) DO NOTHING;

-- teams — one row per club
CREATE TABLE IF NOT EXISTS teams (
    team_id            TEXT PRIMARY KEY,   -- contestant_id from CSV
    team_name          TEXT NOT NULL,      -- "PSG", "Monaco", etc.
    team_short_name    TEXT,               -- "PSG"
    team_code          TEXT,               -- "HAC", "BRE" — from team_code column
    competition_id     TEXT REFERENCES competitions(competition_id),
    primary_color      TEXT,              -- hex, for accent use only in UI
    secondary_color    TEXT,
    crest_url          TEXT,              -- /crests/{team_id}.png (or svg)
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- MATCHES — one row per match
-- =============================================================================

CREATE TABLE IF NOT EXISTS matches (
    match_id           TEXT PRIMARY KEY,   -- from CSV match_id column
    competition_id     TEXT NOT NULL REFERENCES competitions(competition_id),
    season             TEXT NOT NULL,      -- "25-26"
    week               INTEGER,            -- matchweek number
    local_date         DATE,
    local_time         TIME,
    -- Teams (team_id FKs are nullable — populated after team discovery)
    home_team_id       TEXT REFERENCES teams(team_id),
    home_team_name     TEXT NOT NULL,
    away_team_id       TEXT REFERENCES teams(team_id),
    away_team_name     TEXT NOT NULL,
    -- Score (NULL if match not yet played)
    home_goals         INTEGER,
    away_goals         INTEGER,
    -- xG (populated after event ingestion + xG model run)
    home_xg            NUMERIC(4, 2),
    away_xg            NUMERIC(4, 2),
    -- Formations
    home_formation     TEXT,               -- e.g. "4231"
    away_formation     TEXT,               -- e.g. "433"
    -- Venue
    venue_id           TEXT,
    venue_name         TEXT,
    attendance         INTEGER,
    -- Status
    status             TEXT NOT NULL DEFAULT 'completed'
                           CHECK (status IN ('upcoming', 'live', 'completed', 'postponed')),
    -- Audit
    ingested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Why these indexes:
-- week_lookup: homepage and fixtures page always filter by competition + season + week
-- team_schedule: team page "recent matches" queries both home and away appearances
-- date_sort: results page sorts by date descending
CREATE INDEX IF NOT EXISTS idx_matches_week
    ON matches (competition_id, season, week);
CREATE INDEX IF NOT EXISTS idx_matches_home_team
    ON matches (home_team_id, season);
CREATE INDEX IF NOT EXISTS idx_matches_away_team
    ON matches (away_team_id, season);
CREATE INDEX IF NOT EXISTS idx_matches_date
    ON matches (local_date DESC);


-- =============================================================================
-- EVENTS_RAW — one row per event, exactly as ingested (after normalization)
-- This is the permanent analytical store. Never overwrite or delete rows.
-- All coordinates are normalized: every team attacks left→right (x increases toward goal).
-- =============================================================================

CREATE TABLE IF NOT EXISTS events_raw (
    -- Surrogate primary key
    id                   BIGSERIAL PRIMARY KEY,

    -- Match context (all from CSV)
    match_id             TEXT NOT NULL REFERENCES matches(match_id),
    competition_id       TEXT,
    season               TEXT,
    week                 INTEGER,
    local_date           DATE,

    -- Event identity
    general_id           BIGINT,           -- original general_id from CSV (for deduplication)
    event_id             INTEGER,          -- sequential event number within match
    event                TEXT NOT NULL,    -- "Pass", "Goal", "Miss", "Card", "Player Off", etc.
    type_id              INTEGER,
    macro_category       TEXT,             -- "possession", "defending", "shot", "dribble_duel", etc.

    -- Time
    period_id            SMALLINT,         -- 1 = first half, 2 = second half, 3/4 = extra time
    time_min             INTEGER,
    time_sec             INTEGER,

    -- Team & Player
    team_id              TEXT,             -- contestant_id renamed at ingestion
    team_name            TEXT,
    team_position        TEXT             -- "home" | "away" (original, pre-normalization)
                             CHECK (team_position IN ('home', 'away')),
    player_id            TEXT,
    player_name          TEXT,
    position             TEXT,             -- "GK", "CB", "CM", "CF", etc. (not always populated)
    formation            TEXT,             -- numeric string e.g. "3142", "433"

    -- Coordinates
    -- CRITICAL: x and y are normalized at ingest time so ALL teams attack left→right.
    -- Away team events have x = 100 - original_x, y = 100 - original_y.
    -- Pass End X/Y are also flipped for away teams.
    -- Never re-normalize after this point.
    x                    NUMERIC(5, 1),
    y                    NUMERIC(5, 1),
    pass_end_x           NUMERIC(5, 1),   -- NULL for non-pass events
    pass_end_y           NUMERIC(5, 1),

    -- Outcome
    outcome              SMALLINT         -- 1 = success/completed, 0 = failure/incomplete
                             CHECK (outcome IN (0, 1)),
    zone                 TEXT,            -- "Back", "Center", "Left", "Right" (from CSV)

    -- Qualifiers: all binary "Si"/"NaN" columns packed into JSONB
    -- Keys are only included when the value was "Si" (truthy qualifiers only)
    -- Example: {"Head": true, "Right footed": true, "Box-centre": true}
    qualifiers           JSONB,

    -- Derived fields — computed at ingest time, stored here permanently
    -- xg_value: NULL for non-shot events, computed by xG model for all shot events
    xg_value             NUMERIC(4, 3),
    -- shot_outcome: NULL for non-shots, one of the four canonical outcomes
    shot_outcome         TEXT            CHECK (shot_outcome IN ('goal', 'saved', 'miss', 'blocked')),
    -- Progressive pass: pass that advances ball ≥10 normalized units toward goal, and is completed
    is_progressive_pass  BOOLEAN NOT NULL DEFAULT FALSE,
    -- Box entry: pass whose endpoint lands inside the penalty box (x>83, y 21–79)
    is_box_entry         BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit
    ingested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Why these indexes:
-- idx_er_match_id: every query filters by match first (shot map, facts, xG flow)
-- idx_er_team_macro: team analysis pages filter by team + event category
-- idx_er_match_macro: match-level aggregate queries (e.g., "all shots in this match")
-- idx_er_season: season-level aggregation (rebuilding team_season_stats)
-- idx_er_player_season: player scoring tables (top scorers page)
-- idx_er_shots: partial index — only shot rows, used by xG and shot map queries
-- idx_er_progressive: partial index — only progressive passes, used by team analysis
-- idx_er_dedup: unique constraint for idempotent re-ingestion

CREATE INDEX IF NOT EXISTS idx_er_match_id
    ON events_raw (match_id);

CREATE INDEX IF NOT EXISTS idx_er_team_macro
    ON events_raw (team_id, macro_category);

CREATE INDEX IF NOT EXISTS idx_er_match_macro
    ON events_raw (match_id, macro_category);

CREATE INDEX IF NOT EXISTS idx_er_season
    ON events_raw (competition_id, season);

CREATE INDEX IF NOT EXISTS idx_er_player_season
    ON events_raw (player_id, season)
    WHERE player_id IS NOT NULL;

-- Partial indexes — only the rows that matter for these queries
CREATE INDEX IF NOT EXISTS idx_er_shots
    ON events_raw (match_id, team_id)
    WHERE macro_category = 'shot';

CREATE INDEX IF NOT EXISTS idx_er_progressive
    ON events_raw (team_id, season)
    WHERE is_progressive_pass = TRUE;

-- Deduplication: (match_id, general_id) must be unique
-- This allows safe re-runs of the ingestion pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_er_dedup
    ON events_raw (match_id, general_id)
    WHERE general_id IS NOT NULL;


-- =============================================================================
-- TEAM_MATCH_STATS — one row per team per match
-- Populated by the aggregation step after events_raw is loaded.
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_match_stats (
    -- Composite PK: each team appears once per match
    match_id              TEXT NOT NULL REFERENCES matches(match_id),
    team_id               TEXT NOT NULL REFERENCES teams(team_id),

    -- Context
    team_name             TEXT,
    is_home               BOOLEAN NOT NULL,
    opponent_id           TEXT REFERENCES teams(team_id),
    competition_id        TEXT,
    season                TEXT,
    week                  INTEGER,
    local_date            DATE,

    -- Goals
    goals                 SMALLINT NOT NULL DEFAULT 0,
    goals_against         SMALLINT NOT NULL DEFAULT 0,

    -- Shots
    shots                 SMALLINT NOT NULL DEFAULT 0,
    shots_on_target       SMALLINT NOT NULL DEFAULT 0,

    -- xG
    xg                    NUMERIC(4, 2) NOT NULL DEFAULT 0,
    xga                   NUMERIC(4, 2) NOT NULL DEFAULT 0,
    xg_per_shot           NUMERIC(4, 3),         -- NULL if 0 shots

    -- Passing
    passes                SMALLINT NOT NULL DEFAULT 0,
    passes_completed      SMALLINT NOT NULL DEFAULT 0,
    pass_completion_pct   NUMERIC(4, 1),
    progressive_passes    SMALLINT NOT NULL DEFAULT 0,

    -- Pressing (PPDA: passes per defensive action in opponent territory)
    -- Lower = more aggressive press. Null if no defensive actions in opponent half.
    ppda                  NUMERIC(5, 2),

    -- Defensive shape
    -- Average normalized x-coordinate of defensive actions (tackles, interceptions, etc.)
    -- Higher = defending further up the pitch (high press)
    defensive_height      NUMERIC(4, 1),

    -- Possession proxy (pass count share, not true time-based possession)
    possession_pct        NUMERIC(4, 1),

    -- Attacking
    box_entries           SMALLINT NOT NULL DEFAULT 0,

    -- Set pieces
    corners               SMALLINT NOT NULL DEFAULT 0,
    free_kicks            SMALLINT NOT NULL DEFAULT 0,

    -- Duels
    aerials_won           SMALLINT NOT NULL DEFAULT 0,
    aerials_total         SMALLINT NOT NULL DEFAULT 0,

    -- Match result from this team's perspective
    result                TEXT CHECK (result IN ('W', 'D', 'L')),

    -- Audit
    computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (match_id, team_id)
);

-- Why: team analysis pages and form computation query by team + season
CREATE INDEX IF NOT EXISTS idx_tms_team_season
    ON team_match_stats (team_id, season);
CREATE INDEX IF NOT EXISTS idx_tms_date
    ON team_match_stats (local_date DESC);
CREATE INDEX IF NOT EXISTS idx_tms_comp_season
    ON team_match_stats (competition_id, season);


-- =============================================================================
-- TEAM_SEASON_STATS — one row per team per season
-- Full season aggregates. Rebuilt weekly by the pipeline.
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_season_stats (
    team_id               TEXT NOT NULL REFERENCES teams(team_id),
    team_name             TEXT,
    competition_id        TEXT NOT NULL,
    season                TEXT NOT NULL,

    -- League record
    matches_played        SMALLINT NOT NULL DEFAULT 0,
    wins                  SMALLINT NOT NULL DEFAULT 0,
    draws                 SMALLINT NOT NULL DEFAULT 0,
    losses                SMALLINT NOT NULL DEFAULT 0,
    points                SMALLINT NOT NULL DEFAULT 0,  -- 3*W + D

    -- Goals
    goals_for             SMALLINT NOT NULL DEFAULT 0,
    goals_against         SMALLINT NOT NULL DEFAULT 0,
    goal_diff             SMALLINT NOT NULL DEFAULT 0,

    -- xG
    xg_for                NUMERIC(6, 2) NOT NULL DEFAULT 0,
    xg_against            NUMERIC(6, 2) NOT NULL DEFAULT 0,
    xg_diff               NUMERIC(5, 2),         -- xg_for - xg_against
    xg_delta              NUMERIC(5, 2),         -- goals_for - xg_for (over/underperformance)

    -- Shots
    shots_for             SMALLINT NOT NULL DEFAULT 0,
    shots_against         SMALLINT NOT NULL DEFAULT 0,
    shots_for_per90       NUMERIC(4, 2),

    -- Pressing
    ppda_season           NUMERIC(5, 2),          -- season average PPDA

    -- Defensive shape
    def_action_height     NUMERIC(4, 1),          -- season average defensive action height

    -- Possession
    possession_avg        NUMERIC(4, 1),

    -- Passing
    progressive_passes    INTEGER NOT NULL DEFAULT 0,  -- season total

    -- Standings (updated weekly)
    league_position       SMALLINT,

    -- Audit
    last_refreshed        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (team_id, competition_id, season)
);

-- Why: standings page and team page overview both query all teams in one competition/season
CREATE INDEX IF NOT EXISTS idx_tss_comp_season
    ON team_season_stats (competition_id, season);


-- =============================================================================
-- PLAYER_SEASON_STATS — one row per player per season
-- Populated from events_raw. Used for Top Scorers page and team squad tabs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_season_stats (
    player_id             TEXT NOT NULL,           -- player_id from CSV
    player_name           TEXT NOT NULL,
    team_id               TEXT REFERENCES teams(team_id),
    team_name             TEXT,
    competition_id        TEXT NOT NULL,
    season                TEXT NOT NULL,
    position              TEXT,                    -- "GK", "CF", "CB", etc.

    -- Appearances
    matches               SMALLINT NOT NULL DEFAULT 0,
    minutes               INTEGER NOT NULL DEFAULT 0,

    -- Scoring
    goals                 SMALLINT NOT NULL DEFAULT 0,
    assists               SMALLINT NOT NULL DEFAULT 0,
    penalties_scored      SMALLINT NOT NULL DEFAULT 0,
    own_goals             SMALLINT NOT NULL DEFAULT 0,

    -- Shots
    shots                 SMALLINT NOT NULL DEFAULT 0,
    shots_on_target       SMALLINT NOT NULL DEFAULT 0,
    shots_per90           NUMERIC(4, 2),

    -- xG (populated after xG model is trained)
    xg                    NUMERIC(5, 2) NOT NULL DEFAULT 0,
    npxg                  NUMERIC(5, 2) NOT NULL DEFAULT 0,  -- non-penalty xG
    xg_per_shot           NUMERIC(4, 3),
    goals_above_xg        NUMERIC(4, 2),         -- goals - npxg

    -- Big chances
    big_chances           SMALLINT NOT NULL DEFAULT 0,

    -- Audit
    last_refreshed        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (player_id, competition_id, season)
);

-- Why: top scorers page queries by competition+season, sorted by goals
CREATE INDEX IF NOT EXISTS idx_pss_comp_season_goals
    ON player_season_stats (competition_id, season, goals DESC);
CREATE INDEX IF NOT EXISTS idx_pss_team_season
    ON player_season_stats (team_id, season);


COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES — run these after migration to confirm schema is correct
-- =============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: competitions, events_raw, matches, player_season_stats, team_match_stats,
--           team_season_stats, teams
--
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
-- Expected: all idx_* indexes listed above
--
-- SELECT * FROM competitions;
-- Expected: one row — dm5ka0os1e3dxcp3vh05kmp33, Ligue 1, LI1, France
-- =============================================================================
