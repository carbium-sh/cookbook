"""Get a wallet's SOL balance with one getBalance call."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

WALLET = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"

try:
    with Carbium(api_key) as carbium:
        answer = carbium.get_balance(WALLET, {"commitment": "confirmed"})
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

lamports = answer["value"]
print(json.dumps({"wallet": WALLET, "lamports": lamports, "sol": lamports / 1e9, "slot": answer["context"]["slot"]}))
