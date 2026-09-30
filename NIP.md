# Egg of Ostriches

`draft` `optional`

Egg of Ostriches is an anonymous question box ("marshmallow") on Nostr. It defines **no new kinds**: a nest is a NIP-5A named site, questions are NIP-22 comments, and answers are kind 1 notes that link to an answer page baked into the nest.

## Nest (question box) — kind `35128`

A nest is a [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) named-site manifest published by the owner. Its address `35128:<owner>:<d>` is the NIP-22 root that every egg hangs from, and the site itself is served at `https://<pubkeyB36><d>.<gateway>/`.

Besides the standard NIP-5A tags (`d`, `path`, `x … aggregate`, `server`, `title`, `description`), a nest carries:

| tag | description |
| --- | --- |
| `["t", "egg-of-ostriches"]` | Marks the named site as a nest (used to list a user's nests) |

Paths: `/index.html` and `/404.html` (the app with nest OG meta baked in, plus `<meta name="egg:npub">` / `<meta name="egg:id">`), `/og.png` (1200×630 share card), `/site-assets.json` (the app asset index, so a new nest can be hatched from any nest), and the app's `/assets/*` bundles. Each answer adds `/a/<slug>.html` and `/a/<slug>.png` (see below).

## Egg (question) — kind `1111`

A top-level NIP-22 comment on the nest, **signed by a throwaway key** generated in the browser for that one egg and discarded immediately. It MUST carry [NIP-13](https://github.com/nostr-protocol/nips/blob/master/13.md) proof of work of at least **12** bits; clients drop eggs below that.

```json
{
  "kind": 1111,
  "pubkey": "<throwaway>",
  "content": "ダチョウに乗ったことありますか？",
  "tags": [
    ["A", "35128:<owner>:<d>"], ["K", "35128"], ["P", "<owner>"],
    ["a", "35128:<owner>:<d>"], ["k", "35128"], ["p", "<owner>"],
    ["nonce", "…", "12"]
  ]
}
```

Eggs are sent over dedicated relay connections that answer NIP-42 AUTH with another throwaway key, so a logged-in visitor's identity is never bound to the egg. Content is **not encrypted** — eggs are public.

## Hatch (answer) — kind `1`

The owner answers an egg with a regular kind 1 text note that quotes the egg ([NIP-18](https://github.com/nostr-protocol/nips/blob/master/18.md) `q`), points at the nest, and ends with a hashtag plus the **answer link**, so any client unfurls the answer as an OGP card.

```json
{
  "kind": 1,
  "pubkey": "<owner>",
  "content": "鶏卵25個分なので、だいたい10人前です！\n\n#EggOfOstriches\nhttps://<pubkeyB36><d>.nwb.tf/a/<slug>.html",
  "tags": [
    ["q", "<egg id>", "", "<egg pubkey>"],
    ["a", "35128:<owner>:<d>"],
    ["t", "eggofostriches"],
    ["r", "https://<pubkeyB36><d>.nwb.tf/a/<slug>.html"]
  ]
}
```

- `content` is `<answer>\n\n#EggOfOstriches\n<answer link>`. Clients display the answer with that trailer stripped.
- `q` — the egg (question) being answered, with the egg's throwaway pubkey as the author hint.
- `a` — the nest address. Clients query a nest's answers with `{"kinds":[1], "authors":["<owner>"], "#a":["35128:<owner>:<d>"]}`.
- `t` — `eggofostriches` (NIP-24 lowercase hashtag); the global "just hatched" feed queries `{"kinds":[1], "#t":["eggofostriches"]}`.
- `r` — the answer link (https only).

A note counts as a hatch only if its author is the nest owner (the pubkey in the `a` tag), the `a` tag is that nest, `q` is a 64-hex id of a valid egg in that nest, `r` is an https URL, and the answer text is non-empty. The newest valid note per egg wins, so an owner can re-answer.

### Answer page

Before publishing the note, the owner's client bakes a static page into the nest and republishes the nest manifest (kind `35128`, same `d`) with two more paths:

| path | content |
| --- | --- |
| `/a/<slug>.html` | The app HTML with OG/Twitter meta for this answer (`og:image` = `/a/<slug>.png`) plus `<meta name="egg:npub">`, `<meta name="egg:id">` and `<meta name="egg:answer" content="<slug>">`, so it boots straight into the answer |
| `/a/<slug>.png` | 1200×630 share card showing the question |

`<slug>` is the first 16 hex characters of the egg id. The answer link is `https://<pubkeyB36><d>.<gateway>/a/<slug>.html`. The `.html` extension is required because gateways serve extensionless paths with the wrong MIME type. The note is published only after the manifest, so the link resolves as soon as the note is seen.

Earlier versions posted answers as kind 1111 replies to the egg. Clients no longer display those.

## Cracked (hidden) eggs — kind `30078`

The owner hides eggs with a [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md) app-data event, `d` = `egg-of-ostriches/cracked/<nest d>`, listing hidden egg ids in `e` tags. Clients query it by the owner's pubkey only and hide the listed eggs.
