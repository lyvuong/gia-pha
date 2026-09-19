# Gia Phả

A collaborative, cloud-synced Vietnamese family genealogy PWA. See
[`gia-pha-app-spec.md`](gia-pha-app-spec.md) for the full build spec.

## Repo layout

```
frontend/           React + Vite PWA (the actual app)
src/worker.js       Cloudflare Worker entry point — serves the built SPA (via the ASSETS
                     binding) and intercepts /join/:code for a server-rendered OG preview
firestore.rules      Firestore security rules
storage.rules         Firebase Storage security rules
firestore.indexes.json
firebase.json         Points the Firebase CLI at the two rules files above
wrangler.toml          Cloudflare Worker + static-assets config
```

## Status

The frontend is fully scaffolded and builds cleanly (`npm run build` in
`frontend/`), but **no real Firebase project is wired up yet** — this repo
ships with `frontend/.env.example` only. Until real credentials are
supplied, sign-in, real-time sync, photo uploads, and the join preview
function cannot be exercised end-to-end; the UI does render correctly in
its unauthenticated / empty-data states.

## 1. Set up Firebase

1. Create a project at the [Firebase console](https://console.firebase.google.com/).
2. **Authentication** → Sign-in method → enable **Google** and **Phone**.
3. **Firestore Database** → create a database (production mode).
4. **Storage** → create a default bucket.
5. Register a Web App in Project Settings to get your config values, then:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   and fill in `VITE_FIREBASE_*` from that config.
   Also set `VITE_GIA_PHA_ID` to the id of your family tree (the id in the
   `/tree/<id>` address once it's created). Everyone who signs in then asks to
   join **that one shared tree** and a current member approves them, instead of
   each person creating their own. Leave it empty for create-your-own-tree.
6. Deploy the security rules:
   ```bash
   npm install -g firebase-tools   # if you don't have it
   firebase login
   firebase use --add               # select your project
   firebase deploy --only firestore:rules,storage
   ```

## 2. Run locally

```bash
cd frontend
npm ci
npm run dev
```

## 3. Deploy to Cloudflare Workers & Pages

This deploys as a **Worker with static assets** (Cloudflare's current unified
model — `wrangler deploy`, not the older, separate Pages product's
`wrangler pages deploy`). `wrangler.toml`'s `[assets]` block points at
`frontend/dist`, and `src/worker.js` is the Worker entry point: it serves
the built SPA via the `ASSETS` binding (including SPA-style fallback for
client-routed paths like `/tree/:id`, via `not_found_handling`) and
intercepts `/join/:code` itself for the WhatsApp OG preview — no separate
Pages Functions directory needed.

1. Edit `wrangler.toml`: set `FIREBASE_PROJECT_ID` to your Firebase project
   id, and `APP_ORIGIN` to your Worker's public URL (e.g. your
   `*.workers.dev` subdomain, or a custom domain once attached).
2. If deploying via the Cloudflare dashboard's git integration (Workers
   Builds), set the **build command** to `cd frontend && npm ci && npm run
   build` in the project's build settings, and add the `VITE_FIREBASE_*`
   variables (and `VITE_GIA_PHA_ID`) from `frontend/.env` as **build-time environment variables**
   there (Vite bakes them into the bundle at build time, so `frontend/.env`
   alone isn't enough for the deployed build).
3. Or deploy directly from the CLI:
   ```bash
   cd frontend && npm ci && npm run build && cd ..
   npx wrangler deploy
   ```

The join-preview lookup needs no secrets — it reads the public
`inviteCodes/{code}` Firestore doc over the plain REST API, which
`firestore.rules` scopes to a `get`-only, `list`-denied public read.

## Branding / icons

`frontend/public/icons/` holds only the final, served assets (favicons, apple-touch
icons, PWA icons, and `logo-mark.png` — a transparent cutout of the crane emblem used
in-app by `<Logo />`). The high-res masters they're generated from live outside
`public/` in `frontend/icon-sources/` (`icon-source.png`, full badge on its cream card;
`icon-maskable-source.png`, the same badge scaled down onto a cream full-bleed square
for the PWA maskable-icon safe zone) — keeping them out of `public/` matters because
`vite-plugin-pwa`'s service-worker precache globs everything under `public/`, and these
masters are multi-hundred-KB each with nothing to gain from being cached client-side.
If the logo ever changes, regenerate every served size from a new master with
`System.Drawing` (PowerShell, no extra tooling needed) rather than hand-editing the
PNGs.

## Known v1 simplifications

These are intentional, called out so they're not mistaken for bugs:

- **Multiple spouses per person** (remarriage): the tree layout treats only
  the *first* entry in `spouseIds` as the primary lateral pairing used for
  x-positioning and centering children below a couple. Additional spouses
  still render a marriage line but aren't re-centered against. See
  `frontend/src/lib/treeLayout.ts`.
- **Per-story delete permission** ("only the contributor or the tree owner
  can delete a given story") is enforced in the UI
  (`StoriesList.tsx`) but not at the Firestore rules level — rules can't
  cleanly diff a single array element's authorship. Any current editor's
  write to the `stories` field is technically permitted by `firestore.rules`.
  A airtight fix needs Cloud Functions, which is explicitly out of scope
  for v1 (see spec §16).
- **One tree per user** for the "which gia phả do I land on" logic
  (`RootPage.tsx` / `useMyGiaPha`) — someone who's an editor on multiple
  trees will just land on whichever one Firestore returns first. Not
  something the spec calls for, but worth knowing if you invite one person
  into two different family trees.
- **"Last edited by" / "Told by" names**: Firebase Auth doesn't expose other
  users' display names, only the currently signed-in user's own. Each
  member's own display name (or phone number) is denormalized into
  `giaPha/{id}/editorProfiles/{uid}` on create/join so other editors' names
  can be resolved — this subcollection isn't in the original spec's data
  model but is required to satisfy spec §5's "Chỉnh sửa lần cuối bởi [tên]"
  requirement.
