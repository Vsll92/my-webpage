'use client'

/**
 * XGFlowChart — cumulative xG by minute for both teams.
 *
 * Built with Recharts. Two lines (home + away), goal events annotated.
 *
 * Design:
 *   - Home team: accent-primary (sapphire)
 *   - Away team: accent-secondary (green)
 *   - Goal events: vertical dashed line + dot annotation
 *   - Dark always tooltip (consistent with the rest of the design system)
 *   - Caption below: explains what the chart shows
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  ReferenceLine, Label,
} from 'recharts'

export interface XGPoint { minute: number; cumulative_xg: number }
export interface XGGoal  { team_id: string; minute: number; xg_at_time: number }

interface XGFlowChartProps {
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  homeData: XGPoint[]
  awayData: XGPoint[]
  goals: XGGoal[]
  height?: number
}

// Merge home + away data into a single array keyed by minute for Recharts
function mergeData(homeData: XGPoint[], awayData: XGPoint[]) {
  const map: Record<number, { minute: number; home: number; away: number }> = {}

  for (const p of homeData) {
    if (!map[p.minute]) map[p.minute] = { minute: p.minute, home: 0, away: 0 }
    map[p.minute].home = p.cumulative_xg
  }
  for (const p of awayData) {
    if (!map[p.minute]) map[p.minute] = { minute: p.minute, home: 0, away: 0 }
    map[p.minute].away = p.cumulative_xg
  }

  return Object.values(map).sort((a, b) => a.minute - b.minute)
}

// Custom tooltip — always dark background
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        backgroundColor: '#1A1E2A',
        border: '1px solid #2D3348',
        color: '#F0F0EC',
      }}
    >
      <div className="text-[#8B8FA8] text-xs mb-1">{label}&apos;</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-[#8B8FA8]">{entry.name}:</span>
          <span
            className="text-xs font-medium"
            style={{ fontFamily: '"DM Mono", monospace', color: '#F0F0EC' }}
          >
            {Number(entry.value).toFixed(2)} xG
          </span>
        </div>
      ))}
    </div>
  )
}

export default function XGFlowChart({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeData,
  awayData,
  goals,
  height = 280,
}: XGFlowChartProps) {
  const merged = mergeData(homeData, awayData)

  // Home goals and away goals for reference lines
  const homeGoals = goals.filter(g => g.team_id === homeTeamId)
  const awayGoals = goals.filter(g => g.team_id === awayTeamId)

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={merged}
          margin={{ top: 10, right: 16, bottom: 10, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-default)"
            opacity={0.5}
          />
          <XAxis
            dataKey="minute"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: '"DM Mono", monospace' }}
            tickFormatter={(v) => `${v}'`}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: '"DM Mono", monospace' }}
            tickFormatter={(v) => v.toFixed(1)}
            width={32}
          />
          <RechartsTooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          />

          {/* Half-time reference line */}
          <ReferenceLine
            x={45}
            stroke="var(--border-default)"
            strokeDasharray="4 4"
          >
            <Label
              value="HT"
              position="top"
              style={{ fill: 'var(--text-muted)', fontSize: 10 }}
            />
          </ReferenceLine>

          {/* Goal reference lines */}
          {homeGoals.map((g, i) => (
            <ReferenceLine
              key={`hg-${i}`}
              x={g.minute}
              stroke="var(--accent-primary)"
              strokeDasharray="2 3"
              strokeOpacity={0.6}
            />
          ))}
          {awayGoals.map((g, i) => (
            <ReferenceLine
              key={`ag-${i}`}
              x={g.minute}
              stroke="var(--accent-secondary)"
              strokeDasharray="2 3"
              strokeOpacity={0.6}
            />
          ))}

          {/* Lines */}
          <Line
            type="monotone"
            dataKey="home"
            name={homeTeamName}
            stroke="var(--accent-primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
          />
          <Line
            type="monotone"
            dataKey="away"
            name={awayTeamName}
            stroke="var(--accent-secondary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent-secondary)' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: 'var(--accent-primary)' }} />
          <span className="text-xs text-[var(--text-muted)]">{homeTeamName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: 'var(--accent-secondary)' }} />
          <span className="text-xs text-[var(--text-muted)]">{awayTeamName}</span>
        </div>
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <span className="text-xs text-[var(--text-muted)]">
            Dashed lines = goals scored
          </span>
        )}
      </div>
    </div>
  )
}
