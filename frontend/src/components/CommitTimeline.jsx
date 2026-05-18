import React, { useState, useEffect } from 'react'
import { s, OpBadge, Spinner, ErrorBox, fmtTs, fmt } from './ui.jsx'

const OPS = ['ALL', 'WRITE', 'MERGE', 'DELETE', 'OPTIMIZE', 'VACUUM END', 'ADD COLUMNS']

const PAGE_SIZE = 10

export default function CommitTimeline({ commits, loading, error, selectedV, onSelect, filter, onFilterChange }) {
  const [page, setPage] = useState(0)

  const filtered = !commits ? [] :
    filter === 'ALL' ? commits : commits.filter(c => c.operation?.toUpperCase().includes(filter))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const handleFilter = (op) => {
    onFilterChange(op)
    setPage(0)
  }

  // Auto-jump to the page containing the selected commit (e.g. from keyboard nav)
  useEffect(() => {
    if (selectedV == null || !filtered.length) return
    const idx = filtered.findIndex(c => c.version === selectedV)
    if (idx === -1) return
    setPage(Math.floor(idx / PAGE_SIZE))
  }, [selectedV])

  return (
    <div style={{ ...s.card, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={s.cardTitle}>◈ commit timeline</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {OPS.map(op => (
          <button key={op} onClick={() => handleFilter(op)} style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', border: '1px solid',
            borderColor: filter === op ? 'rgba(45,212,191,0.3)' : 'transparent',
            background: filter === op ? 'rgba(45,212,191,0.1)' : 'transparent',
            color: filter === op ? 'var(--teal)' : 'var(--muted)',
          }}>{op.toLowerCase()}</button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox msg={error} />}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {visible.map(c => (
          <CommitRow
            key={c.version}
            c={c}
            selected={c.version === selectedV}
            onSelect={onSelect}
          />
        ))}
        {!loading && visible.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
            no commits match filter
          </div>
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, marginTop: 8, borderTop: '0.5px solid var(--border)',
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={pageBtn(safePage === 0)}
          >← prev</button>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
            {safePage + 1} / {totalPages}
            <span style={{ color: 'var(--border2)', marginLeft: 8 }}>{filtered.length} commits</span>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            style={pageBtn(safePage === totalPages - 1)}
          >next →</button>
        </div>
      )}
    </div>
  )
}

function pageBtn(disabled) {
  return {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius)',
    padding: '3px 10px',
    fontFamily: 'var(--font-sans)', fontSize: 11,
    color: disabled ? 'var(--muted)' : 'var(--muted2)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}

function CommitRow({ c, selected, onSelect }) {
  const ts = fmtTs(c.timestamp)
  const day = ts.slice(0, 10)
  const time = ts.slice(11, 19)

  return (
    <div
      onClick={() => onSelect(c.version)}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
      style={{
        display: 'grid', gridTemplateColumns: '52px 1fr auto',
        gap: 10,
        padding: selected ? '9px 8px 9px 5px' : '9px 8px',
        paddingLeft: selected ? '5px' : '8px',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--border)',
        borderLeft: selected ? '3px solid var(--teal)' : '3px solid transparent',
        borderRadius: selected ? 'var(--radius)' : 0,
        background: selected
          ? 'linear-gradient(90deg, rgba(45,212,191,0.07) 0%, transparent 60%)'
          : 'transparent',
        transition: 'background 0.1s',
      }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: selected ? 'var(--teal)' : 'var(--muted2)',
          fontWeight: selected ? 600 : 500,
        }}>
          v{c.version}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
          {day}<br />{time}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <OpBadge op={c.operation} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)', marginBottom: 3 }}>
          {(c.user || 'unknown').slice(0, 40)}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {c.num_added_files != null && c.num_added_files > 0 &&
            <Pill v={`+${c.num_added_files} files`} color="var(--green)" />}
          {c.num_removed_files != null && c.num_removed_files > 0 &&
            <Pill v={`-${c.num_removed_files} files`} color="var(--red)" />}
          {c.num_output_rows != null && c.num_output_rows > 0 &&
            <Pill v={`+${fmt(c.num_output_rows, { rows: true })} rows`} color="var(--blue)" />}
          {c.num_deleted_rows != null && c.num_deleted_rows > 0 &&
            <Pill v={`-${fmt(c.num_deleted_rows, { rows: true })} rows`} color="var(--red)" />}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
        {c.size_bytes ? fmt(c.size_bytes, { bytes: true }) : '—'}<br />
        {c.execution_time_ms ? (c.execution_time_ms / 1000).toFixed(1) + 's' : '—'}
      </div>
    </div>
  )
}

function Pill({ v, color }) {
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 999,
      background: color + '20', color, fontFamily: 'var(--font-mono)',
    }}>{v}</span>
  )
}
