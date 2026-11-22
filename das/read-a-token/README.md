# Read a token

Reads the USDC mint three ways: its name and symbol with `getAsset`, its supply with `getTokenSupply`, and one holder
with `getTokenAccounts`, whose token account and balance it prints. Put another mint in `mint` to read that token. The
key needs the das scope.

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
