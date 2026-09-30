# Development & deployment

```sh
npm run dev    # dev server on :8080
npm test       # typecheck + lint + vitest + build
```

`npm run dev` does **not** emit `site-assets.json`, so publishing a nest end-to-end
needs a built preview: `npm run build && npx vite preview`.

## How a nest is published

All in the browser (`src/hooks/usePublishNest.ts`):

1. Draw the 1200×630 share card on a canvas (`src/lib/ogImage.ts`) and upload it to Blossom.
2. Load `site-assets.json` from the running app (root-base build — local preview, the "ostrich" nsite, or any nest site) and make sure every app asset exists on the owner's Blossom servers (`src/lib/appMirror.ts`).
3. Bake `index.html` with the nest's OG meta and `egg:*` meta tags (`src/lib/staticNest.ts`); upload it, and `site-assets.json`.
4. Sign and publish the kind 35128 manifest (+ kind 10063 if the owner has none).

The app is always a root-base build (`base: "/"`), because nest sites are served from `/`.

## Hosting the app

Run `nsite.yml` (manual dispatch or a published Release) to publish the app as the
named nsite `ostrich`. It needs the `NOSTR_SEC` secret (a dedicated key). Optionally
set the `APP_NSITE_PUBKEY` repo variable (hex) to that key's pubkey.

Any static host that serves the build at `/` with an SPA fallback also works.
Subpath hosting (e.g. GitHub project pages under `/repo/`) is not supported.

## Local E2E testing

Put a throwaway identity in `scripts/*.local.json` (git-ignored). Never test with a real key.
