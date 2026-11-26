// Quote a swap of 0.01 SOL to USDC with one quote call. Amounts are strings in base units: lamports and USDC atoms.
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
)

func main() {
	// CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
	c, err := carbium.NewClient(os.Getenv("CARBIUM_KEY"), nil)
	if err != nil {
		fail(err)
	}
	ctx := context.Background()
	quote, err := c.Quote(ctx, carbium.QuoteParams{SrcMint: sol, DstMint: usdc, AmountIn: "10000000", SlippageBps: 50})
	if err != nil {
		fail(err)
	}
	route := []string{}
	for _, leg := range quote.RoutePlan {
		route = append(route, leg.SwapInfo.Label+" "+leg.Percent+"%")
	}
	emit(map[string]any{
		"inputMint":    quote.InputMint,
		"outputMint":   quote.OutputMint,
		"inAmount":     quote.SrcAmountIn,
		"outAmount":    quote.DestAmountOut, // net of the router fee
		"minAmountOut": quote.MinAmountOut,  // the floor a swap built from this quote enforces
		"route":        route,
		"fee":          quote.PlatformFee,
		"quoteId":      quote.QuoteID, // valid for 30 seconds
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
