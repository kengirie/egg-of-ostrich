# Egg of Ostriches 🥚

ダチョウの巣に、匿名の卵（質問）を投げ合うNostrの質問箱。

- **巣（質問箱）** = [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) の名前付きnsite（kind 35128、ひとり1つ・`d` = `nest`）。`https://<npubB36>nest.nsite.lol/` がそのまま質問箱のリンクになり、OGカード付きでシェアできます。
- **卵（質問）** = 巣への kind 1111 コメント。投げる人はログイン不要。卵ごとに使い捨ての鍵で署名するので完全匿名です（暗号化はしません）。
- **孵化（回答）** = 巣の主による kind 1 ノート。回答ごとに名前付きnsite（`https://<npubB36>q<卵IDの先頭12桁>.nsite.lol/`）を発行し、そのリンクを本文に入れます。リンクのOGPカードは質問の画像です。

発想は [Rostrum](https://github.com/kengirie/rostrum) から：サーバーでSSRする代わりに、公開時にブラウザでOGメタ入りHTMLを焼いて静的なnsiteに置きます。イベント仕様は [NIP.md](NIP.md)、開発とデプロイは [DEVELOPMENT.md](DEVELOPMENT.md)。

## Stack

React 19 · Vite · TailwindCSS 4 · [Nostrify](https://nostrify.dev) · [MKStack](https://soapbox.pub/mkstack) テンプレート

## License

MIT
