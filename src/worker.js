// Worker entry point (Cloudflare's unified Workers & Pages deploy model — see wrangler.toml's
// [assets] block). This replaces what used to be a Cloudflare Pages Function: that file-based
// `functions/` convention only exists in the older, separate Pages product and isn't invoked
// when a project is deployed as a Worker with a static-assets binding, which is what
// `wrangler deploy` does. Everything except the /join/:code interception below is served
// straight from the built SPA via the ASSETS binding (including its own client-side SPA
// fallback for routes like /tree/:id, configured via not_found_handling in wrangler.toml).
//
// The interception itself: WhatsApp's link-preview crawler doesn't execute JS, so it needs
// server-rendered Open Graph tags for /join/:code — looked up via the narrow, publicly
// `get`-only `inviteCodes/{code}` Firestore doc (id = code, fields: { giaPhaId, name }), see
// firestore.rules. Real browsers get bounced once through this HTML (via a meta refresh) and
// land back here with `?app=1`, at which point we fall through to the SPA.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function handleJoinPreview(code, env) {
  const projectId = env.FIREBASE_PROJECT_ID
  const appOrigin = env.APP_ORIGIN

  let name = null
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inviteCodes/${encodeURIComponent(code)}`,
    )
    if (res.ok) {
      const doc = await res.json()
      name = doc.fields?.name?.stringValue ?? null
    }
  } catch {
    // Firestore lookup failed — caller falls through to the SPA, whose /join/:code
    // route will show its own "invite not found" state.
  }

  if (!name) return null

  const safeName = escapeHtml(name)
  const safeCode = encodeURIComponent(code)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tham gia ${safeName} — Gia Phả App</title>
  <meta property="og:title" content="Tham gia ${safeName}">
  <meta property="og:description" content="Cùng nhau xây dựng cây gia phả gia đình">
  <meta property="og:image" content="${appOrigin}/icons/icon-512x512.png">
  <meta property="og:url" content="${appOrigin}/join/${safeCode}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta http-equiv="refresh" content="0; url=/join/${safeCode}?app=1">
</head>
<body>Đang chuyển hướng...</body>
</html>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const joinMatch = url.pathname.match(/^\/join\/([^/]+)$/)

    if (joinMatch && url.searchParams.get('app') !== '1') {
      const html = await handleJoinPreview(decodeURIComponent(joinMatch[1]), env)
      if (html) {
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
