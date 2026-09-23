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
//
// Previews are localized by a `?lang=en|vi` query param: the crawler can't tell us the sharer's
// language, so the app keeps it in the address bar and the links it shares. Without one: English.

const PREVIEW_TEXT = {
  vi: {
    siteTitle: 'Gia Phả',
    siteDescription: 'Sổ gia phả gia đình — cây phả hệ và lịch sử dòng họ',
    joinTitle: (name) => `Tham gia ${name}`,
    joinDescription: 'Cùng nhau xây dựng cây gia phả gia đình',
    redirecting: 'Đang chuyển hướng...',
  },
  en: {
    siteTitle: 'Family Tree',
    siteDescription: 'Family genealogy book — family tree and lineage history',
    joinTitle: (name) => `Join ${name}`,
    joinDescription: 'Build the family tree together',
    redirecting: 'Redirecting...',
  },
}

function previewLang(url) {
  return url.searchParams.get('lang') === 'vi' ? 'vi' : 'en'
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function handleJoinPreview(code, lang, env) {
  const text = PREVIEW_TEXT[lang]
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
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${text.joinTitle(safeName)} — ${text.siteTitle}</title>
  <meta property="og:title" content="${text.joinTitle(safeName)}">
  <meta property="og:description" content="${text.joinDescription}">
  <meta property="og:image" content="${appOrigin}/icons/icon-512x512.png">
  <meta property="og:url" content="${appOrigin}/join/${safeCode}?lang=${lang}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta http-equiv="refresh" content="0; url=/join/${safeCode}?app=1&amp;lang=${lang}">
</head>
<body>${text.redirecting}</body>
</html>`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const joinMatch = url.pathname.match(/^\/join\/([^/]+)$/)

    const lang = previewLang(url)

    if (joinMatch && url.searchParams.get('app') !== '1') {
      const html = await handleJoinPreview(decodeURIComponent(joinMatch[1]), lang, env)
      if (html) {
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
      }
    }

    const response = await env.ASSETS.fetch(request)
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response

    // The SPA shell's preview tags are Vietnamese with a relative og:image (crawlers need it
    // absolute); fix both up for whoever is previewing this link.
    const text = PREVIEW_TEXT[lang]
    return new HTMLRewriter()
      .on('html', { element: (el) => el.setAttribute('lang', lang) })
      .on('title', { element: (el) => el.setInnerContent(text.siteTitle) })
      .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', text.siteTitle) })
      .on('meta[name="description"], meta[property="og:description"]', {
        element: (el) => el.setAttribute('content', text.siteDescription),
      })
      .on('meta[property="og:image"]', { element: (el) => el.setAttribute('content', `${url.origin}/icons/icon-512x512.png`) })
      .transform(response)
  },
}
