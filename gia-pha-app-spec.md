# Gia Phả PWA — Build Specification

## 1. Project Overview

Build a Progressive Web App (PWA) for creating and maintaining a Vietnamese family
genealogy record ("gia phả") with a collaborative, cloud-synced family-tree diagram.
Multiple family members (invited via a shared link) can view and edit the tree from
any device, with full offline support and PDF export for printing/sharing.

## 2. Tech Stack

- **Frontend**: React + Vite, built as an installable PWA via `vite-plugin-pwa`
- **Hosting**: Cloudflare Workers & Pages (static frontend deploy via `npx wrangler deploy`)
- **Auth**: Firebase Authentication — providers: Google and Phone (SMS)
- **Database**: Firebase Firestore (real-time sync + built-in offline persistence)
- **Photo storage**: Firebase Storage (member headshot uploads)
- **Tree diagram**: `family-chart` or `react-flow` (either is acceptable — choose
  whichever gives cleaner multi-generation layout)
- **PDF export**: client-side generation via `html2canvas` + `jsPDF` (no backend needed)
- **Fonts**: Noto Sans or Inter (both have full Vietnamese diacritic support)

## 3. Authentication

Implement Firebase Auth with two sign-in providers:

1. Google (OAuth) — simplest option for relatives who already have a
   Google/Gmail account
2. Phone number (SMS verification) — this is the primary provider for less
   tech-savvy relatives, so make it the most prominent option in the sign-in UI

Assume Firebase project credentials for these providers will be supplied via
environment variables (do not hardcode secrets):
`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, etc.

## 4. Data Model (Firestore)

### Top-level collection: `giaPha` (one document per family tree)

```
giaPha/{giaPhaId}
  name: string                  // e.g. "Gia phả họ Nguyễn"
  ownerUid: string
  inviteCode: string            // used to generate join links
  createdAt: timestamp
```

### Subcollection: `giaPha/{giaPhaId}/members`

```
members/{memberId}
  fullName: string              // single free-text field, natural Vietnamese order
                                 // e.g. "Nguyễn Văn An" (Họ + Tên đệm + Tên)
  searchKey: string             // normalized, diacritic-stripped, lowercase version
                                 // of fullName, for diacritic-insensitive search
  photoUrl: string | null       // headshot image URL (Firebase Storage download URL)
  generation: number            // thế hệ
  birthDate: string | null
  deathDate: string | null
  placeOfBirth: string          // nơi sinh — free text, e.g. "Hải Phòng, Việt Nam"
  queQuan: string                // ancestral hometown — often differs from placeOfBirth,
                                 // genealogically significant in Vietnamese tradition
  parentIds: string[]           // references to other member docs
  spouseIds: string[]
  notes: string
  education: {                  // optional, học vấn
    school: string | null,      // trường học
    degree: string | null       // bằng cấp
  }[]
  occupation: string | null     // nghề nghiệp
  achievements: string[]        // thành tựu — free-text list, one entry per achievement
  stories: {                     // kỷ niệm/câu chuyện — recounted memories or tidbits
    text: string,                // the story/anecdote itself
    contributedBy: string,       // uid of the family member who added it
    contributedAt: timestamp
  }[]
  bioOverride: string | null    // manually edited bio text; if set, overrides
                                 // the auto-generated bio (see Section 8)
  lastEditedBy: string          // uid of the last person who edited this record
  lastEditedAt: timestamp
```

### Subcollection: `giaPha/{giaPhaId}/members/{memberId}` (optional, if time allows)

Do NOT build a full history log for v1 — attribution via `lastEditedBy` +
Firestore security rules is sufficient (see Section 5). Skip building an
audit-log subcollection unless explicitly asked later.

## 5. Edit Attribution (Security Rules, not Cloud Functions)

Every write to a `members/{memberId}` document MUST include `lastEditedBy`
set to the authenticated user's own uid — the client cannot spoof another
user's ID. Enforce this in `firestore.rules`:

```
match /giaPha/{giaPhaId}/members/{memberId} {
  allow read: if request.auth != null && isMember(giaPhaId, request.auth.uid);
  allow write: if request.auth != null
               && isMember(giaPhaId, request.auth.uid)
               && request.resource.data.lastEditedBy == request.auth.uid;
}
```

Where `isMember(giaPhaId, uid)` checks the user's uid is present in the
`giaPha/{giaPhaId}` document's members/editors list (see Section 6).

In the UI, display "Chỉnh sửa lần cuối bởi [tên] · [ngày]" (Last edited by
[name] on [date]) under each person's detail view, resolved from
`lastEditedBy` + `lastEditedAt`.

## 6. Access Control & Invite Links

All invited members get **full edit access** (no separate viewer/editor tiers
needed for v1). Access is controlled per gia phả tree via an `editors` array
stored on the `giaPha/{giaPhaId}` document:

```
giaPha/{giaPhaId}
  editors: string[]   // list of uids allowed to read/write this tree
