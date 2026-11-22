// Builds an unsigned transaction for your own wallet to sign. This example holds no private key, signs nothing and sends nothing.
//
// Quotes 0.01 SOL to USDC, builds the swap for one wallet's public key, and prints what that wallet would pay.
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

const (
	sol  = "So11111111111111111111111111111111111111112"
	usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
	// The wallet that would sign and pay the fees. Put your own public key here.
	userPubkey = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"
)

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
	quote, err := c.Quote(ctx, carbium.QuoteParams{SrcMint: sol, DstMint: usdc, AmountIn: "10000000", SlippageBps: 50})
	if err != nil {
		fail(err)
	}
	swap, err := c.Swap(ctx, carbium.SwapParams{QuoteID: quote.QuoteID, UserPubkey: userPubkey})
	if err != nil {
		fail(err)
	}
	emit(map[string]any{
		"userPubkey":           userPubkey,
		"inAmount":             quote.SrcAmountIn,
		"outAmount":            quote.DestAmountOut,
		"minAmountOut":         swap.MinAmountOut,
		"signatureFeeLamports": "5000",
		"priorityFeeLamports":  swap.PriorityFeeLamports,
		"rentLamports":         swap.RentLamports,
		"lastValidBlockHeight": swap.LastValidBlockHeight,
		// Base64. Decode it as a versioned transaction and sign it with your own wallet.
		"transaction": swap.Transaction,
	})
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
