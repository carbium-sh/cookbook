# Build an unsigned swap

Builds an unsigned transaction for your own wallet to sign. This example holds no private key, signs nothing and sends nothing.

It quotes 0.01 SOL to USDC with `quote`, builds the swap with `swap` for one wallet's public key, and prints the
amounts, what the wallet would pay (the 5,000-lamport signature fee, the priority fee and the rent for any token account
it creates) and the transaction, in base64. Put your own public key in `userPubkey`. The quote is valid for 30 seconds
and the transaction until block height `lastValidBlockHeight`.

Set `CARBIUM_KEY` to your service key (`c_serv_...`, from the dashboard at carbium.sh). The key needs the quote scope
and the account the quote module. Then run it with Node 24:

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
