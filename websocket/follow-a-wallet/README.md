# Follow a wallet over WebSocket

Subscribes with `logsSubscribe` and `{"mentions": [wallet]}`, which fires for every transaction that touches the
wallet, then reads the balance it starts from with `getBalance`. It waits at most 10 seconds for one notification,
prints it (or `null` when none came), unsubscribes and exits. A plain wallet sends nothing on `accountSubscribe`; this
pair is the way to follow one. The key travels in the `x-api-key` header: in TypeScript the recipe passes the `ws` package
and `carrier: 'header'`, because Node's own WebSocket cannot send that header; Python, Rust and Go send it there by
default.

Set `CARBIUM_KEY` to your service key (`c_serv_...`, from the dashboard at carbium.sh), then run it with Node 24:

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
