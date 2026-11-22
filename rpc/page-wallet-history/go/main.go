// Page through a wallet's history. getSignaturesForAddress pages with a before cursor: the last signature of a page.
// getTransactionsForAddress pages with the paginationToken of its answer, nil on the last page.
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
	address  = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9"
	limit    = 5
	maxPages = 2 // this example stops after two pages; raise it to read further back
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
	pages := []int{}
	var newest, oldest *string
	for len(pages) < maxPages {
		config := &carbium.SignaturesForAddressConfig{Limit: carbium.Ptr[uint64](limit)}
		if oldest != nil {
			config.Before = *oldest
		}
		page, err := c.GetSignaturesForAddress(ctx, address, config)
		if err != nil {
			fail(err)
		}
		pages = append(pages, len(page))
		if len(page) > 0 {
			if newest == nil {
				newest = &page[0].Signature
			}
			oldest = &page[len(page)-1].Signature
		}
		if len(page) < limit {
			break // the last page
		}
	}
	// The same history in the other shape, newest first: each answer's paginationToken asks for the next page.
	rows := []int{}
	var token *string
	var historyFloor *uint64
	for {
		config := &carbium.TransactionsForAddressConfig{Limit: carbium.Ptr[uint64](limit), TransactionDetails: carbium.AddressHistoryDetailsSignatures}
		if token != nil {
			config.PaginationToken = *token
		}
		answer, err := c.GetTransactionsForAddress(ctx, address, config)
		if err != nil {
			fail(err)
		}
		rows = append(rows, len(answer.Data))
		token = answer.PaginationToken
		if answer.HistoryFloor != nil {
			historyFloor = answer.HistoryFloor
		}
		if token == nil || len(rows) >= maxPages {
			break
		}
	}
	emit(map[string]any{
		"address": address,
		"pages":   pages,
		"newest":  newest,
		"oldest":  oldest,
		// It reads only down to historyFloor, the ledger floor: an address quiet since then shows no rows here.
		"transactionsForAddress": map[string]any{"pages": rows, "more": token != nil, "historyFloor": historyFloor},
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
