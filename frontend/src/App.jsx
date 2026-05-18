import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api.js'
import { Metric, Spinner, ErrorBox, fmt } from './components/ui.jsx'
import PathBar from './components/PathBar.jsx'
import CommitTimeline from './components/CommitTimeline.jsx'
import { CommitDetail, SchemaPanel } from './components/DetailPanels.jsx'
import { FileCountChart, OpsChart, FileSizeChart } from './components/Charts.jsx'
import HealthPanel from './components/HealthPanel.jsx'
import FrequencyHeatmap, { freshnessInfo } from './components/FrequencyHeatmap.jsx'
import S3Sidebar from './components/S3Sidebar.jsx'

function useAsync(fn) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fn(...args))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, run }
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem('lakescope_recent') || '[]') } catch { return [] }
}

const SHORTCUTS = [
  ['⌘K', 'Focus path input'],
  ['⌘B', 'Toggle S3 browser'],
  ['r', 'Refresh table'],
  ['j / ↓', 'Next commit'],
  ['k / ↑', 'Previous commit'],
  ['Esc', 'Close panels'],
  ['?', 'Toggle this panel'],
]

function ShortcutsOverlay({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px', minWidth: 300,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: 'var(--muted2)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 16, fontFamily: 'var(--font-sans)',
        }}>keyboard shortcuts</div>
        {SHORTCUTS.map(([key, label]) => (
          <div key={key} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '0.5px solid var(--border)',
          }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--muted2)' }}>{label}</span>
            <kbd style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 8px',
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 4, color: 'var(--teal)',
            }}>{key}</kbd>
          </div>
        ))}
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
          click anywhere to close
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const info = useAsync(api.info)
  const history = useAsync(api.history)
  const schema = useAsync(api.schema)
  const files = useAsync(api.files)
  const health = useAsync(api.health)

  // Initialise from URL so refreshing and sharing links work
  const [path, setPath] = useState(() => new URLSearchParams(window.location.search).get('path') || '')
  const [selectedV, setSelectedV] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('v')
    return v !== null ? Number(v) : null
  })
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get('op') || 'ALL')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [recentTables, setRecentTables] = useState(getRecent)
  const pathInputRef = useRef(null)

  const loadAll = useCallback(async (targetPath) => {
    const p = targetPath !== undefined ? targetPath : path
    await Promise.all([
      info.run(p), history.run(p), schema.run(p), files.run(p), health.run(p)
    ])
  }, [path])

  const handlePathChange = useCallback((newPath) => {
    setPath(newPath)
    setSelectedV(null)
    const recent = [newPath, ...getRecent().filter(x => x !== newPath)].slice(0, 5)
    localStorage.setItem('lakescope_recent', JSON.stringify(recent))
    setRecentTables(recent)
    loadAll(newPath)
  }, [loadAll])

  // Load URL path on first mount
  useEffect(() => {
    const urlPath = new URLSearchParams(window.location.search).get('path')
    if (urlPath) loadAll(urlPath)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select most recent commit when history arrives (if nothing selected from URL)
  useEffect(() => {
    if (history.data && selectedV == null) {
      setSelectedV(history.data[0]?.version ?? null)
    }
  }, [history.data])

  // Keep URL in sync with UI state
  useEffect(() => {
    const u = new URL(window.location)
    if (path) u.searchParams.set('path', path); else u.searchParams.delete('path')
    if (selectedV != null) u.searchParams.set('v', String(selectedV)); else u.searchParams.delete('v')
    if (filter !== 'ALL') u.searchParams.set('op', filter); else u.searchParams.delete('op')
    window.history.replaceState(null, '', u)
  }, [path, selectedV, filter])

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        pathInputRef.current?.focus()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(o => !o)
        return
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (path) loadAll()
        return
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setShowShortcuts(false)
        return
      }
      if (e.key === '?') {
        setShowShortcuts(o => !o)
        return
      }
      // j / ↓  →  next commit in filtered list
      if ((e.key === 'j' || e.key === 'ArrowDown') && history.data) {
        e.preventDefault()
        const commits = filter === 'ALL' ? history.data : history.data.filter(c => c.operation?.toUpperCase().includes(filter))
        const idx = commits.findIndex(c => c.version === selectedV)
        if (idx < commits.length - 1) setSelectedV(commits[idx + 1].version)
        return
      }
      // k / ↑  →  previous commit
      if ((e.key === 'k' || e.key === 'ArrowUp') && history.data) {
        e.preventDefault()
        const commits = filter === 'ALL' ? history.data : history.data.filter(c => c.operation?.toUpperCase().includes(filter))
        const idx = commits.findIndex(c => c.version === selectedV)
        if (idx > 0) setSelectedV(commits[idx - 1].version)
        return
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [history.data, selectedV, filter, path, loadAll])

  const anyLoading = info.loading || history.loading
  const hasData = !!info.data

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && (
        <S3Sidebar
          currentPath={path}
          onSelect={handlePathChange}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              background: 'var(--gradient-accent)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-sans)',
            }}>
              ▲ LakeScope
            </div>
            <div style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: 'var(--font-sans)',
              marginTop: 2,
              letterSpacing: '0.02em',
            }}>
              delta lake inspector
            </div>
          </div>

          {info.error && <ErrorBox msg={info.error} />}

          <PathBar
            inputRef={pathInputRef}
            info={info.data}
            currentPath={path}
            onPathChange={handlePathChange}
            onRefresh={() => loadAll()}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            sidebarOpen={sidebarOpen}
            loading={anyLoading}
          />

          {/* Empty state */}
          {!hasData && !anyLoading && (
            <div className="animate-in" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '60px 24px', gap: 10,
            }}>
              <div style={{ fontSize: 40, color: 'var(--border2)' }}>△</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted2)' }}>
                enter an s3:// path or browse to load a delta table
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.7, textAlign: 'center', lineHeight: 1.7 }}>
                reads directly from <span style={{ fontFamily: 'var(--font-mono)' }}>_delta_log/</span> · no spark required
                <br />credentials via <span style={{ fontFamily: 'var(--font-mono)' }}>AWS_*</span> env vars or <span style={{ fontFamily: 'var(--font-mono)' }}>~/.aws/credentials</span>
              </div>

              {recentTables.length > 0 && (
                <div style={{ marginTop: 24, width: '100%', maxWidth: 520 }}>
                  <div style={{
                    fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: 10, fontFamily: 'var(--font-sans)',
                  }}>
                    recent tables
                  </div>
                  {recentTables.map(p => (
                    <button
                      key={p}
                      onClick={() => handlePathChange(p)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.35)'; e.currentTarget.style.background = 'var(--surface3)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface2)' }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 14px', marginBottom: 6,
                        background: 'var(--surface2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--teal)',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {anyLoading && !hasData && (
            <div style={{ marginBottom: 20 }}><Spinner /></div>
          )}

          {/* Metrics — 4 cards; version/files/size are already in the sticky PathBar pills */}
          {hasData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 20 }}>
              <Metric
                label="avg file size"
                value={fmt(info.data.avg_file_size_bytes, { bytes: true })}
                accent={info.data.avg_file_size_bytes < 10_485_760 ? 'var(--amber)' : undefined}
                tooltip="Average size per live file. Files under 10 MB indicate fragmentation — run OPTIMIZE to compact them into larger files for better read performance." />
              <Metric
                label="total rows"
                value={info.data.total_rows != null ? fmt(info.data.total_rows, { rows: true }) : '—'}
                tooltip="Sum of row counts stored in file-level statistics. May be null if the table was written without row count metadata." />
              <Metric
                label="partitioned by"
                value={info.data.partition_columns?.join(', ') || 'none'}
                tooltip="Columns used to physically partition data into subdirectories. Queries filtering on these columns skip irrelevant partitions entirely." />
              {(() => {
                const f = freshnessInfo(history.data)
                return (
                  <Metric
                    label="data freshness"
                    value={f ? f.label : '—'}
                    accent={f?.accent}
                    tooltip="Time since the last data-modifying operation (WRITE, MERGE, DELETE). Green = updated today, red = not updated in over 7 days." />
                )
              })()}
            </div>
          )}

          {hasData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
              {/* Charts row — responsive */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <FileCountChart commits={history.data} currentFileCount={info.data?.num_files} />
                <OpsChart commits={history.data} />
                <FileSizeChart filesData={files.data} />
              </div>
              <HealthPanel
                health={health.data}
                loading={health.loading}
                error={health.error}
              />
              <FrequencyHeatmap commits={history.data} />
              {/* Timeline + sticky right-rail */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, alignItems: 'start' }}>
                <CommitTimeline
                  commits={history.data}
                  loading={history.loading}
                  error={history.error}
                  selectedV={selectedV}
                  onSelect={setSelectedV}
                  filter={filter}
                  onFilterChange={setFilter}
                />
                {/* Sticky: stays visible while scrolling the timeline */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 12,
                  position: 'sticky', top: 60,
                  maxHeight: 'calc(100vh - 72px)', overflowY: 'auto',
                }}>
                  <CommitDetail commits={history.data} selectedV={selectedV} />
                  <SchemaPanel
                    schema={schema.data}
                    loading={schema.loading}
                    error={schema.error}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{
            marginTop: 20, textAlign: 'center', fontSize: 11,
            color: 'var(--muted)', fontFamily: 'var(--font-sans)',
          }}>
            LakeScope · reads directly from{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>_delta_log/</span>{' '}
            via delta-rs + boto3 · no spark required
            <span style={{ marginLeft: 12, opacity: 0.5 }}>
              · press <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 4px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 3 }}>?</kbd> for shortcuts
            </span>
          </div>
        </div>
      </div>

      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
