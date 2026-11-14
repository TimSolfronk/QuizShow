async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // no JSON body -> keep statusText
    }
    throw new Error(detail)
  }
  return res.json()
}

export function getGame() {
  return fetch('/api/game').then(handle)
}

export function postJSON(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then(handle)
}
