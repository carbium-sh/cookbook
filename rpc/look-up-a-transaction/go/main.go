// Look up a transaction and its status. A recent signature for the USDC mint stands in for yours:
// getSignatureStatuses reads its status, then getTransaction reads the transaction itself.
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"

	carbium "github.com/carbium-sh/carbium-go"
)

const address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC

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
	latest, err := c.GetSignaturesForAddress(ctx, address, &carbium.SignaturesForAddressConfig{Limit: carbium.Ptr[uint64](1)})
	if err != nil {
		fail(err)
	}
	if len(latest) == 0 {
		fmt.Fprintln(os.Stderr, `{"status":200,"code":null,"message":"the address has no signature to look up"}`)
		os.Exit(1)
	}
	signature := latest[0].Signature
	statuses, err := c.GetSignatureStatuses(ctx, []string{signature}, &carbium.GetSignatureStatusesConfig{SearchTransactionHistory: carbium.Ptr(true)})
	if err != nil {
		fail(err)
	}
	// MaxSupportedTransactionVersion 1: without it a version 1 transaction is refused.
	tx, err := c.GetTransaction(ctx, signature, &carbium.TransactionConfig{Encoding: carbium.TransactionEncodingBase64, MaxSupportedTransactionVersion: carbium.Ptr[uint64](1), Commitment: carbium.CommitmentConfirmed})
	if err != nil {
		fail(err)
	}
	out := map[string]any{"signature": signature, "slot": latest[0].Slot, "confirmationStatus": nil, "err": nil, "blockTime": nil, "version": nil, "feeLamports": nil, "computeUnits": nil, "bytes": nil}
	if len(statuses.Value) > 0 && statuses.Value[0] != nil {
		s := statuses.Value[0]
		out["slot"], out["confirmationStatus"], out["err"] = s.Slot, s.ConfirmationStatus, s.Err
	}
	if tx != nil {
		out["blockTime"], out["version"] = tx.BlockTime, tx.Version
		if tx.Meta != nil {
			out["feeLamports"], out["computeUnits"] = tx.Meta.Fee, tx.Meta.ComputeUnitsConsumed
		}
		if raw, err := base64.StdEncoding.DecodeString(tx.Transaction.Data); err == nil && tx.Transaction.Data != "" {
			out["bytes"] = len(raw)
		}
	}
	emit(out)
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
