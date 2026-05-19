import React from 'react'
import { s, OpBadge, Metric, Spinner, fmt, fmtTs } from './ui.jsx'

export function CommitDetail({ commits, selectedV }) {
  const c = commits?.find(x => x.version === selectedV)

  const writeAmp = c?.num_added_files && c?.num_removed_files && c.num_removed_files > 0
    ? (c.num_added_files / c.num_removed_files).toFixed(2)
    : null

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>
        ◈ commit detail
        {c && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)', marginLeft: 4 }}>v{c.version}</span>}
      </div>

      {!c ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>select a commit to view details</div>
      ) : (
        <>
          {/* Operation + timestamp header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <OpBadge op={c.operation} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
              {fmtTs(c.timestamp)}
            </span>
          </div>

          {/* User + duration meta row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            <MetaItem label="user" value={(c.user || '—').slice(0, 40)} />
            <MetaItem label="duration" value={c.execution_time_ms ? (c.execution_time_ms / 1000).toFixed(1) + 's' : '—'} />
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Metric label="files added" value={c.num_added_files ?? '—'} accent="var(--green)" />
            <Metric label="files removed" value={c.num_removed_files ?? '—'} accent={c.num_removed_files ? 'var(--red)' : undefined} />
            <Metric label="write amp" value={writeAmp ?? '—'} />
            <Metric label="rows out" value={c.num_output_rows != null ? fmt(c.num_output_rows, { rows: true }) : '—'} />
            <Metric label="size" value={c.size_bytes ? fmt(c.size_bytes, { bytes: true }) : '—'} />
          </div>

          {/* Parameters */}
          {Object.keys(c.parameters || {}).length > 0 && (
            <>
              <div style={{
                fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
              }}>parameters</div>
              <div style={{
                background: 'var(--surface2)', borderRadius: 'var(--radius)',
                padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--muted2)', maxHeight: 140, overflowY: 'auto', lineHeight: 1.8,
              }}>
                {Object.entries(c.parameters).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--muted)' }}>{k}:</span>{' '}
                    <span style={{ color: 'var(--text)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function MetaItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}

export function SchemaPanel({ schema, loading, error }) {
  const generatedCount = schema?.filter(f => f.generated_expression).length ?? 0
  return (
    <div style={s.card}>
      <div style={{ ...s.cardTitle, justifyContent: 'space-between' }}>
        <span>◈ schema</span>
        {generatedCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {generatedCount} generated
          </span>
        )}
      </div>
      {loading && <Spinner />}
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>⚠ {error}</div>}
      {schema && schema.map(f => (
        <div key={f.name} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', minWidth: 140 }}>{f.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted2)', flex: 1, fontSize: 11 }}>{f.type}</span>
            {f.generated_expression && (
              <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--purple-dim)', color: 'var(--purple)', borderRadius: 4, whiteSpace: 'nowrap' }}>
                GENERATED
              </span>
            )}
            {!f.nullable && (
              <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: 4, whiteSpace: 'nowrap' }}>
                NOT NULL
              </span>
            )}
          </div>
          {f.generated_expression && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--purple)', opacity: 0.85,
              marginTop: 3, paddingLeft: 148,
            }}>
              AS ({f.generated_expression})
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
