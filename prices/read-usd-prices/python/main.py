"""Read the USD price of a few mints with one prices call. The table behind it is rebuilt about every 30 seconds."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

MINTS = [
    "So11111111111111111111111111111111111111112",  # SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
]

try:
    # CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
    with Carbium(os.environ.get("CARBIUM_KEY")) as carbium:
        table = carbium.prices(mints=MINTS)
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

# Each row is [mint, price_usd or None, tvl_usd, quote_mint]. A mint the table does not carry is absent.
prices = {row[0]: row[1] for row in table["rows"]}
# stale counts the table's rows that are stale, 0 when none.
print(json.dumps({"solUsd": table["solUsd"], "builtUnix": table["builtUnix"], "stale": table["stale"], "prices": prices}))
