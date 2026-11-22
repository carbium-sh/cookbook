# Page through a wallet's history

Reads one address's signatures, newest first, 5 a page. `getSignaturesForAddress` takes the next page with `before` set
to the last signature of the page before; a page shorter than the limit is the last. `getTransactionsForAddress` pages
with the `paginationToken` of its answer, which is `null` on the last page. The example stops after two pages of each.

The two read different stores. `getSignaturesForAddress` reads an index that keeps up to 30 days.
`getTransactionsForAddress` reads only down to `historyFloor`, the ledger floor it returns, so for an address that has
been quiet since then it answers no rows and a `null` token while the first still pages.

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
