// List a wallet's tokens and NFTs, page by page, with getAssetsByOwner. ShowFungible adds the tokens it holds.
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
	owner    = "DFFiJgCASVfPEQgRkrjkYAPGtFyo2pygx9aGp5XpMT9H"
	limit    = 10
	maxPages = 2 // this example stops after two pages; raise it to read everything
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
	assets := []map[string]any{}
	pagesRead := 0
	nextPage := carbium.Ptr[uint64](1)
	for nextPage != nil && pagesRead < maxPages {
		list, err := c.GetAssetsByOwner(ctx, carbium.GetAssetsByOwnerParams{
			OwnerAddress: owner,
			Limit:        carbium.Ptr[uint64](limit),
			Page:         nextPage,
			SortBy:       &carbium.DASSort{SortBy: carbium.DASSortByID, SortDirection: carbium.SortOrderAsc},
			Options:      &carbium.DASDisplayOptions{ShowFungible: carbium.Ptr(true)},
		})
		if err != nil {
			fail(err)
		}
		for _, asset := range list.Items {
			var metadata struct {
				Name string `json:"name"`
			}
			_ = json.Unmarshal(asset.Content["metadata"], &metadata)
			var name any
			if metadata.Name != "" {
				name = metadata.Name
			}
			assets = append(assets, map[string]any{"id": asset.ID, "interface": asset.Interface, "name": name})
		}
		pagesRead++
		// A page shorter than the limit is the last one.
		if len(list.Items) < limit {
			nextPage = nil
		} else {
			nextPage = carbium.Ptr(*nextPage + 1)
		}
	}
	emit(map[string]any{"owner": owner, "limit": limit, "pagesRead": pagesRead, "nextPage": nextPage, "assets": assets})
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
