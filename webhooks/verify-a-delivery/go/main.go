// Verify a webhook delivery, offline. A delivery is a POST whose webhook-signature header carries an HMAC-SHA256 of
// webhook-id.webhook-timestamp.body under the webhook's secret. This example makes a made-up secret and a sample
// delivery in the shape of carbium.sh's test event, checks it with the module's webhooks.Verify, then shows the same
// delivery with one byte changed being refused. In your receiver, take the secret from CARBIUM_WEBHOOK_SECRET and pass
// the raw body bytes as they arrived.
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	carbium "github.com/carbium-sh/carbium-go"
	"github.com/carbium-sh/carbium-go/webhooks"
)

func main() {
	// carbium.sh shows a webhook's secret once, when you create or rotate the webhook: whsec_ and then base64.
	key := make([]byte, 24)
	_, _ = rand.Read(key)
	secret := "whsec_" + base64.StdEncoding.EncodeToString(key)

	// The sample delivery: the body and the three headers carbium.sh sends.
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	body := []byte(`[{"slot":0,"blockTime":` + timestamp + `,"indexWithinBlock":0,"signature":"` + strings.Repeat("1", 64) + `","err":null,"status":{"Ok":null},"test":true}]`)
	id := make([]byte, 8)
	_, _ = rand.Read(id)
	webhookID := "evt_test_" + hex.EncodeToString(id)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(webhookID + "." + timestamp + "."))
	mac.Write(body)
	headers := map[string]string{
		"webhook-id":        webhookID,
		"webhook-timestamp": timestamp,
		"webhook-signature": "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil)),
	}

	events, err := webhooks.Verify(body, headers, secret, nil)
	if err != nil {
		fail(err)
	}
	// One byte changed: "slot":0 becomes "slot":1.
	changed := bytes.Replace(body, []byte(`"slot":0`), []byte(`"slot":1`), 1)
	refused := "accepted"
	if _, err := webhooks.Verify(changed, headers, secret, nil); err != nil {
		refused = "error"
		var e *carbium.Error
		if errors.As(err, &e) {
			refused = e.Reason
		}
	}
	if refused != "no_match" {
		code, _ := json.Marshal(refused)
		fmt.Fprintf(os.Stderr, "{\"status\":0,\"code\":%s,\"message\":\"a delivery with one byte changed was not refused\"}\n", code)
		os.Exit(1)
	}
	emit(map[string]any{"webhookId": webhookID, "events": len(events), "test": len(events) > 0 && events[0].Test, "changedByte": refused})
}

// fail prints the HTTP status, the error code and the message as one line of JSON on stderr, and exits 1.
func fail(err error) {
	status, code, message := 0, "null", err.Error()
	var e *carbium.Error
	if errors.As(err, &e) {
		status, message = e.HTTPStatus, e.Message
		if e.Code != 0 {
			code = strconv.Itoa(e.Code)
		} else if e.ErrorCode != "" {
			quoted, _ := json.Marshal(e.ErrorCode)
			code = string(quoted)
		}
	}
	text, _ := json.Marshal(message)
	fmt.Fprintf(os.Stderr, "{\"status\":%d,\"code\":%s,\"message\":%s}\n", status, code, text)
	os.Exit(1)
}

// emit writes one line of JSON on stdout.
func emit(v any) {
	line, _ := json.Marshal(v)
	fmt.Println(string(line))
}
