"""Quote a swap of 0.01 SOL to USDC with one quote call. Amounts are strings in base units: lamports and USDC atoms."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

try:
    # CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
    with Carbium(os.environ.get("CARBIUM_KEY")) as carbium:
        quote = carbium.quote(src_mint=SOL, dst_mint=USDC, amount_in="10000000", slippage_bps=50)
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({
    "inputMint": quote["inputMint"],
    "outputMint": quote["outputMint"],
    "inAmount": quote["srcAmountIn"],
    "outAmount": quote["destAmountOut"],  # net of the router fee
    "minAmountOut": quote["minAmountOut"],  # the floor a swap built from this quote enforces
    "route": [f"{leg['swapInfo']['label']} {leg['percent']}%" for leg in quote["routePlan"]],
    "fee": quote.get("platformFee"),
    "quoteId": quote["quoteId"],  # valid for 30 seconds
}))
