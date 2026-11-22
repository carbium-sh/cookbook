# Look up a transaction

Takes the latest signature for the USDC mint with `getSignaturesForAddress`, reads its status with
`getSignatureStatuses`, then the transaction with `getTransaction` in base64, and prints its slot, status, version, fee,
compute units and size. Put your own signature in place of the first call to look up yours.

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
