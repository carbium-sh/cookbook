"""Follow a wallet over WebSocket. logsSubscribe with mentions fires for every transaction that touches the wallet;
getBalance reads the balance it starts from. The example takes at most one notification within 10 seconds, then
unsubscribes and exits."""
import asyncio
import json
import os
import sys
import time

from carbium import AsyncCarbium, CarbiumError, CarbiumSocket

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

WALLET = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"
WAIT_SECONDS = 10


async def follow() -> dict:
    loop = asyncio.get_running_loop()
    first, fatal = loop.create_future(), loop.create_future()

    def on_notification(n: dict) -> None:
        if not first.done():
            first.set_result({"slot": n["context"]["slot"], "signature": n["value"]["signature"], "failed": n["value"]["err"] is not None})

    # on_fatal runs when the socket gives up for good, for example when the server closes it because the key was revoked.
    def on_fatal(error: CarbiumError) -> None:
        if not fatal.done():
            fatal.set_result(error)

    # The key travels in the x-api-key header of the handshake.
    async with CarbiumSocket(api_key, on_fatal=on_fatal) as socket, AsyncCarbium(api_key) as carbium:
        sub = socket.logs_subscribe({"mentions": [WALLET]}, on_notification, {"commitment": "confirmed"})
        subscription = await sub.ready
        balance = await carbium.get_balance(WALLET, {"commitment": "confirmed"})
        started = time.monotonic()
        await asyncio.wait([first, fatal], timeout=WAIT_SECONDS, return_when=asyncio.FIRST_COMPLETED)
        if fatal.done():
            raise fatal.result()
        waited_ms = round((time.monotonic() - started) * 1000)
        await sub.unsubscribe()
    notification = first.result() if first.done() else None
    return {"wallet": WALLET, "subscription": subscription, "lamports": balance["value"], "waitedMs": waited_ms, "notification": notification}


try:
    # Nothing here waits longer than 20 seconds in all.
    result = asyncio.run(asyncio.wait_for(follow(), 20))
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)
except TimeoutError:
    print(json.dumps({"status": 0, "code": None, "message": "no answer within 20 seconds"}), file=sys.stderr)
    sys.exit(1)

print(json.dumps(result))