```

**Invite flow:**
1. Owner generates a shareable link: `https://<app-domain>/join/{inviteCode}`
2. Owner pastes this link into the family WhatsApp group manually (no WhatsApp
   API integration — WhatsApp does not expose group member lists to third
   party apps, so there is no way to "import" the group programmatically)
3. When a relative opens the link, show a "Join [gia phả name]?" page
4. They sign in (Google or Phone)
5. On successful sign-in, add their uid to the `editors` array of that
   `giaPha` document
6. Redirect them into the tree, now with full edit access

**WhatsApp link preview — requires server-side rendered meta tags:**

WhatsApp's link-preview crawler does NOT execute JavaScript — it only reads
the raw HTML response. Since the app is a client-rendered Vite SPA, meta
tags set by React after the page loads will never be seen by WhatsApp,
resulting in a blank/broken preview. This must be handled server-side:

1. Add a Cloudflare Pages Function at `functions/join/[code].js` that
   intercepts requests to `/join/:code` *before* they fall through to the
   static SPA
2. In that function, fetch the gia phả's name from Firestore using the
   `inviteCode`, then return a small server-rendered HTML page containing
   the correct Open Graph tags plus a `<meta http-equiv="refresh">` (or a
   tiny inline script) that immediately forwards real browsers into the
   SPA's client-side route:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tham gia [Tên gia phả] — Gia Phả App</title>
  <meta property="og:title" content="Tham gia [Tên gia phả]">
  <meta property="og:description" content="Cùng nhau xây dựng cây gia phả gia đình">
  <meta property="og:image" content="https://<app-domain>/icons/icon-512x512.png">
  <meta property="og:url" content="https://<app-domain>/join/[code]">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta http-equiv="refresh" content="0; url=/join/[code]?app=1">
