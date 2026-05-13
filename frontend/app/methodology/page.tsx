import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How Pressing Room calculates xG, PPDA, defensive height, and all other metrics.',
}

/**
 * Methodology page — /methodology
 *
 * Required at launch. Professional users will distrust an analytics
 * platform that cannot explain how its metrics are derived.
 * Be honest about known limitations.
 */

export default function MethodologyPage() {
  return (
    <div className="page-container py-12 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1
          className="text-3xl text-[var(--text-primary)] mb-3"
          style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
        >
          Methodology
        </h1>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          How Pressing Room calculates its metrics, where the data comes from,
          and what the known limitations are. We believe transparency is a prerequisite
          for trust in any analytical product.
        </p>
      </div>

      <div className="space-y-10">

        {/* Data source */}
        <Section title="Data Source">
          <p>
            Pressing Room uses Opta-style event-level football data. Each match is stored
            as a CSV file containing one row per event — every pass, tackle, shot, card,
            and substitution. For France Ligue 1 2025–26, this covers all 34 matchweeks
            and 306 matches.
          </p>
          <p>
            Each event includes: player, team, time (minute and second), pitch coordinates
            (x and y on a 0–100 scale), outcome (1 = success, 0 = failure), and a set of
            binary qualifier flags describing the event in detail — for example, whether a
            shot was headed, from the penalty spot, or from a corner situation.
          </p>
          <p>
            Data is processed within 24–48 hours of each matchday. Updates are applied in
            full after each matchweek's matches are complete.
          </p>
        </Section>

        {/* Coordinate system */}
        <Section title="Coordinate System">
          <p>
            All pitch coordinates are normalized during data processing so that every team
            attacks left → right (x = 0 is a team's own goal, x = 100 is the opponent's goal).
            This normalization is applied to both the shooting team's events and their opponents'.
          </p>
          <p>
            After normalization, the shot map shows both teams in their actual match positions:
            home team shots appear near x = 100, away team shots near x = 0. The caption on
            each shot map states: "Attack direction is left → right for the home team."
          </p>
          <p className="text-[var(--text-muted)] text-sm italic">
            Note: Some events in the Opta data have coordinates slightly outside the 0–100
            range (e.g., –1.8 or 101.8) where the ball was out of play. These are valid events
            and are included without modification.
          </p>
        </Section>

        {/* xG */}
        <Section title="Expected Goals (xG)">
          <p>
            Expected Goals (xG) assigns each shot a probability between 0 and 1 of resulting
            in a goal. A value of 0.35 means a typical professional player would score that
            chance approximately 35% of the time.
          </p>
          <p>
            Pressing Room computes xG using a logistic regression model trained on all shots
            in the dataset. The model uses six features:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)] ml-4">
            <li>Distance from goal (metres)</li>
            <li>Angle to goal (normalized)</li>
            <li>Whether the shot was headed</li>
            <li>Whether it was a penalty kick</li>
            <li>Whether it was classified as a "big chance" in the source data</li>
            <li>Whether it came from open play (vs. set piece)</li>
          </ul>
          <p>
            xG values are computed once at data ingestion time and stored permanently.
            They are not recalculated at query time.
          </p>
          <Limitation>
            The xG model V1 is trained on approximately 3,600–7,000 shots (1–2 seasons).
            This is a small training set by industry standards. The model will be imprecise
            for unusual shot types (e.g., overhead kicks, very wide-angle attempts).
            Accuracy improves significantly as more seasons are added.
            A hard floor of 0.76 is applied to penalty kicks to correct for likely
            underestimation on small datasets.
          </Limitation>
        </Section>

        {/* npxG */}
        <Section title="Non-Penalty xG (npxG)">
          <p>
            npxG is the sum of expected goals for all shots <em>excluding</em> penalty kicks.
            Penalties are worth approximately 0.76 xG each regardless of who takes them.
            npxG is a cleaner measure of a striker's shot-creation quality, independent of
            how often they win penalties.
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            A player with goals &gt; npxG is outperforming their shot quality (clinical
            finishing, or fortunate bounces). A player with goals &lt; npxG may be due for
            a scoring run. Neither direction is guaranteed to continue.
          </p>
        </Section>

        {/* PPDA */}
        <Section title="PPDA — Pressing Intensity">
          <p>
            PPDA (Passes Per Defensive Action) measures how aggressively a team presses.
            It is calculated as:
          </p>
          <div className="bg-[var(--bg-subtle)] rounded-lg p-4 font-mono text-sm text-[var(--text-primary)] my-3">
            PPDA = Opponent passes in their own half ÷ Team defensive actions in opponent half
          </div>
          <p>
            Defensive actions include: tackles, interceptions, ball recoveries, and fouls.
            "Opponent half" is defined as events occurring in x &gt; 40 (in normalized coordinates).
          </p>
          <p className="font-medium">
            Lower PPDA = more aggressive pressing.
            A typical Ligue 1 PPDA is approximately 10–12.
            Elite pressing teams average 7–9.
          </p>
          <Limitation>
            PPDA is a proxy for pressing intensity, not a direct measurement of how high
            or early a team defends. It is most meaningful when compared across full seasons
            rather than individual matches (which can be affected by scoreline, opponent
            quality, and game state).
          </Limitation>
        </Section>

        {/* Defensive height */}
        <Section title="Defensive Action Height">
          <p>
            Defensive Action Height is the average normalized x-coordinate of a team's
            defensive events (tackles, interceptions, clearances, ball recoveries).
            After coordinate normalization, x increases toward the opponent's goal.
          </p>
          <p>
            Higher values mean a team defends further up the pitch (higher defensive line).
            Lower values indicate a deeper defensive block.
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            Typical range: 30–60. Teams above 50 tend to be high-pressing;
            below 40 indicates a defensive block.
          </p>
        </Section>

        {/* Possession */}
        <Section title="Possession %">
          <p>
            Possession percentage on Pressing Room is a <strong>pass-count proxy</strong>,
            not a time-based measurement. It is calculated as:
          </p>
          <div className="bg-[var(--bg-subtle)] rounded-lg p-4 font-mono text-sm text-[var(--text-primary)] my-3">
            Possession % = Team passes ÷ Total passes in match × 100
          </div>
          <Limitation>
            True time-based possession requires ball-tracking data that is not available
            in this dataset. Pass-count possession is a reasonable proxy but will differ
            from broadcast possession figures, particularly in matches with many long balls
            (fewer passes, less possession by count).
          </Limitation>
        </Section>

        {/* Progressive passes */}
        <Section title="Progressive Passes">
          <p>
            A progressive pass is a completed pass that advances the ball at least 10 units
            (in normalized 0–100 coordinates) toward the opponent's goal.
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            This definition is intentionally simple for V1. Future versions may adopt a
            distance-from-goal reduction threshold (e.g., reducing distance to goal by ≥25%).
          </p>
        </Section>

        {/* Box entries */}
        <Section title="Box Entries">
          <p>
            A box entry is a completed pass whose endpoint falls inside the opponent's penalty
            box area: x &gt; 83 and y between 21–79 (in normalized 0–100 coordinates).
          </p>
        </Section>

        {/* Update frequency */}
        <Section title="Data Updates">
          <p>
            Match data is processed within 24–48 hours of each matchday.
            Season aggregate statistics (standings, top scorers, team profiles) are rebuilt
            after each matchday's matches are processed.
          </p>
          <p>
            xG values are computed at ingest time using the trained model.
            The model is retrained when new seasons are added to improve accuracy.
          </p>
        </Section>

        {/* Known limitations */}
        <Section title="Known Limitations">
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] ml-4">
            <li>
              <strong>xG model accuracy:</strong> V1 model is trained on 1–2 seasons of data
              (~3,600–7,000 shots). Models trained on 50,000+ shots across multiple leagues
              are significantly more accurate. Treat xG values as directional, not precise.
            </li>
            <li>
              <strong>Possession is a proxy:</strong> Pass-count possession differs from
              broadcast time-based possession, especially in counter-attacking matches.
            </li>
            <li>
              <strong>Player minutes:</strong> Minutes played are approximated from appearance
              data rather than exact substitution timestamps. Per-90 metrics should be treated
              as approximate.
            </li>
            <li>
              <strong>VAR and disallowed goals:</strong> Some goal events may be followed by
              a "Goal disallowed" event. The pipeline attempts to exclude disallowed goals
              from counts, but edge cases may exist.
            </li>
            <li>
              <strong>Single competition only:</strong> V1 covers France Ligue 1 only.
              Comparative metrics (e.g., "top 3 in Ligue 1") are relative to the 18-team
              league, not to European football broadly.
            </li>
          </ul>
        </Section>

      </div>

      <div className="mt-12 pt-6 border-t border-[var(--border-default)]">
        <p className="text-sm text-[var(--text-muted)]">
          Questions about the methodology?{' '}
          <Link href="/pro" className="text-[var(--accent-primary)] hover:underline">
            Contact us →
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="type-heading-md text-[var(--text-primary)] border-b border-[var(--border-default)] pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-[var(--text-secondary)] leading-relaxed text-sm">
        {children}
      </div>
    </section>
  )
}

function Limitation({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--accent-amber)] pl-4 py-1 text-sm text-[var(--text-muted)] italic">
      <span className="font-medium not-italic text-[var(--accent-amber)]">Known limitation: </span>
      {children}
    </div>
  )
}
