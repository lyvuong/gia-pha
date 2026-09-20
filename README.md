# Gia Phả

A shared, cloud-synced **Vietnamese family genealogy** app (*gia phả*) for a whole extended
family. Relatives sign in, see one common family tree, and add people, photos, dates and
stories together. It installs like an app on phones and desktops (PWA), works offline, and
speaks both Vietnamese and English.

It is built with React and Firebase, and hosted as a Cloudflare Worker. Everything you need to
run your own copy is in this repository; see [Host your own](#host-your-own).

> Developed with [Claude Code](https://claude.com/claude-code) working alongside the developer.
> The original build specification is in [`gia-pha-app-spec.md`](gia-pha-app-spec.md).

## Contents

- [Features](#features)
- [How access works](#how-access-works)
- [Tech stack](#tech-stack)
- [Repo layout](#repo-layout)
- [Host your own](#host-your-own)
- [Local development](#local-development)
- [Versioning and updates](#versioning-and-updates)
- [Data model](#data-model)
- [Branding / icons](#branding--icons)
- [Known limitations](#known-limitations)

## Features

### The family tree

- **One shared tree** that every member sees and edits in real time. Changes made by one
  person appear on everyone else's screen straight away.
- **Interactive diagram**: drag to pan, scroll or pinch to zoom, click a person for details.
  Couples, remarriages (several spouses stacked beside the person) and sibling groups are laid
  out automatically, with generation rows labelled from the oldest generation as 1.
- **Eight chart views** from any person: the full tree, **pedigree** (ancestors), **descendants**,
  **family group**, **fan chart**, **hourglass**, **extended family** (with an adjustable number
  of generations up) and **kinship**. Each view has an "About this chart" panel explaining what
  it shows and leaves out.
- **Kinship finder**: pick two people and it works out how they are related, naming the closest
  common ancestor and the number of generations to each. In Vietnamese it uses the proper terms
  (*bác, chú, cô, dì, cậu, cháu nội*…).
- **Search** by name, ignoring case and Vietnamese diacritics (typing "nguyen" finds "Nguyễn").

### People and profiles

- **Full names** kept as one free-text field, in Vietnamese order (họ, tên đệm, tên), with any
  number of **other names**: birth name, maiden name, also known as, nickname, dharma name
  (*pháp danh*).
- **Dates**: date of birth, and a **date of death that may be lunar and may omit the year**,
  since death anniversaries (*ngày giỗ*) are kept on the lunar calendar.
- **Places** (place of birth and ancestral hometown, *quê quán*) link to Google Maps.
- **Relationships**: parents, spouses, and a manual **sibling / spouse order** when birth dates
  are missing. An **Add relative** flow adds a parent, spouse, child or sibling of the person
  you are looking at and fills in the relationship and generation for you.
- **Education, occupation, achievements and notes.**
- **Photos**: a headshot per person (images up to 5 MB).
- **Biography**: written automatically from the fields above, or replaced with your own text.
  Custom biographies support **Markdown** and can be loaded from a `.md` file.
- **Family stories**: any member can add stories or memories about a person, each credited to
  the person who told it.
- **Edit attribution**: every profile shows who last edited it and when, by name.
- **Trash**: deleting someone moves them to the **Trash** (in your account menu). Restore them,
  or delete them permanently.
- **Generation numbers are automatic**, worked out from relationships, so there is nothing to
  keep in sync by hand.

### Joining and inviting relatives

- **Invite link**: copy it from your account menu and share it (a WhatsApp link preview shows
  the tree's name). It leads to sign-in and then to a short request form.
- **Access requests**: a newcomer says who they are, where they live and how they are related.
  Any member can **approve** or **decline** from the **Requests** button; someone declined can
  correct their details and ask again.
- **Invite by phone** (account menu): list the phone numbers of relatives you know. Anyone who
  signs in with a listed number joins **immediately, with no approval step**, and their entry is
  removed once they are in. Add numbers one at a time, or **paste a whole list at once**
  (for example from a WhatsApp group), one person per line such as `Aunt Lan, +84 912 345 678`.
- **Phone numbers**: numbers without a country code are treated as **US/Canada (+1)**. Every
  other country needs its code (`+84 912 345 678`).
- **My profile**: after joining, a person says which tree entry is them: pick themselves from
  the tree (a Google sign-in whose name matches is suggested) or enter their full name to be
  added. From then on they are shown by that name instead of a phone number, and they can open
  their profile from the account menu. One Google and one phone account may claim the same
  person, but two accounts of the same kind may not.

### Using it every day

- **Sign in** with **Google** or a **phone number** (SMS code).
- **Vietnamese and English** interface, switched with the language button; **light and dark**
  themes, remembering your choice (or following your device).
- **PDF export**: a cover page, the tree diagram, and a listing of people by generation, with
  Vietnamese text rendered correctly.
- **Installable and offline-friendly**: add it to your home screen; recently viewed data stays
  available without a connection, and edits made offline sync when you reconnect.
- **About page and footer**: version, build date and commit, developer, brief instructions, and
  a **check for updates / install** button (see [Versioning](#versioning-and-updates)).

## How access works

There is **one shared tree**. Its id is baked into the app at build time (`VITE_GIA_PHA_ID`).
Anyone can sign in, but nobody can see the tree until they are a member.

| Way in | What happens |
| --- | --- |
| Phone number a member has listed | Joins at once (Firestore rules verify the phone number). |
| Invite link, or simply opening the app | Fills in a request; a member approves it. |
| The first person | Creates the tree (see [step 5](#5-create-the-tree)). |

All members are equals: any member can edit any profile, approve requests, manage the phone
list and use Trash. The tree has an `ownerUid` recorded (the person who created it), but it
carries no extra powers today. Everything is enforced in [`firestore.rules`](firestore.rules)
and [`storage.rules`](storage.rules), not just in the interface: a non-member cannot read or write
the tree, and the only thing a non-member can ever write is their own join request, or, if
their verified phone number is on the list, adding themselves.

## Tech stack

- **React 19 + TypeScript + Vite**, with `react-router` and `react-i18next`
- **React Flow** (`@xyflow/react`) for the diagram
- **Firebase**: Authentication (Google, Phone), Cloud Firestore, Cloud Storage
- **`vite-plugin-pwa`** for the service worker and manifest
- **jsPDF + html2canvas** for PDF export
- **Cloudflare Workers** with static assets for hosting, plus one small Worker script for
  invite-link previews

## Repo layout

```
frontend/             React + Vite PWA (the app itself)
  src/pages/          Login, tree, join/request access, about
  src/components/     Tree diagram, member panels, common UI
  src/hooks/          Firestore data hooks (members, requests, phones, profiles)
  src/lib/            Layout, kinship, phone parsing, PDF, versioning
  src/i18n/           en.json and vi.json
  scripts/            bump-version.mjs
src/worker.js         Cloudflare Worker: serves the app and renders invite-link previews
firestore.rules       Firestore security rules
storage.rules         Storage security rules
firestore.indexes.json, firebase.json, .firebaserc   Firebase CLI config
wrangler.toml         Cloudflare Worker + static-assets config
.githooks/            Pre-commit hook that bumps the version
```

## Host your own

You need a free [Firebase](https://firebase.google.com/) project, a free
[Cloudflare](https://www.cloudflare.com/) account, and [Node.js](https://nodejs.org/) 20.19
or newer (or 22+). Firebase's free tier is plenty for a family tree. Phone sign-in sends SMS messages,
which Firebase may require a paid plan for depending on volume and region; check current
Firebase pricing, or offer Google sign-in only.

### 1. Get the code

```bash
git clone https://github.com/lyvuong/gia-pha.git
cd gia-pha
git config core.hooksPath .githooks   # optional: version bump on every commit
cd frontend && npm ci && cd ..
```

### 2. Create the Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. **Authentication** → Sign-in method → enable **Google** and **Phone**.
3. **Firestore Database** → create a database in production mode.
4. **Storage** → create the default bucket.
5. **Project settings** → add a **Web app** and copy its config values.
6. **Authentication** → Settings → **Authorized domains**: add the domain you will host on
   (your `*.workers.dev` address or custom domain). `localhost` is already allowed.

### 3. Configure the app

```bash
cp frontend/.env.example frontend/.env
```

Fill in the `VITE_FIREBASE_*` values from step 2.5. Leave `VITE_GIA_PHA_ID` empty for now.

Edit the two Firebase files that name the project: put your project id in `.firebaserc`, and
in `wrangler.toml` set `FIREBASE_PROJECT_ID` to the same id.

### 4. Deploy the security rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add                         # choose your project
firebase deploy --only firestore:rules,storage
```

The Storage rules read Firestore to check membership, so the CLI may ask permission to grant
Storage access to Firestore; say yes. **Do not skip this step**: without the rules your data
is not protected the way this README describes.

### 5. Create the tree

1. Run the app locally (`cd frontend && npm run dev`) and sign in.
2. With `VITE_GIA_PHA_ID` empty, you are offered **Create your gia phả**. Name it.
3. Look at the address: `/tree/<id>`. That `<id>` is your tree's id.
4. Put it in `frontend/.env` as `VITE_GIA_PHA_ID=<id>` and restart. From now on everyone else
   who signs in is asked to request access to this tree instead of making their own.

### 6. Deploy to Cloudflare

The app deploys as a **Worker with static assets** (`wrangler deploy`). `wrangler.toml` points
`[assets]` at `frontend/dist`, and `src/worker.js` serves the app and adds server-rendered
link previews for `/join/<code>`.

In `wrangler.toml`, set `name`, `FIREBASE_PROJECT_ID`, and `APP_ORIGIN` (your Worker's public
URL, for example `https://gia-pha.your-subdomain.workers.dev`, or your custom domain).

**Option A: from your computer**

```bash
cd frontend && npm ci && npm run build && cd ..
npx wrangler login
npx wrangler deploy
```

**Option B: from Git (Cloudflare Workers Builds)**

Connect the repository in the Cloudflare dashboard and set:

- **Build command**: `cd frontend && npm ci && npm run build`
- **Deploy command**: `npx wrangler deploy`
- **Build environment variables**: every `VITE_FIREBASE_*` value and `VITE_GIA_PHA_ID`.
  Vite bakes these into the bundle at build time, so `frontend/.env` alone is not enough for a
  build that runs in Cloudflare.

Every push then redeploys. The build is stamped with the commit, which is how the in-app
update check knows a newer version exists.

The invite-link preview needs no secrets. It reads a small public document
(`inviteCodes/{code}`, get-only, not listable) over Firestore's REST API to show the tree's name.

### 7. Add the first relatives

Open the app, then use the account menu (top right):

- **Copy invite link** and send it, or
- **Invite by phone** and paste the numbers of relatives you know so they can join without
  waiting for approval.

Approve anyone else from the **Requests** button.

### Other hosting

The `frontend/dist` folder is a static site and will run on any static host (Firebase Hosting,
Netlify, GitHub Pages…) if you route every path to `index.html`. You would lose the WhatsApp
link preview, which needs `src/worker.js`, and you would need to add your domain to Firebase's
authorized domains.

## Local development

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into frontend/dist
npm run lint       # oxlint
npm run preview    # serve the production build
```

Without a `frontend/.env` the app still starts, using placeholder Firebase values, but sign-in
and data will not work.

## Versioning and updates

- Every commit bumps the minor version in `frontend/package.json` (1.4.0 → 1.5.0) through the
  tracked hook in `.githooks/pre-commit`. After cloning, enable it once with
  `git config core.hooksPath .githooks`.
- The build stamps the version, date and git commit into the app (`vite.config.ts`) and writes
  `dist/version.json`. The footer and the About page (`/about`) show them.
- The app fetches `/version.json` (bypassing caches) to tell whether a newer build is deployed:
  the footer shows **Update available**, and the About page has a **Check for updates** /
  **Install** button that clears the service worker and caches and reloads.

## Data model

Firestore, all under one document per tree. Details are enforced by `firestore.rules`.

```
giaPha/{treeId}                      name, ownerUid, inviteCode, editors[], createdAt
  members/{memberId}                 a person: names, gender, dates, places, parentIds[],
                                     spouseIds[], siblingOrder, education, occupation,
                                     achievements, stories[], bioOverride, photoUrl,
                                     generation, lastEditedBy/At, deletedAt (Trash)
  joinRequests/{uid}                 someone asking to join (details, status)
  allowedPhones/{+E.164 number}      relatives who may join without approval
  editorProfiles/{uid}               display name, linked memberId, sign-in kind
inviteCodes/{code}                   { giaPhaId, name }: public get-only, for link previews
```

Photos are stored in Storage at `giaPha/{treeId}/members/{memberId}/…`, readable by URL, and
writable only by members.

## Branding / icons

`frontend/public/icons/` holds only the final, served assets (favicons, apple-touch icons, PWA
icons, and `logo-mark.png`, a transparent cutout of the crane emblem used in-app by `<Logo />`).
The high-resolution masters they are generated from live outside `public/`, in
`frontend/icon-sources/` (`icon-source.png`, the full badge on its cream card;
`icon-maskable-source.png`, the same badge scaled onto a cream full-bleed square for the PWA
maskable-icon safe zone). Keeping them out of `public/` matters because `vite-plugin-pwa`'s
precache globs everything under `public/`, and these masters are large. If the logo changes,
regenerate every served size from a new master (PowerShell's `System.Drawing` works, with no
extra tooling) rather than hand-editing the PNGs.

## Known limitations

Intentional simplifications, called out so they are not mistaken for bugs:

- **Story deletion** ("only the contributor can delete their story") is enforced in the
  interface (`StoriesList.tsx`), not by Firestore rules, which cannot check the authorship of a
  single array element. Any member's write to a person's stories is permitted by the rules. A
  watertight fix needs Cloud Functions, which are out of scope (spec §16).
- **Profile links** ("which person am I", and one account per sign-in kind per person) are
  checked in the app, not in the rules. They only decide which name is shown.
- **Everyone can edit everyone.** Members are equals; there are no per-person or read-only
  roles. Removing a number from the invite-by-phone list stops future joins but does not remove
  people who already joined.
- **One tree per user** decides where someone lands after signing in (`RootPage.tsx`,
  `useMyGiaPha`); a person who is an editor of several trees goes to whichever Firestore
  returns first.
- **Names of other editors**: Firebase Auth only exposes the signed-in user's own name, so each
  member's name is copied to `giaPha/{id}/editorProfiles/{uid}` so "last edited by" and
  "told by" can show other people's names.
- **Large PDF chunk**: the PDF library and its embedded Vietnamese font are around 1.5 MB, but
  load only when someone clicks Export.
