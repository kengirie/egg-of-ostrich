# Egg of Ostriches

`draft` `optional`

Egg of Ostriches is an anonymous question box ("marshmallow") on Nostr. It defines **no new kinds**: a nest is a NIP-5A named site, questions and answers are NIP-22 comments.

## Nest (question box) — kind `35128`

A nest is a [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) named-site manifest published by the owner. Its address `35128:<owner>:<d>` is the NIP-22 root that every egg hangs from, and the site itself is served at `https://<pubkeyB36><d>.<gateway>/`.

Besides the standard NIP-5A tags (`d`, `path`, `x … aggregate`, `server`, `title`, `description`), a nest carries:

| tag | description |
| --- | --- |
| `["t", "egg-of-ostriches"]` | Marks the named site as a nest (used to list a user's nests) |

Paths: `/index.html` and `/404.html` (the app with nest OG meta baked in, plus `<meta name="egg:npub">` / `<meta name="egg:id">`), `/og.png` (1200×630 share card), `/site-assets.json` (the app asset index, so a new nest can be hatched from any nest), and the app's `/assets/*` bundles.

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

## Hatch (answer) — kind `1111`

A NIP-22 reply to an egg, signed by the nest owner. Only replies whose author equals the nest owner count as hatches; the newest one wins.

```json
{
  "kind": 1111,
  "content": "鶏卵25個分なので、だいたい10人前です！",
  "tags": [
    ["A", "35128:<owner>:<d>"], ["K", "35128"], ["P", "<owner>"],
    ["e", "<egg id>", "", "<egg pubkey>"], ["k", "1111"], ["p", "<egg pubkey>"]
  ]
}
```

## Cracked (hidden) eggs — kind `30078`

The owner hides eggs with a [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md) app-data event, `d` = `egg-of-ostriches/cracked/<nest d>`, listing hidden egg ids in `e` tags. Clients query it by the owner's pubkey only and hide the listed eggs.
