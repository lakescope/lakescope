import React from 'react'
import { s, OpBadge, Spinner, fmt, fmtTs } from './ui.jsx'

export function CommitDetail({ commits, selectedV }) {
  const c = commits?.find(x => x.version === selectedV)

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>
        ◈ commit detail
        {c && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)', marginLeft: 4 }}>v{c.version}</span>}
      </div>

      {!c ? (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>select a commit</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <Row k="operation"><OpBadge op={c.operation} /></Row>
            <Row k="timestamp">{fmtTs(c.timestamp)}</Row>
            <Row k="user">{(c.user || '—').slice(0, 32)}</Row>
            <Row k="duration">{c.execution_time_ms ? (c.execution_time_ms / 1000).toFixed(1) + 's' : '—'}</Row>
            <Row k="files added"><span style={{ color: 'var(--green)' }}>+{c.num_added_files ?? '—'}</span></Row>
            <Row k="files removed"><span style={{ color: c.num_removed_files ? 'var(--red)' : 'var(--muted)' }}>-{c.num_removed_files ?? '—'}</span></Row>
            <Row k="rows out">{c.num_output_rows != null ? fmt(c.num_output_rows, { rows: true }) : '—'}</Row>
            <Row k="size">{c.size_bytes ? fmt(c.size_bytes, { bytes: true }) : '—'}</Row>
            <Row k="write amp.">
              {c.num_added_files && c.num_removed_files && c.num_removed_files > 0
                ? (c.num_added_files / c.num_removed_files).toFixed(2)
                : '—'}
            </Row>
          </div>

          {Object.keys(c.parameters || {}).length > 0 && (
            <div style={{
              background: 'var(--surface2)', borderRadius: 'var(--radius)',
              padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--muted2)', maxHeight: 80, overflowY: 'auto',
            }}>
              {Object.entries(c.parameters).map(([k, v]) => (
                <div key={k}><span style={{ color: 'var(--muted)' }}>{k}: </span>{v.slice(0, 80)}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ k, children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '8px 12px',
      background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-sans)' }}>{k}</div>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{children}</div>
    </div>
  )
}

export function SchemaPanel({ schema, loading, error }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>◈ schema</div>
      {loading && <Spinner />}
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>⚠ {error}</div>}
      {schema && schema.map(f => (
        <div key={f.name} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 0', borderBottom: '0.5px solid var(--border)',
          fontSize: 12,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', minWidth: 140 }}>{f.name}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted2)', flex: 1, fontSize: 11 }}>{f.type}</span>
          {!f.nullable && (
            <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: 4 }}>NOT NULL</span>
          )}
        </div>
      ))}
    </div>
  )
}
