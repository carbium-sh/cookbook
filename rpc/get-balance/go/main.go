// Get a wallet's SOL balance with one getBalance call.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"

	carbium "github.com/carbium-sh/carbium-go"
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
	ctx := context.Background()
	answer, err := c.GetBalance(ctx, wallet, &carbium.CommitmentConfig{Commitment: carbium.CommitmentConfirmed})
	if err != nil {
		fail(err)
	}
	emit(map[string]any{"wallet": wallet, "lamports": answer.Value, "sol": float64(answer.Value) / 1e9, "slot": answer.Context.Slot})
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
