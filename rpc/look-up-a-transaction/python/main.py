"""Look up a transaction and its status. A recent signature for the USDC mint stands in for yours: getSignatureStatuses
reads its status, then getTransaction reads the transaction itself."""
import base64
import json
import os
import sys

from carbium import Carbium, CarbiumError

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC

try:
    with Carbium(api_key) as carbium:
        latest = carbium.get_signatures_for_address(ADDRESS, {"limit": 1})
        if not latest:
            print(json.dumps({"status": 200, "code": None, "message": "the address has no signature to look up"}), file=sys.stderr)
            sys.exit(1)
        signature = latest[0]["signature"]
        status = carbium.get_signature_statuses([signature], {"searchTransactionHistory": True})["value"][0]
        # maxSupportedTransactionVersion 1: without it a version 1 transaction is refused.
        tx = carbium.get_transaction(signature, {"encoding": "base64", "maxSupportedTransactionVersion": 1, "commitment": "confirmed"})
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

meta = (tx or {}).get("meta") or {}
encoded = (tx or {}).get("transaction")
print(json.dumps({
    "signature": signature,
    "slot": status["slot"] if status else latest[0]["slot"],
    "confirmationStatus": status["confirmationStatus"] if status else None,
    "err": status["err"] if status else None,
    "blockTime": (tx or {}).get("blockTime"),
    "version": (tx or {}).get("version"),
    "feeLamports": meta.get("fee"),
    "computeUnits": meta.get("computeUnitsConsumed"),
    "bytes": len(base64.b64decode(encoded[0])) if isinstance(encoded, list) else None,
}))
