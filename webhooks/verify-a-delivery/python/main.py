"""Verify a webhook delivery, offline. A delivery is a POST whose webhook-signature header carries an HMAC-SHA256 of
webhook-id.webhook-timestamp.body under the webhook's secret. This example makes a made-up secret and a sample
delivery in the shape of carbium.sh's test event, checks it with the package's verify_webhook, then shows the same
delivery with one byte changed being refused. In your receiver, take the secret from CARBIUM_WEBHOOK_SECRET and pass
the raw body bytes as they arrived."""
import base64
import hashlib
import hmac
import json
import secrets
import sys
import time

from carbium import CarbiumError, verify_webhook

# carbium.sh shows a webhook's secret once, when you create or rotate the webhook: whsec_ and then base64.
secret = "whsec_" + base64.b64encode(secrets.token_bytes(24)).decode()

# The sample delivery: the body and the three headers carbium.sh sends.
timestamp = str(int(time.time()))
event = {"slot": 0, "blockTime": int(timestamp), "indexWithinBlock": 0, "signature": "1" * 64, "err": None, "status": {"Ok": None}, "test": True}
body = json.dumps([event], separators=(",", ":")).encode()
webhook_id = "evt_test_" + secrets.token_hex(8)
key = base64.b64decode(secret[len("whsec_"):])
signature = base64.b64encode(hmac.new(key, f"{webhook_id}.{timestamp}.".encode() + body, hashlib.sha256).digest()).decode()
headers = {"webhook-id": webhook_id, "webhook-timestamp": timestamp, "webhook-signature": "v1," + signature}

try:
    events = verify_webhook(body, headers, secret)
except CarbiumError as error:
    print(json.dumps({"status": error.http_status, "code": error.reason or error.code, "message": error.message}), file=sys.stderr)
    sys.exit(1)

# One byte changed: "slot":0 becomes "slot":1.
changed = body.replace(b'"slot":0', b'"slot":1', 1)
try:
    verify_webhook(changed, headers, secret)
    refused = "accepted"
except CarbiumError as error:
    refused = error.reason
if refused != "no_match":
    print(json.dumps({"status": 0, "code": refused, "message": "a delivery with one byte changed was not refused"}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({"webhookId": webhook_id, "events": len(events), "test": events[0].get("test") is True, "changedByte": refused}))
