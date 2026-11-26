# Quote a swap

Quotes 0.01 SOL to USDC with one `quote` call. It prints the amount in and out (in lamports and USDC atoms), the floor
a swap built from this quote enforces (`minAmountOut`, 0.5% below), the route by venue, the router fee and the
`quoteId`, which [Build an unsigned swap](../../swap/build-an-unsigned-swap/) takes within 30 seconds.

It needs no key. With `CARBIUM_KEY` unset it calls services.carbium.sh without one, which serves `quote`, `swap` and
`prices` at up to 30 calls a minute per IP address. For more, set `CARBIUM_KEY` to your service key (`c_serv_...`,
from the dashboard at carbium.sh): it needs the quote scope, and its account the quote module. Run it with Node 24:

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
