// Cloudflare Pages Function: intercepts /join/:code so WhatsApp's link-preview
// crawler (which doesn't execute JS) sees server-rendered Open Graph tags,
// then bounces real browsers into the client-rendered SPA route.
//
// Looks up the invite via the narrow `inviteCodes/{code}` Firestore doc
// (id = code, fields: { giaPhaId, name }) using a plain unauthenticated
// REST call — no service-account secret needed, see firestore.rules for the
// public-`get`-only rule that authorizes this specific narrow read.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function onRequest(context) {
  const { request, params, env } = context
  const url = new URL(request.url)
  const code = params.code

  // Second hop: the refresh below already bounced a real browser here once;
  // fall through to the static SPA so it doesn't get stuck in a redirect loop.
  if (url.searchParams.get('app') === '1') {
    return context.next()
  }

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
    // Firestore lookup failed — fall through to the SPA, whose /join/:code
    // route will show its own "invite not found" state.
  }

  if (!name) {
    return context.next()
  }

  const safeName = escapeHtml(name)
  const safeCode = encodeURIComponent(code)

  const html = `<!doctype html>
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

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
