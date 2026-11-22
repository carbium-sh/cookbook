# Read USD prices

Reads the USD price of SOL, USDC and USDT with one `prices` call. A mint the table does not carry is left out, and a
price can be `null`. The table is rebuilt about every 30 seconds, so one call gives the current one. The key needs the
quote scope and the account the quote module.

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
