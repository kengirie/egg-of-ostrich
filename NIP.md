# Egg of Ostriches

`draft` `optional`

Egg of Ostriches is an anonymous question box ("marshmallow") on Nostr. It defines **no new kinds**: a nest is a NIP-5A named site, questions are NIP-22 comments, and answers are kind 1 notes that link to the answer's own NIP-5A named site, whose OG card shows the question.

## Nest (question box) — kind `35128`

A nest is a [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) named-site manifest published by the owner. Each user has **one** nest, always with `d` = `nest`. Its address `35128:<owner>:nest` is the NIP-22 root that every egg hangs from, and the site itself is served at `https://<pubkeyB36>nest.<gateway>/`. Editing the nest republishes the same `d`, so the link and the eggs stay.

Besides the standard NIP-5A tags (`d`, `path`, `x … aggregate`, `server`, `title`, `description`), a nest carries:

| tag | description |
| --- | --- |
| `["t", "egg-of-ostriches"]` | Marks the named site as a nest |

Paths: `/index.html` and `/404.html` (the app with nest OG meta baked in, plus `<meta name="egg:npub">` / `<meta name="egg:id">`), `/og.png` (1200×630 share card), `/site-assets.json` (the app asset index, so a new nest can be hatched from any nest), and the app's `/assets/*` bundles.

## Egg (question) — kind `1111`

A top-level NIP-22 comment on the nest, **signed by a throwaway key** generated in the browser for that one egg and discarded immediately. It MUST carry [NIP-13](https://github.com/nostr-protocol/nips/blob/master/13.md) proof of work of at least **12** bits; clients drop eggs below that.

```json
{
  "kind": 1111,
  "pubkey": "<throwaway>",
  "content": "ダチョウに乗ったことありますか？",
  "tags": [
    ["A", "35128:<owner>:nest"], ["K", "35128"], ["P", "<owner>"],
    ["a", "35128:<owner>:nest"], ["k", "35128"], ["p", "<owner>"],
    ["nonce", "…", "12"]
  ]
}
```

Eggs are sent over dedicated relay connections that answer NIP-42 AUTH with another throwaway key, so a logged-in visitor's identity is never bound to the egg. Content is **not encrypted** — eggs are public.

## Hatch (answer) — kind `1`

The owner answers an egg with a regular kind 1 text note that quotes the egg ([NIP-18](https://github.com/nostr-protocol/nips/blob/master/18.md) `q`), points at the nest, and ends with a hashtag plus the **answer link**, so any client unfurls it as an OGP card showing the question.

```json
{
  "kind": 1,
  "pubkey": "<owner>",
  "content": "鶏卵25個分なので、だいたい10人前です！\n\n#EggOfOstriches\nhttps://<pubkeyB36>q<first 12 hex of egg id>.nsite.lol/",
  "tags": [
    ["q", "<egg id>", "", "<egg pubkey>"],
    ["a", "35128:<owner>:nest"],
    ["t", "eggofostriches"],
    ["r", "https://<pubkeyB36>q<first 12 hex of egg id>.nsite.lol/"]
  ]
}
```

- `content` is `<answer>\n\n#EggOfOstriches\n<answer link>`. Clients display the answer with that trailer stripped.
- `q` — the egg (question) being answered, with the egg's throwaway pubkey as the author hint.
- `a` — the nest address. Clients query a nest's answers with `{"kinds":[1], "authors":["<owner>"], "#a":["35128:<owner>:nest"]}`.
- `t` — `eggofostriches` (NIP-24 lowercase hashtag); the global "just hatched" feed queries `{"kinds":[1], "#t":["eggofostriches"]}`.
- `r` — the answer link (https only): the answer site below.

A note counts as a hatch only if its author is the nest owner (the pubkey in the `a` tag), the `a` tag is that nest, `q` is a 64-hex id of a valid egg in that nest, `r` is an https URL, and the answer text is non-empty. The newest valid note per egg wins, so an owner can re-answer.

### Answer site — kind `35128`

Each answer is published as its **own** NIP-5A named site by the owner, before the note:

| | |
| --- | --- |
| `d` | `q` + the first 12 hex characters of the egg id (13 characters, the NIP-5A maximum; nests never use this shape) |
| URL | `https://<pubkeyB36>q<12 hex>.<gateway>/` — this is the answer link |
| tags | standard NIP-5A tags plus `["t", "egg-of-ostriches-answer"]` and `["a", "35128:<owner>:nest"]` |
| paths | `/index.html` and `/404.html` (the app HTML with OG/Twitter meta for this answer, `<meta name="egg:npub">` and `<meta name="egg:answer" content="<egg id>">`, so it boots straight into the answer), `/og.png`, `/site-assets.json`, and the app's `/assets/*` bundles |
| baked events | `<meta name="egg:event">` (the signed egg JSON), `<meta name="egg:hatch">` (the signed answer note JSON) and `<meta name="egg:nest-title">`, HTML-escaped. Clients re-verify the signatures and the egg/answer pairing, show them immediately, and keep them when relays are slow or missing the events (a newer relay answer wins; a cracked egg is still hidden). The answer note is signed before the site is built and published after it. |

`og:image` / `twitter:image` point at the **Blossom blob URL** of the question card (also listed in the manifest as `/og.png`), so the card does not depend on any gateway being up or fresh.

1 in 10 answers rolls a rare card with **golden eggs**.

Because the answer site is a brand-new named site, gateways hold no stale manifest for it. The owner's client still waits until the gateway actually serves the page (it contains the `egg:answer` meta) before publishing the note, because clients unfurl and cache a link as soon as they see it. If the gateway is slow, the note is held and can be posted later.

Earlier versions posted answers as kind 1111 replies, or baked answer pages into the nest under `/a/<slug>.html`, and allowed several nests per user with free-form `d`. Clients no longer display those.

## Cracked (hidden) eggs — kind `30078`

The owner hides eggs with a [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md) app-data event, `d` = `egg-of-ostriches/cracked/nest`, listing hidden egg ids in `e` tags. Clients query it by the owner's pubkey only and hide the listed eggs.

Query it in its **own** REQ: some relays (e.g. Ditto) only serve kind 30078 to its authenticated author and close the whole REQ otherwise, which would also drop the eggs requested alongside it.
