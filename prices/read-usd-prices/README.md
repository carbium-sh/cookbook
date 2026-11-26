# Read USD prices

Reads the USD price of SOL, USDC and USDT with one `prices` call. A mint the table does not carry is left out, and a
price can be `null`. The table is rebuilt about every 30 seconds, so one call gives the current one.

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
