import React from 'react'
import { s, Spinner, fmtTs, fmt } from './ui.jsx'

export default function HealthPanel({ health, loading, error }) {
  if (loading) return <div style={s.card}><div style={s.cardTitle}>◈ table health</div><Spinner /></div>
  if (error) return <div style={s.card}><div style={s.cardTitle}>◈ table health</div><div style={{ color: 'var(--red)', fontSize: 12 }}>⚠ {error}</div></div>
  if (!health) return null

  const { last_vacuum, last_optimize, last_checkpoint_version, current_version, versions_since_checkpoint, last_schema_change } = health

  const checkpointOk = versions_since_checkpoint <= 10
  const vacuumOld = !last_vacuum

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>◈ vacuum &amp; checkpoint health</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <SmallMetric label="current version" value={`v${current_version}`} />
        <SmallMetric
          label="last checkpoint"
          value={`v${last_checkpoint_version}`}
          sub={`${versions_since_checkpoint} versions ago`}
          accent={checkpointOk ? 'var(--green)' : 'var(--amber)'}
        />
        <SmallMetric
          label="last vacuum"
          value={last_vacuum ? `v${last_vacuum.version}` : 'never'}
          sub={last_vacuum ? fmtTs(last_vacuum.timestamp) : ''}
          accent={vacuumOld ? 'var(--red)' : 'var(--text)'}
        />
        <SmallMetric
          label="last optimize"
          value={last_optimize ? `v${last_optimize.version}` : 'never'}
          sub={last_optimize ? fmtTs(last_optimize.timestamp) : ''}
        />
      </div>

      {last_vacuum?.metrics && Object.keys(last_vacuum.metrics).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>last vacuum metrics</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(last_vacuum.metrics).map(([k, v]) => (
              <div key={k} style={{
                fontSize: 11, padding: '3px 8px', background: 'var(--surface2)',
                borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: 'var(--muted)' }}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}: </span>
                <span style={{ color: 'var(--text)' }}>{typeof v === 'number' ? v.toLocaleString() : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatusPill ok={checkpointOk} label={checkpointOk ? 'checkpoints healthy' : 'checkpoint lag'} />
        <StatusPill ok={!vacuumOld} label={vacuumOld ? 'vacuum never run' : 'vacuum ok'} />
        {last_optimize && <StatusPill ok label="optimize has run" />}
        {last_schema_change &&
          <StatusPill ok={false} warn label={`schema changed v${last_schema_change.version}`} />}
      </div>
    </div>
  )
}

function SmallMetric({ label, value, sub, accent }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)',
      borderRadius: 'var(--radius)',
      padding: '10px 12px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 1,
        background: 'var(--teal)',
      }} />
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: accent || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusPill({ ok, warn, label }) {
  const color = warn ? 'var(--amber)' : ok ? 'var(--green)' : 'var(--red)'
  const bg = warn ? 'var(--amber-dim)' : ok ? 'var(--green-dim)' : 'var(--red-dim)'
  const icon = warn ? '⚑' : ok ? '✓' : '✗'
  const shadow = warn ? 'var(--shadow-glow-amber)' : ok ? 'var(--shadow-glow-green)' : 'var(--shadow-glow-red)'
  const borderColor = warn ? 'rgba(251,191,36,0.4)' : ok ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'
  return (
    <span style={{
      fontSize: 11, padding: '3px 9px', background: bg, color,
      borderRadius: 99, fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      boxShadow: shadow,
      border: '1px solid ' + borderColor,
    }}>
      {icon} {label}
    </span>
  )
}
