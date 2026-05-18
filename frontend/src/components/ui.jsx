import React, { useState } from 'react'

export const s = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    boxShadow: 'var(--shadow-card)',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--muted2)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-sans)',
  },
  mono: { fontFamily: 'var(--font-mono)' },
}

const OP_COLORS = {
  WRITE: { color: 'var(--blue)', bg: 'var(--blue-dim)' },
  MERGE: { color: 'var(--teal)', bg: 'var(--teal-dim)' },
  DELETE: { color: 'var(--red)', bg: 'var(--red-dim)' },
  OPTIMIZE: { color: 'var(--amber)', bg: 'var(--amber-dim)' },
  'VACUUM START': { color: 'var(--muted2)', bg: 'var(--gray-dim)' },
  'VACUUM END': { color: 'var(--muted2)', bg: 'var(--gray-dim)' },
  'ADD COLUMNS': { color: 'var(--purple)', bg: 'var(--purple-dim)' },
  'REPLACE COLUMNS': { color: 'var(--purple)', bg: 'var(--purple-dim)' },
  'CHANGE COLUMN': { color: 'var(--purple)', bg: 'var(--purple-dim)' },
  CREATE: { color: 'var(--green)', bg: 'var(--green-dim)' },
  REORG: { color: 'var(--amber)', bg: 'var(--amber-dim)' },
}

export function opStyle(op) {
  const key = Object.keys(OP_COLORS).find(k => (op || '').toUpperCase().includes(k)) || '__'
  return OP_COLORS[key] || { color: 'var(--muted2)', bg: 'var(--gray-dim)' }
}

export function OpBadge({ op }) {
  const { color, bg } = opStyle(op)
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      padding: '3px 10px',
      borderRadius: 4,
      background: bg,
      color,
      fontWeight: 600,
      border: '1px solid ' + color + '4d',
    }}>{op}</span>
  )
}

export function Metric({ label, value, sub, accent, tooltip }) {
  const [tipVisible, setTipVisible] = useState(false)
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      border: '1px solid var(--border)',
      overflow: 'visible',
    }}>
      {accent && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: accent,
          borderRadius: 'var(--radius) var(--radius) 0 0',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)' }}>{label}</div>
        {tooltip && (
          <div style={{ position: 'relative' }}>
            <span
              onMouseEnter={() => setTipVisible(true)}
              onMouseLeave={() => setTipVisible(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: '50%',
                background: 'var(--surface3)', border: '1px solid var(--border2)',
                color: 'var(--muted)', fontSize: 9, fontFamily: 'var(--font-sans)',
                cursor: 'default', fontWeight: 600, lineHeight: 1, flexShrink: 0,
                userSelect: 'none',
              }}
            >i</span>
            {tipVisible && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
                background: 'var(--surface3)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', padding: '8px 10px',
                fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--font-sans)',
                lineHeight: 1.5, whiteSpace: 'normal', width: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 100, pointerEvents: 'none',
              }}>
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--font-mono)', color: accent || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 20, height: 20, border: '2px solid var(--border2)',
        borderTop: '2px solid var(--teal)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        boxShadow: '0 0 12px rgba(45,212,191,0.3)',
      }} />
    </div>
  )
}

export function ErrorBox({ msg }) {
  return (
    <div style={{
      background: 'var(--red-dim)',
      border: '1px solid var(--red)',
      borderRadius: 'var(--radius)', padding: '12px 16px',
      color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12,
      boxShadow: 'var(--shadow-glow-red)',
    }}>⚠ {msg}</div>
  )
}

export function fmt(n, opts = {}) {
  if (n == null) return '—'
  if (opts.bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0, v = n
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }
  if (opts.rows) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return String(n)
  }
  return n.toLocaleString()
}

export function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19)
}
