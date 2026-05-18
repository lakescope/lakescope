import React, { useState, useMemo } from 'react'
import { s } from './ui.jsx'

const LEVELS = [
  'var(--surface3)',
  'rgba(45,212,191,0.2)',
  'rgba(45,212,191,0.4)',
  'rgba(45,212,191,0.65)',
  '#2dd4bf',
]

function getLevel(count) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

function fmtRelative(ts) {
  if (!ts) return null
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function FrequencyHeatmap({ commits }) {
  const [tooltip, setTooltip] = useState(null)

  const { grid, months, totalCommits, activeDays } = useMemo(() => {
    if (!commits || !commits.length) return { grid: [], months: [], totalCommits: 0, activeDays: 0 }

    const counts = {}
    for (const c of commits) {
      if (!c.timestamp) continue
      const day = new Date(c.timestamp).toISOString().slice(0, 10)
      counts[day] = (counts[day] || 0) + 1
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Start on the Sunday 52 weeks back
    const start = new Date(today)
    start.setDate(start.getDate() - 364 - start.getDay())

    const weeks = []
    const monthLabels = []
    const cur = new Date(start)

    while (cur <= today) {
      const week = []
      const weekStart = new Date(cur)

      for (let d = 0; d < 7; d++) {
        if (cur > today) {
          week.push({ date: null, count: 0 })
        } else {
          const dateStr = cur.toISOString().slice(0, 10)
          week.push({ date: dateStr, count: counts[dateStr] || 0 })
        }
        cur.setDate(cur.getDate() + 1)
      }

      const month = weekStart.toLocaleString('en', { month: 'short' })
      const prev = new Date(weekStart)
      prev.setDate(prev.getDate() - 7)
      if (month !== prev.toLocaleString('en', { month: 'short' })) {
        monthLabels.push({ weekIdx: weeks.length, label: month })
      }

      weeks.push(week)
    }

    const activeDays = Object.values(counts).filter(v => v > 0).length

    return { grid: weeks, months: monthLabels, totalCommits: commits.length, activeDays }
  }, [commits])

  if (!commits) return null

  return (
    <div style={s.card}>
      <div style={{ ...s.cardTitle, justifyContent: 'space-between' }}>
        <span>◈ commit frequency</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          {totalCommits} commits · {activeDays} active days
        </span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        {/* Month labels */}
        <div style={{ display: 'flex', marginLeft: 28, position: 'relative', height: 16, marginBottom: 2 }}>
          {months.map(m => (
            <div key={`${m.weekIdx}-${m.label}`} style={{
              position: 'absolute',
              left: m.weekIdx * 14,
              fontSize: 10, color: 'var(--muted)',
              fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            }}>{m.label}</div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {/* Day-of-week labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 0 }}>
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
              <div key={i} style={{
                height: 12, fontSize: 9, color: 'var(--muted)',
                fontFamily: 'var(--font-sans)', lineHeight: '12px',
                width: 22, textAlign: 'right', flexShrink: 0,
              }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {week.map((cell, di) => (
                <div
                  key={di}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.4)'
                    if (cell.date) setTooltip({ date: cell.date, count: cell.count, x: e.clientX, y: e.clientY })
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    setTooltip(null)
                  }}
                  style={{
                    width: 12, height: 12, borderRadius: 2,
                    background: cell.date ? LEVELS[getLevel(cell.count)] : 'transparent',
                    border: cell.date ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    cursor: cell.date ? 'default' : 'default',
                    transition: 'transform 0.1s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-sans)', marginRight: 2 }}>less</span>
          {LEVELS.map((color, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: color, border: '1px solid rgba(255,255,255,0.05)' }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-sans)', marginLeft: 2 }}>more</span>
        </div>
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 38,
          background: 'var(--surface3)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius)', padding: '5px 10px',
          fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-sans)',
          pointerEvents: 'none', zIndex: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: tooltip.count > 0 ? 'var(--teal)' : 'var(--muted)' }}>
            {tooltip.count} commit{tooltip.count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{tooltip.date}</span>
        </div>
      )}
    </div>
  )
}

export function freshnessInfo(history) {
  if (!history || !history.length) return null
  const dataOps = new Set(['WRITE', 'MERGE', 'DELETE', 'CREATE TABLE', 'CREATE OR REPLACE TABLE'])
  const last = history.find(c => dataOps.has(c.operation)) || history[0]
  if (!last?.timestamp) return null
  const ts = last.timestamp
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86_400_000)
  return {
    label: fmtRelative(ts),
    accent: diff < 86_400_000 ? 'var(--green)' : diff < 7 * 86_400_000 ? undefined : 'var(--red)',
    days,
  }
}
