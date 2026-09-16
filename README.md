# Gia Phả

A collaborative, cloud-synced Vietnamese family genealogy PWA. See
[`gia-pha-app-spec.md`](gia-pha-app-spec.md) for the full build spec.

## Repo layout

```
frontend/           React + Vite PWA (the actual app)
functions/join/     Cloudflare Pages Function — server-rendered OG preview for /join/:code
firestore.rules      Firestore security rules
storage.rules         Firebase Storage security rules
firestore.indexes.json
firebase.json         Points the Firebase CLI at the two rules files above
wrangler.toml          Cloudflare Pages project config
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

## 3. Deploy to Cloudflare Pages

1. Edit `wrangler.toml`: set `FIREBASE_PROJECT_ID` to your Firebase project
   id, and `APP_ORIGIN` to your Pages domain.
2. In the Cloudflare Pages project settings, add the same `VITE_FIREBASE_*`
   variables from `frontend/.env` as **build-time environment variables**
   (Vite bakes them into the bundle at build time, so `frontend/.env` alone
   isn't enough for the deployed build).
3. Build command: `cd frontend && npm ci && npm run build`. Build output
   directory: `frontend/dist`.
4. Deploy:
   ```bash
   npx wrangler deploy
   ```

The `functions/join/[code].js` Pages Function needs no secrets — it reads
the public `inviteCodes/{code}` Firestore doc over the plain REST API,
which `firestore.rules` scopes to a `get`-only, `list`-denied public read.

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
