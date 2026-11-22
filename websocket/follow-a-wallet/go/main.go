// Follow a wallet over WebSocket. logsSubscribe with mentions fires for every transaction that touches the wallet;
// getBalance reads the balance it starts from. The example takes at most one notification within 10 seconds, then
// unsubscribes and exits.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	carbium "github.com/carbium-sh/carbium-go"
	"github.com/carbium-sh/carbium-go/ws"
)

const wallet = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"

func main() {
	apiKey := os.Getenv("CARBIUM_KEY")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "set CARBIUM_KEY to your c_serv_ key")
		os.Exit(2)
	}
	c, err := carbium.NewClient(apiKey, nil)
	if err != nil {
		fail(err)
	}
	// Nothing here waits longer than 20 seconds in all.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	// The key travels in the x-api-key header of the handshake, the default. OnFatal runs when the socket gives up for
	// good, for example when the server closes it because the key was revoked.
	socket, err := ws.New(apiKey, &ws.Options{OnFatal: func(e *carbium.Error) { fail(e) }})
	if err != nil {
		fail(err)
	}
	defer socket.Close()
	first := make(chan map[string]any, 1)
	sub, err := socket.LogsSubscribe(ws.LogsMentioning(wallet), &ws.CommitmentConfig{Commitment: carbium.CommitmentConfirmed}, func(n carbium.WithContext[carbium.LogsNotification]) {
		failed := len(n.Value.Err) > 0 && string(n.Value.Err) != "null"
		select {
		case first <- map[string]any{"slot": n.Context.Slot, "signature": n.Value.Signature, "failed": failed}:
		default:
		}
	})
	if err != nil {
		fail(err)
	}
	subscription, err := sub.Ready(ctx)
	if err != nil {
		fail(err)
	}
	balance, err := c.GetBalance(ctx, wallet, &carbium.CommitmentConfig{Commitment: carbium.CommitmentConfirmed})
	if err != nil {
		fail(err)
	}
	started := time.Now()
	var notification any
	select {
	case n := <-first:
		notification = n
	case <-time.After(10 * time.Second):
	case <-ctx.Done():
		fail(errors.New("no answer within 20 seconds"))
	}
	waitedMs := time.Since(started).Milliseconds()
	if err := sub.Unsubscribe(ctx); err != nil {
		fail(err)
	}
	// Unsubscribe sends its frame in the background, then closes the socket: wait for that, briefly, before exiting.
	for end := time.Now().Add(2 * time.Second); socket.State() == ws.StateOpen && time.Now().Before(end); {
		time.Sleep(20 * time.Millisecond)
	}
	emit(map[string]any{"wallet": wallet, "subscription": subscription, "lamports": balance.Value, "waitedMs": waitedMs, "notification": notification})
}

// failing lets only the first caller of fail print: a refused handshake reaches both OnFatal and Ready.
var failing sync.Mutex

// fail prints the HTTP status, the error code and the message as one line of JSON on stderr, and exits 1.
func fail(err error) {
	failing.Lock() // never unlocked: os.Exit follows
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
