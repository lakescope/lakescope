import React, { useState } from 'react'

export default function S3Sidebar({ currentPath, onSelect, onClose }) {
  const [inputVal, setInputVal] = useState(() =>
    currentPath ? currentPath.replace(/[^/]+\.delta\/?$/, '') : 's3://'
  )
  const [prefix, setPrefix] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const browse = async (p) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/browse?prefix=${encodeURIComponent(p)}`)
      if (!res.ok) throw new Error(await res.text())
      const d = await res.json()
      setData(d)
      setPrefix(d.prefix)
      setInputVal(d.prefix)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputVal.trim()) browse(inputVal.trim())
  }

  const goUp = () => {
    const p = prefix.replace(/\/$/, '')
    const parent = p.substring(0, p.lastIndexOf('/') + 1)
    if (parent && parent !== 's3://') browse(parent)
  }

  const crumbs = () => {
    const p = prefix.replace(/^s3:\/\//, '')
    const parts = p.split('/').filter(Boolean)
    const result = [{ label: 's3://', path: '' }]
    let acc = ''
    for (const part of parts) {
      acc += part + '/'
      result.push({ label: part, path: `s3://${acc}` })
    }
    return result
  }

  const shortLabel = (full) => full.replace(prefix, '').replace(/\/$/, '') || full
  const isActive = (t) => t.replace(/\/$/, '') === (currentPath || '').replace(/\/$/, '')

  return (
    <div style={{
      width: 264, flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
      background: 'linear-gradient(180deg, #0a0e17 0%, #070b10 100%)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 16px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>◈</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--muted2)',
            fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Tables</span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          cursor: 'pointer', fontSize: 14, padding: '2px 6px',
          borderRadius: 4, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Path input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        flexShrink: 0, borderBottom: '1px solid var(--border)',
      }}>
        <input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="s3://bucket/"
          style={{
            flex: 1, minWidth: 0,
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)', padding: '5px 8px',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none',
          }}
        />
        <button type="submit" disabled={loading} style={{
          background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
          borderRadius: 'var(--radius)', padding: '5px 10px',
          color: 'var(--teal)', fontSize: 11, fontFamily: 'var(--font-sans)',
          fontWeight: 500, cursor: 'pointer', flexShrink: 0,
        }}>go</button>
      </form>

      {/* Breadcrumbs */}
      {prefix && (
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
          padding: '6px 12px 4px', flexShrink: 0,
        }}>
          {crumbs().map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'var(--border2)', fontSize: 10, margin: '0 1px' }}>/</span>}
              <button
                onClick={() => c.path ? browse(c.path) : null}
                title={c.label}
                style={{
                  background: 'none', border: 'none', padding: '1px 2px',
                  color: c.path ? 'var(--teal)' : 'var(--muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  cursor: c.path ? 'pointer' : 'default',
                  maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >{c.label}</button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{
              width: 16, height: 16, border: '2px solid var(--border2)',
              borderTop: '2px solid var(--teal)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              boxShadow: '0 0 8px rgba(45,212,191,0.3)',
            }} />
          </div>
        )}

        {error && (
          <div style={{
            color: 'var(--red)', fontSize: 11, fontFamily: 'var(--font-mono)',
            padding: '8px', background: 'var(--red-dim)', borderRadius: 'var(--radius)', margin: '4px 0',
          }}>⚠ {error}</div>
        )}

        {!loading && data && (
          <>
            {prefix.replace(/^s3:\/\/[^/]+\/$/, '') !== '' && (
              <SidebarRow icon="↑" label=".." onClick={goUp} />
            )}
            {data.tables.length === 0 && data.dirs.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 11, padding: '12px 6px', fontFamily: 'var(--font-sans)' }}>
                no tables found here
              </div>
            )}
            {data.tables.map(t => (
              <SidebarRow
                key={t} icon="△" label={shortLabel(t)}
                isTable active={isActive(t)}
                onClick={() => onSelect(t)}
              />
            ))}
            {data.dirs.map(d => (
              <SidebarRow key={d} icon="▸" label={shortLabel(d)} onClick={() => browse(d)} />
            ))}
          </>
        )}

        {!loading && !data && !error && (
          <div style={{
            color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-sans)',
            padding: '16px 6px', lineHeight: 1.7,
          }}>
            Enter a bucket prefix and click <span style={{ color: 'var(--teal)' }}>go</span> to browse your Delta tables.
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarRow({ icon, label, isTable = false, active = false, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', border: 'none', textAlign: 'left',
        padding: '6px 8px', borderRadius: 'var(--radius)',
        cursor: 'pointer',
        background: active
          ? 'linear-gradient(90deg, rgba(45,212,191,0.12), rgba(45,212,191,0.04))'
          : hovered ? 'var(--surface2)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--teal)' : 'transparent'}`,
        marginBottom: 1, transition: 'background 0.1s',
      }}
    >
      <span style={{
        color: isTable ? 'var(--teal)' : 'var(--muted)',
        fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0,
      }}>{icon}</span>
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 11, fontFamily: 'var(--font-mono)',
        color: active ? 'var(--teal)' : isTable ? 'var(--text)' : 'var(--muted2)',
        fontWeight: active ? 600 : 400,
      }}>{label}</span>
      {active && (
        <span style={{
          marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
          background: 'var(--teal)', flexShrink: 0,
          boxShadow: 'var(--shadow-glow-teal)',
        }} />
      )}
    </button>
  )
}
