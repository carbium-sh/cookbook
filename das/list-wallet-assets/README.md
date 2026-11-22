# List a wallet's tokens and NFTs

Reads everything one wallet holds with `getAssetsByOwner`, 10 assets a page, and prints each asset's id, interface and
name. `showFungible` adds the tokens it holds to its NFTs. A page shorter than the limit is the last one; `nextPage` is the page to ask for next, or `null`. The example
stops after two pages. The key needs the das scope.

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
