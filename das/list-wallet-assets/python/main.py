"""List a wallet's tokens and NFTs, page by page, with getAssetsByOwner. showFungible adds the tokens it holds."""
import json
import os
import sys

from carbium import Carbium, CarbiumError

api_key = os.environ.get("CARBIUM_KEY")
if not api_key:
    print("set CARBIUM_KEY to your c_serv_ key", file=sys.stderr)
    sys.exit(2)

OWNER = "DFFiJgCASVfPEQgRkrjkYAPGtFyo2pygx9aGp5XpMT9H"
LIMIT = 10
MAX_PAGES = 2  # this example stops after two pages; raise it to read everything

assets = []
pages_read = 0
next_page = 1
try:
    with Carbium(api_key) as carbium:
        while next_page is not None and pages_read < MAX_PAGES:
            page = carbium.get_assets_by_owner(ownerAddress=OWNER, limit=LIMIT, page=next_page, sortBy={"sortBy": "id", "sortDirection": "asc"}, options={"showFungible": True})
            for asset in page["items"]:
                metadata = (asset.get("content") or {}).get("metadata") or {}
                assets.append({"id": asset["id"], "interface": asset["interface"], "name": metadata.get("name") or None})
            pages_read += 1
            # A page shorter than the limit is the last one.
            next_page = None if len(page["items"]) < LIMIT else next_page + 1
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({"owner": OWNER, "limit": LIMIT, "pagesRead": pages_read, "nextPage": next_page, "assets": assets}))
