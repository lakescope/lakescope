import React, { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'
import { s, Spinner, opStyle } from './ui.jsx'

export function FileCountChart({ commits, currentFileCount }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!commits || !ref.current) return
    if (chartRef.current) chartRef.current.destroy()

    // Walk backwards from current real count to reconstruct file count at each version
    const ordered = [...commits] // newest first
    const anchor = currentFileCount ?? 0
    let running = anchor
    const reverseCounts = ordered.map(c => {
      const count = running
      running -= (c.num_added_files || 0) - (c.num_removed_files || 0)
      return Math.max(0, count)
    })
    const counts = reverseCounts.reverse()
    const labels = [...ordered].reverse().map(c => `v${c.version}`)

    chartRef.current = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'live files',
          data: counts,
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45,212,191,0.06)',
          tension: 0.3, fill: true, pointRadius: 2, borderWidth: 1.5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { font: { size: 10 }, color: '#666', autoSkip: true, maxTicksLimit: 10 },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            ticks: { font: { size: 10 }, color: '#666' },
            grid: { color: 'rgba(255,255,255,0.04)' },
          }
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [commits])

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>◈ file count over versions</div>
      <div style={{ position: 'relative', height: 160 }}>
        <canvas ref={ref} role="img" aria-label="Live file count per version">File count chart.</canvas>
      </div>
    </div>
  )
}

export function OpsChart({ commits }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  const ops = {}
  if (commits) {
    for (const c of commits) {
      const op = c.operation || 'UNKNOWN'
      ops[op] = (ops[op] || 0) + 1
    }
  }
  const labels = Object.keys(ops)
  const values = Object.values(ops)
  const colors = labels.map(l => opStyle(l).color)

  useEffect(() => {
    if (!commits || !ref.current) return
    if (chartRef.current) chartRef.current.destroy()
    chartRef.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors.map(c => c + '99'), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: { legend: { display: false } },
      }
    })
    return () => chartRef.current?.destroy()
  }, [commits])

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>◈ operations breakdown</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', height: 120, width: 120, flexShrink: 0 }}>
          <canvas ref={ref} role="img" aria-label="Operations breakdown">Operations.</canvas>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {labels.map((l, i) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
                <span style={{ color: 'var(--muted2)', fontFamily: 'var(--font-sans)' }}>{l.toLowerCase()}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 500 }}>{values[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FileSizeChart({ filesData }) {
  const buckets = filesData?.size_buckets || {}
  const entries = [
    { label: '< 1 MB', key: '<1MB', warn: true },
    { label: '1–10 MB', key: '1-10MB', warn: true },
    { label: '10–64 MB', key: '10-64MB' },
    { label: '64–128 MB', key: '64-128MB', good: true },
    { label: '> 128 MB', key: '>128MB', good: true },
  ]
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1
  const smallPct = Math.round(((buckets['<1MB'] || 0) + (buckets['1-10MB'] || 0)) / total * 100)

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>◈ file size distribution</div>
      {entries.map(e => {
        const count = buckets[e.key] || 0
        const pct = total ? Math.round(count / total * 100) : 0
        const color = e.good ? 'var(--green)' : e.warn ? 'var(--amber)' : 'var(--teal)'
        return (
          <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 72, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>{e.label}</div>
            <div style={{ flex: 1, height: 7, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
            <div style={{ width: 28, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{pct}%</div>
          </div>
        )
      })}
      {smallPct > 30 && (
        <div style={{
          marginTop: 8, fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-sans)',
          background: 'var(--amber-dim)', borderRadius: 'var(--radius)', padding: '6px 10px',
        }}>
          ⚠ {smallPct}% of files below 10 MB — consider running OPTIMIZE
        </div>
      )}
    </div>
  )
}
