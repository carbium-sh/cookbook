// Read a token: its name and symbol (getAsset), its supply (getTokenSupply) and one holder's balance (getTokenAccounts).
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

const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC

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
	asset, err := c.GetAsset(ctx, carbium.GetAssetParams{ID: mint})
	if err != nil {
		fail(err)
	}
	supply, err := c.GetTokenSupply(ctx, mint, nil)
	if err != nil {
		fail(err)
	}
	holders, err := c.GetTokenAccounts(ctx, carbium.GetTokenAccountsParams{Mint: mint, Limit: carbium.Ptr[uint64](1)})
	if err != nil {
		fail(err)
	}
	var metadata struct {
		Name   *string `json:"name"`
		Symbol *string `json:"symbol"`
	}
	_ = json.Unmarshal(asset.Content["metadata"], &metadata)
	var holder any
	if len(holders.TokenAccounts) > 0 {
		h := holders.TokenAccounts[0]
		holder = map[string]any{"owner": h.Owner, "tokenAccount": h.Address, "amount": strconv.FormatUint(h.Amount, 10)}
	}
	emit(map[string]any{
		"mint":     mint,
		"name":     metadata.Name,
		"symbol":   metadata.Symbol,
		"decimals": supply.Value.Decimals,
		"supply":   supply.Value.UIAmountString,
		"holder":   holder,
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
