package zdk

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetBalance(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("api-token") != "token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"balance": "45.5",
			"email":   "test@example.com",
		})
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "token", WithHTTPClient(ts.Client()))

	resp, err := client.GetBalance(context.Background())
	if err != nil {
		t.Fatalf("GetBalance error: %v", err)
	}
	if resp.Balance != 45.5 || resp.Email != "test@example.com" {
		t.Fatalf("unexpected balance: %#v", resp)
	}
}

func TestListProducts(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/client/api/products":
			_ = json.NewEncoder(w).Encode([]map[string]any{{
				"id":            "123",
				"name":          "PUBG UC",
				"category_name": "PUBG",
				"price":         "45.50",
				"available":     true,
				"params":        []string{"uid", "server"},
				"qty_values": map[string]any{
					"min": 1,
					"max": 10,
				},
				"product_type": "package",
			}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "token", WithHTTPClient(ts.Client()))

	products, err := client.ListProducts(context.Background())
	if err != nil {
		t.Fatalf("ListProducts error: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(products))
	}
	if products[0].Name != "PUBG UC" || products[0].Quantity.Type != "range" {
		t.Fatalf("unexpected product: %#v", products[0])
	}
}

func TestPlaceOrder(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/client/api/newOrder/123/params":
			if r.URL.Query().Get("qty") != "1" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status": "OK",
				"data": map[string]any{
					"order_id": "abc",
					"status":   "success",
					"price":    "12.5",
					"pin":      "PIN123",
				},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "token", WithHTTPClient(ts.Client()))

	resp, err := client.PlaceOrder(context.Background(), PlaceOrderRequest{
		ProductID: "123",
		Quantity:  1,
		Params: map[string]string{
			"uid": "12345",
		},
	})
	if err != nil {
		t.Fatalf("PlaceOrder error: %v", err)
	}
	if !resp.Success || resp.ExternalID != "abc" || resp.Pin != "PIN123" {
		t.Fatalf("unexpected response: %#v", resp)
	}
}
