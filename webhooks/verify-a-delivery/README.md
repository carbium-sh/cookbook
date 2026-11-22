# Verify a webhook delivery

Runs offline and needs no key. It makes a sample delivery in the shape of carbium.sh's test event, signed the way
carbium.sh signs one (HMAC-SHA256 of `webhook-id.webhook-timestamp.body` under a made-up `whsec_` secret), checks it with
the SDK's `verifyWebhook` (`verify_webhook` in Python and Rust, `webhooks.Verify` in Go), then shows the same delivery with one byte changed being refused with `no_match`.

In your own receiver, read the secret from `CARBIUM_WEBHOOK_SECRET`, pass the raw body bytes as they arrived, answer 2xx
within 15 seconds, and dedupe on `webhook-id`.

Run it with Node 24:

```sh
cd typescript
npm install
node main.ts
```

Or with Python 3.11 or later:

```sh
cd python
python3 -m venv .venv && . .venv/bin/activate
pip install 'carbium>=0.1,<0.2'
python main.py
```

Or with Rust:

```sh
cd rust
cargo run
```

Or with Go:

```sh
cd go
go mod tidy
go build -o example .
./example
```
