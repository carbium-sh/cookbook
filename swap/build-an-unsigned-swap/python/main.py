"""Builds an unsigned transaction for your own wallet to sign. This example holds no private key, signs nothing and sends nothing.

Quotes 0.01 SOL to USDC, builds the swap for one wallet's public key, and prints what that wallet would pay.
"""
import json
import os
import sys

from carbium import Carbium, CarbiumError

SOL = "So11111111111111111111111111111111111111112"
USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
# The wallet that would sign and pay the fees. Put your own public key here.
USER_PUBKEY = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"

try:
    # CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
    with Carbium(os.environ.get("CARBIUM_KEY")) as carbium:
        quote = carbium.quote(src_mint=SOL, dst_mint=USDC, amount_in="10000000", slippage_bps=50)
        swap = carbium.swap(quote_id=quote["quoteId"], user_pubkey=USER_PUBKEY)
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({
    "userPubkey": USER_PUBKEY,
    "inAmount": quote["srcAmountIn"],
    "outAmount": quote["destAmountOut"],
    "minAmountOut": swap["minAmountOut"],
    "signatureFeeLamports": "5000",
    "priorityFeeLamports": swap["priorityFeeLamports"],
    "rentLamports": swap["rentLamports"],
    "lastValidBlockHeight": swap["lastValidBlockHeight"],
    # Base64. Decode it as a versioned transaction and sign it with your own wallet.
    "transaction": swap["transaction"],
}))
