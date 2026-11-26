# Carbium cookbook

Small examples that call Carbium's Solana services at `services.carbium.sh`. Each recipe is one task in its own folder,
written as one short file per language, TypeScript, Python, Rust and Go, that you can copy into your own code.

## Recipes

<!-- index: written by scripts/index.mjs from the recipe.json files -->

### RPC

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Get a wallet's SOL balance](rpc/get-balance/) | Read one wallet's balance in lamports and SOL with getBalance. | [TypeScript](rpc/get-balance/typescript/) | [Python](rpc/get-balance/python/) | [Rust](rpc/get-balance/rust/) | [Go](rpc/get-balance/go/) |
| [Look up a transaction](rpc/look-up-a-transaction/) | Take a recent signature, read its status, then the transaction itself. | [TypeScript](rpc/look-up-a-transaction/typescript/) | [Python](rpc/look-up-a-transaction/python/) | [Rust](rpc/look-up-a-transaction/rust/) | [Go](rpc/look-up-a-transaction/go/) |
| [Page through a wallet's history](rpc/page-wallet-history/) | Read an address's signatures two pages deep, with a before cursor and with a page token. | [TypeScript](rpc/page-wallet-history/typescript/) | [Python](rpc/page-wallet-history/python/) | [Rust](rpc/page-wallet-history/rust/) | [Go](rpc/page-wallet-history/go/) |

### DAS

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [List a wallet's tokens and NFTs](das/list-wallet-assets/) | Page through everything one wallet holds with getAssetsByOwner, 10 assets a page. | [TypeScript](das/list-wallet-assets/typescript/) | [Python](das/list-wallet-assets/python/) | [Rust](das/list-wallet-assets/rust/) | [Go](das/list-wallet-assets/go/) |
| [Read a token](das/read-a-token/) | Read a mint's name and symbol, its supply and one holder's balance. | [TypeScript](das/read-a-token/typescript/) | [Python](das/read-a-token/python/) | [Rust](das/read-a-token/rust/) | [Go](das/read-a-token/go/) |

### WebSocket

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Follow a wallet over WebSocket](websocket/follow-a-wallet/) | Subscribe to a wallet's transactions, read its balance, take one notification and unsubscribe. | [TypeScript](websocket/follow-a-wallet/typescript/) | [Python](websocket/follow-a-wallet/python/) | [Rust](websocket/follow-a-wallet/rust/) | [Go](websocket/follow-a-wallet/go/) |

### Quote

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Quote a swap](quote/quote-a-swap/) | Quote 0.01 SOL to USDC: the amount out, the floor, the route and the fee. | [TypeScript](quote/quote-a-swap/typescript/) | [Python](quote/quote-a-swap/python/) | [Rust](quote/quote-a-swap/rust/) | [Go](quote/quote-a-swap/go/) |

### Swap

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Build an unsigned swap](swap/build-an-unsigned-swap/) | Quote 0.01 SOL to USDC and build the swap for your own wallet to sign, with what it costs. | [TypeScript](swap/build-an-unsigned-swap/typescript/) | [Python](swap/build-an-unsigned-swap/python/) | [Rust](swap/build-an-unsigned-swap/rust/) | [Go](swap/build-an-unsigned-swap/go/) |

### Prices

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Read USD prices](prices/read-usd-prices/) | Read the USD price of a few mints with one prices call. | [TypeScript](prices/read-usd-prices/typescript/) | [Python](prices/read-usd-prices/python/) | [Rust](prices/read-usd-prices/rust/) | [Go](prices/read-usd-prices/go/) |

### Webhooks

| Recipe | What it does | TypeScript | Python | Rust | Go |
|---|---|---|---|---|---|
| [Verify a webhook delivery](webhooks/verify-a-delivery/) | Check a delivery's signature with the SDK, offline, and see one changed byte refused. | [TypeScript](webhooks/verify-a-delivery/typescript/) | [Python](webhooks/verify-a-delivery/python/) | [Rust](webhooks/verify-a-delivery/rust/) | [Go](webhooks/verify-a-delivery/go/) |

<!-- end of index -->

## Run a recipe

Each example that calls a service reads your service key (`c_serv_...`, from the dashboard at carbium.sh) from
`CARBIUM_KEY`. The SDK sends it in the `x-api-key` header, never in a URL. Quote a swap, Build an unsigned swap and Read
USD prices also run with `CARBIUM_KEY` unset: they then call services.carbium.sh with no key, which serves `quote`,
`swap` and `prices` at up to 30 calls a minute per IP address. With Node 24:

```sh
cd rpc/get-balance/typescript
npm install
export CARBIUM_KEY=<your c_serv_ key>
node main.ts
```

