// Read the USD price of a few mints with one prices call. The table behind it is rebuilt about every 30 seconds.
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

var mints = []string{
	"So11111111111111111111111111111111111111112",  // SOL
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
}

func main() {
	// CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
	c, err := carbium.NewClient(os.Getenv("CARBIUM_KEY"), nil)
	if err != nil {
		fail(err)
	}
	ctx := context.Background()
	table, err := c.Prices(ctx, carbium.PricesParams{Mints: mints})
	if err != nil {
		fail(err)
	}
	// Each row is a mint, its price in USD or nil, its TVL in USD and its quote mint. A mint the table does not carry is absent.
	prices := map[string]*float64{}
	for _, row := range table.Rows {
		prices[row.Mint] = row.PriceUSD
	}
	// stale counts the table's rows that are stale, 0 when none.
	emit(map[string]any{"solUsd": table.SolUSD, "builtUnix": table.BuiltUnix, "stale": table.Stale, "prices": prices})
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
