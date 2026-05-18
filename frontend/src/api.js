const BASE = '/api'

async function get(endpoint, params = {}, timeoutMs = 120_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  const query = new URLSearchParams(filtered).toString()
  const url = BASE + endpoint + (query ? '?' + query : '')
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${res.status}: ${text}`)
    }
    return res.json()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  info:    (path) => get('/info', { path }),
  history: (path, limit = 200) => get('/history', { path, limit }),
  schema:  (path) => get('/schema', { path }),
  files:   (path) => get('/files', { path }),
  health:  (path) => get('/health', { path }),
}
