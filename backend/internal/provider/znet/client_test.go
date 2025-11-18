package znet

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestListProducts(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/servis/pin_listesi.php":
			assertAuth(t, r.URL.Query())
			payload := map[string]any{
				"success": true,
				"result": []map[string]string{{
					"id":       "123",
					"adi":      "PUBG 60 UC",
					"fiyat":    "45.50",
					"oyun_adi": "PUBG",
					"kupur":    "UC60",
				}},
			}
			_ = json.NewEncoder(w).Encode(payload)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "kod", "sifre", WithHTTPClient(ts.Client()))

	products, err := client.ListProducts(context.Background())
	if err != nil {
		t.Fatalf("ListProducts error: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(products))
	}
	if products[0].Name != "PUBG 60 UC" || products[0].PriceTRY != 45.50 {
		t.Fatalf("unexpected product: %+v", products[0])
	}
}

func TestGetBalance(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/servis/bakiye_kontrol.php":
			assertAuth(t, r.URL.Query())
			_, _ = w.Write([]byte("OK|43.55|0.00|note"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "kod", "sifre", WithHTTPClient(ts.Client()))

	balance, err := client.GetBalance(context.Background())
	if err != nil {
		t.Fatalf("GetBalance error: %v", err)
	}
	if balance.Balance != 43.55 {
		t.Fatalf("unexpected balance: %+v", balance)
	}
}

func TestPlaceOrder(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/servis/pin_ekle.php":
			q := r.URL.Query()
			assertAuth(t, q)
			if q.Get("oyun") != "100" || q.Get("kupur") != "UC60" || q.Get("oyuncu_bilgi") != "player" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			_, _ = w.Write([]byte("OK|45.50|1000.00"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)

	client := NewClient(ts.URL, "kod", "sifre", WithHTTPClient(ts.Client()))

	resp, err := client.PlaceOrder(context.Background(), PlaceOrderRequest{
		GameID:           "100",
		CouponID:         "UC60",
		PlayerIdentifier: "player",
	})
	if err != nil {
		t.Fatalf("PlaceOrder error: %v", err)
	}
	if !resp.Success || resp.CostTRY != 45.50 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func assertAuth(t *testing.T, values url.Values) {
	t.Helper()
	if values.Get("kod") != "kod" || values.Get("sifre") != "sifre" {
		t.Fatalf("missing auth params: %v", values)
	}
}