</head>
<body>Đang chuyển hướng...</body>
</html>
```

3. Use a distinct query param (e.g. `?app=1`) or a separate internal route
   so the SPA's actual `/join/:code` client-side handler knows this is the
   "real" visit vs. the crawler-facing HTML, avoiding a redirect loop
4. `og:image` must be an absolute URL (not relative), at least 200×200px —
   reuse `icon-512x512.png` from the generated icon set unless a dedicated
   preview image is preferred later
5. Test the preview before relying on it: paste the link into WhatsApp on a
   phone (desktop WhatsApp Web sometimes caches old previews), or use
   Facebook's Sharing Debugger tool, since WhatsApp uses the same
   Open Graph crawler infrastructure as Facebook

## 7. Headshot Photos

Each member can optionally have a headshot photo, stored in Firebase Storage
and referenced by `photoUrl` on the member document.

**Upload flow:**
1. In the member edit form, add a photo upload control (file picker +
   camera capture on mobile via `<input type="file" accept="image/*" capture="user">`)
2. Before uploading, resize/compress the image client-side (e.g. with a
   canvas-based resize to ~512px on the long edge, JPEG quality ~0.8) to
   keep file sizes small — important for family members on slow mobile
   connections
3. Upload to Firebase Storage at path `giaPha/{giaPhaId}/members/{memberId}/photo.jpg`
4. On successful upload, get the download URL and save it to the member's
   `photoUrl` field in Firestore

**Storage security rules** (`storage.rules`) — mirror the same access check
used for Firestore, so only invited editors of a given gia phả can upload:

```
match /giaPha/{giaPhaId}/members/{memberId}/{fileName} {
  allow read: if true; // photos can be public-readable via their URL
  allow write: if request.auth != null
               && isMember(giaPhaId, request.auth.uid)
               && request.resource.size < 5 * 1024 * 1024 // 5MB cap
               && request.resource.contentType.matches('image/.*');
}
```

**Display:**
- Show the headshot as a circular thumbnail on each tree diagram node
  (fall back to a simple placeholder avatar — e.g. initials on a colored
  circle — when `photoUrl` is null)
- Include the headshot in the member detail panel and in the PDF export's
  generational listing

## 8. Auto-Generated Bio

The optional fields (`education`, `occupation`, `achievements`, plus
existing fields like `placeOfBirth`, `queQuan`, `birthDate`/`deathDate`)
feed into a short auto-generated biography paragraph shown on each
member's detail panel and in the PDF export — so families don't have to
hand-write a bio for every person, but can if they want to override it.

**v1 approach — template-based, no external API needed:**

Assemble a paragraph from whichever fields are filled in, skipping any
that are empty. Example template logic:

```js
function generateBio(member) {
  const parts = [];
  if (member.birthDate) parts.push(`Sinh năm ${yearOf(member.birthDate)}`);
  if (member.placeOfBirth) parts.push(`tại ${member.placeOfBirth}`);
  if (member.education?.length) {
    const edu = member.education
      .map(e => [e.degree, e.school].filter(Boolean).join(' tại '))
      .join(', ');
    parts.push(`Học vấn: ${edu}`);
  }
  if (member.occupation) parts.push(`Nghề nghiệp: ${member.occupation}`);
  if (member.achievements?.length) {
    parts.push(`Thành tựu: ${member.achievements.join('; ')}`);
  }
  if (member.deathDate) parts.push(`Mất năm ${yearOf(member.deathDate)}`);
  return parts.join('. ') + '.';
}
```

This runs entirely client-side, requires no API calls, and regenerates
instantly whenever a field changes.

**Optional v2 enhancement (not required for v1):** instead of the
template above, send the same structured fields to an LLM API (e.g. the
Anthropic API) with a prompt asking it to write a natural, warm paragraph
in Vietnamese from the given facts, rather than a mechanically assembled
one. This needs a small backend endpoint (e.g. a Cloudflare Pages
Function) to hold the API key server-side — do not call an LLM API
directly from client-side code, since that would expose the key. Treat
this as a nice-to-have; the template-based version already satisfies the
"generate a bio" requirement for launch.

**Editability:** always let the user manually edit/override the generated
bio text and save their edit as `bioOverride` on the member document —
if `bioOverride` is set, display that instead of regenerating from the
template.

**Note:** `stories` (Section 9) are intentionally NOT folded into the
auto-generated bio paragraph — they're personal anecdotes rather than
structured facts, so they're shown as their own list on the detail panel
instead of being mechanically stitched into a sentence.

## 9. Family Stories / Memories

Unlike the structured fields above, `stories` capture the kind of thing
someone remembers and wants to write down before it's forgotten — an
anecdote, a habit, a saying the person was known for, something a relative
heard secondhand. Since these often come from someone other than whoever
is maintaining that person's main record, each story is attributed to
whoever added it, not folded into a single shared text field.

**Behavior:**
- Any invited editor can add a new story to any member — this is additive,
  not an edit to a shared field, so it doesn't overwrite anyone else's
  contribution (unlike the rest of the member document, per Section 5,
  this doesn't need a "last edited by" model since each entry is its own
  attributed item, not a value being overwritten)
- Display stories as a simple list on the member detail panel, e.g. "Kỷ
  niệm & câu chuyện", each shown with the contributor's name and date
  ("Kể bởi [tên] · [ngày]"), newest first
- No character limit is enforced, but a placeholder like "Chia sẻ một kỷ
  niệm hoặc câu chuyện về [tên]..." encourages short, specific anecdotes
  over long essays
- Include stories in the PDF export as a subsection under each member's
  entry, so they're preserved in the printed/shared document too
- Deleting a story: allow only the original contributor or the gia phả
  owner to delete a given story entry — other editors can add their own
  but shouldn't be able to remove someone else's contribution

## 10. Google Maps Links for Place Fields

Both `placeOfBirth` and `queQuan` are free-text fields (Section 4), so no
geocoding/lat-lng lookup is needed — Google Maps can resolve a plain text
search query directly.

**Implementation:**
- Build a small reusable component, e.g. `<PlaceLink text={member.placeOfBirth} />`,
  that renders the place text with a map-pin icon next to it
- The pin links to: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
  — this opens Google Maps (app on mobile via deep link, web on desktop) with
  a search for that exact text, no API key or geocoding call required
- Apply this component wherever a place is shown: the member detail panel
  (both `placeOfBirth` and `queQuan`), and any tooltip/preview on tree nodes
  that surfaces birthplace
- Open the link in a new tab (`target="_blank" rel="noopener noreferrer"`)
  so it doesn't navigate away from the tree/app state
- In the PDF export (Section 13), include the place text as a clickable
  link using the same Google Maps search URL — `jsPDF`'s `textWithLink()`
  method supports this directly, so the printed/exported document stays
  interactive when opened as a PDF

**Note:** if a place field is empty, don't render the pin/link — only show
it when there's actual text to search for.

## 11. Vietnamese Language Support

- **Name field**: single free-text `fullName` field — do NOT split into
  firstName/lastName. Vietnamese names follow Họ + Tên đệm + Tên order and
  are addressed by given name, not family name.
- **Sorting**: use locale-aware collation, not plain string sort:
  ```js
  const collator = new Intl.Collator('vi');
  members.sort((a, b) => collator.compare(a.fullName, b.fullName));
  ```
- **Diacritic-insensitive search**: maintain a `searchKey` field (see data
  model above) generated with this normalization function, applied whenever
  a member is created or their name is edited:
  ```js
  function normalizeVietnamese(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase();
  }
  ```
  Search UI should normalize the user's query the same way and match against
  `searchKey`.
- **Fonts**: use Noto Sans or Inter site-wide — both fully support Vietnamese
  diacritic stacking (e.g. ệ, ữ, ẫ). Avoid decorative/display fonts without
  verified Vietnamese glyph coverage.
- **UI text**: default the interface to English, with a language toggle
  (e.g. in a settings menu or header) that switches all UI labels to
  Vietnamese ("Thêm thành viên", "Chỉnh sửa", "Xem cây gia phả", etc.).
  Use a standard i18n library (e.g. `react-i18next`) with two locale files
  (`en.json`, `vi.json`) so both languages are easy to maintain and extend
  later. Persist the chosen language (e.g. in localStorage) so it's
  remembered across sessions per device.

## 12. Family Tree Diagram

- Render an interactive, pannable/zoomable multi-generation tree using
  `family-chart` or `react-flow`
- Bind the diagram directly to a Firestore real-time listener on the
  `members` subcollection, so edits from any device appear live for
  everyone currently viewing the tree
- Each node should show: `fullName`, birth–death years (if death date
  exists), and generation number
- Clicking a node opens a detail panel with full info (place of birth, quê
  quán, notes, last-edited attribution) and an edit form

## 13. PDF Export

- Client-side only, no backend/server rendering needed
- Use `html2canvas` to snapshot the rendered tree diagram, then `jsPDF` to
  assemble a document containing:
  1. Cover page (gia phả name, generated date)
  2. The visual tree diagram
  3. A generational listing (all members grouped by `generation`, sorted
     using the Vietnamese collator from Section 11)
- Trigger via an "Xuất PDF" (Export PDF) button in the UI

## 14. PWA Requirements

- Use `vite-plugin-pwa` to generate a service worker and web app manifest
- App must be installable (Add to Home Screen) on both mobile and desktop
- Firestore's built-in offline persistence should be enabled so the app is
  usable offline; queued writes sync automatically when connectivity returns
- Manifest should include a Vietnamese-appropriate app name (e.g. "Gia Phả")
  and an icon set at standard PWA sizes (192x192, 512x512, maskable variant)

## 15. Deployment

- Frontend deploys to Cloudflare Workers & Pages via `npx wrangler deploy`
  (already configured build pipeline: `cd frontend && npm ci && npm run build`)
- Firebase (Auth + Firestore) is configured entirely from the Firebase
  console/CLI — no server component runs on Cloudflare; it only serves
  the static PWA build

## 16. Explicit Non-Goals for v1

To keep scope tight, do NOT build these unless later requested:
- Cloud Functions / server-enforced audit log (client + security-rules
  attribution is sufficient per Section 5)
- Separate viewer-only vs editor roles (all invited members get full edit
  access for v1)
- WhatsApp API integration of any kind (link-sharing is manual, by design)
- Structured address parsing for place of birth (keep it free text, plus
  the separate `queQuan` field)
- LLM-API-powered bio generation (template-based bio assembly per Section 8
  is sufficient for v1; the LLM enhancement is optional future work)