Or with Python 3.11 or later:

```sh
cd rpc/get-balance/python
python3 -m venv .venv && . .venv/bin/activate
pip install 'carbium>=0.1,<0.2'
python main.py
```

Or with Rust:

```sh
cd rpc/get-balance/rust
cargo run
```

Or with Go:

```sh
cd rpc/get-balance/go
go mod tidy
go build -o example .
./example
```

Go builds first because `go run .` exits 1 whatever the example's exit code was.

An example prints one line of JSON and exits 0. When the service refuses a call, it prints the HTTP status, the error
code and the message as one line of JSON on stderr and exits 1. An example that needs a key and has none says which one
to set and exits 2.

The swap example builds an unsigned transaction for your own wallet to sign. No example holds a private key, signs a
transaction or sends one.

## Layout

| Path | What it holds |
|---|---|
| `<service>/<recipe>/recipe.json` | The recipe: its title and summary, the calls it makes, the keys it needs, its languages and the keys its output must hold. |
| `<service>/<recipe>/typescript/` | `main.ts` and its `package.json`. |
| `<service>/<recipe>/python/` | `main.py`. |
| `<service>/<recipe>/rust/` | `Cargo.toml` and `src/main.rs`. |
| `<service>/<recipe>/go/` | `go.mod`, `go.sum` and `main.go`. |
| [recipe.schema.json](recipe.schema.json) | The schema every `recipe.json` fits. It allows no other keys. |
| [spec/served.json](spec/served.json) | A copy of `served.json` from [carbium-sh/spec](https://github.com/carbium-sh/spec): every call a recipe names is in it. |
| [scripts/check.mjs](scripts/check.mjs) | Runs a recipe and checks the last line it prints against its `recipe.json`. |
| [scripts/index.mjs](scripts/index.mjs) | Writes the recipe tables above from the `recipe.json` files. |
| [benchmark/](benchmark/) | Carbium's published benchmark script: it times 34 reads from your machine with your own key, one call at a time and at most one every 200 ms. |

## Test it

```sh
pnpm install --ignore-scripts
pnpm setup:python            # a .venv with the Python package; put .venv/bin first on PATH
cargo build --workspace      # every Rust example, into one target folder
pnpm typecheck
pnpm test
```

The Rust and Go examples need two things on the machine first: the line `127.0.0.1 services.carbium.sh` in
`/etc/hosts`, and permission to listen on port 443 (`sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443`). A container
started with `--add-host services.carbium.sh:127.0.0.1` has both. Without them, run
`COOKBOOK_LANGUAGES=typescript,python pnpm test`: the variable takes runner names (`typescript`, `python`, `rust`, `go`)
and refuses any other. Before a Rust or Go example runs, the tests check that the name resolves to 127.0.0.1 alone,
and stop with what to set when it does not. The first Go build fetches the Go modules; after that the tests need no
network.

Once the dependencies are installed, the tests need no network and no key. They check every `recipe.json` against the schema, `served.json` and its
folders, and that the tables above are what `scripts/index.mjs` writes. Every example, in each language, runs against a stand-in for
the service on 127.0.0.1, reached through `test/redirect.mjs` for Node, `test/python/sitecustomize.py` for Python, and for Rust and Go a hosts
entry for `services.carbium.sh` on 127.0.0.1 with the stand-in on port 443 behind a certificate made for the run
(`test/tls.mjs`, trusted through `SSL_CERT_FILE`), so the examples stay as a reader copies them. `COOKBOOK_LANGUAGES`
picks the languages to run on a machine without every toolchain: with no key, an example that needs `CARBIUM_KEY` must call nothing and exit 2, and one that needs none must send no key and make exactly its calls, which `recipe.json` may list only from those the service answers with no key; with a made-up key it must exit 1 with the 401, send
the key only in `x-api-key`, and print it nowhere; with every call answered it must make exactly the calls its
`recipe.json` lists. A recipe that sends a transaction is refused. The checker's own tests run the examples against the stand-in too:
a missing output key, a signed slot in the swap transaction and a fee payer other than `userPubkey` must each fail, and
the swap transaction is read to its last byte.

`node scripts/check.mjs --all` runs every recipe once against `services.carbium.sh` with the key in `CARBIUM_KEY`, one
at a time, 1 second apart, and sorts each result into PASS, RATE (429), CAP (402: nothing runs after it), FAIL or SKIP
(not run). It exits 0 only when every recipe passed. With `CARBIUM_KEY` unset, the recipes that need no key run without
one and the others are SKIP.

To add a recipe, add its folder with `recipe.json`, `README.md` and one folder per language, then run
`node scripts/index.mjs`.

## License

MIT
