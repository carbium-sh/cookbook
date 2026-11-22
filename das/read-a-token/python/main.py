"""Read a token: its name and symbol (getAsset), its supply (getTokenSupply) and one holder's balance (getTokenAccounts)."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC

try:
    with Carbium(api_key) as carbium:
        asset = carbium.get_asset(id=MINT)
        supply = carbium.get_token_supply(MINT)["value"]
        holders = carbium.get_token_accounts(mint=MINT, limit=1)["token_accounts"]
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

metadata = (asset.get("content") or {}).get("metadata") or {}
holder = holders[0] if holders else None
print(json.dumps({
    "mint": MINT,
    "name": metadata.get("name"),
    "symbol": metadata.get("symbol"),
    "decimals": supply["decimals"],
    "supply": supply["uiAmountString"],
    "holder": {"owner": holder["owner"], "tokenAccount": holder["address"], "amount": str(holder["amount"])} if holder else None,
}))
