"""Page through a wallet's history. getSignaturesForAddress pages with a before cursor: the last signature of a page.
getTransactionsForAddress pages with the paginationToken of its answer, None on the last page."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

ADDRESS = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"
LIMIT = 5
MAX_PAGES = 2  # this example stops after two pages; raise it to read further back

pages, newest, oldest = [], None, None
rows, token, history_floor = [], None, None
try:
    with Carbium(api_key) as carbium:
        while len(pages) < MAX_PAGES:
            page = carbium.get_signatures_for_address(ADDRESS, {"limit": LIMIT, "before": oldest} if oldest else {"limit": LIMIT})
            pages.append(len(page))
            newest = newest or (page[0]["signature"] if page else None)
            oldest = page[-1]["signature"] if page else oldest
            if len(page) < LIMIT:
                break  # the last page
        # The same history in the other shape, newest first: each answer's paginationToken asks for the next page.
        while True:
            config = {"limit": LIMIT, "transactionDetails": "signatures"}
            answer = carbium.get_transactions_for_address(ADDRESS, {**config, "paginationToken": token} if token else config)
            rows.append(len(answer["data"]))
            token = answer.get("paginationToken")
            history_floor = answer.get("historyFloor", history_floor)
            if token is None or len(rows) >= MAX_PAGES:
                break
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({
    "address": ADDRESS,
    "pages": pages,
    "newest": newest,
    "oldest": oldest,
    # It reads only down to historyFloor, the ledger floor: an address quiet since then shows no rows here.
    "transactionsForAddress": {"pages": rows, "more": token is not None, "historyFloor": history_floor},
}))
