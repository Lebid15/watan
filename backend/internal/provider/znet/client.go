package znet

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Client talks to the ZNet provider API.
type Client struct {
	baseURL    string
	kod        string
	sifre      string
	httpClient *http.Client
}

// Option configures the client.
type Option func(*Client)

// WithHTTPClient overrides the default HTTP client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

// NewClient builds a new ZNet client.
func NewClient(baseURL, kod, sifre string, opts ...Option) *Client {
	client := &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		kod:     kod,
		sifre:   sifre,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(client)
	}
	return client
}

// BalanceResponse represents the parsed balance endpoint output.
type BalanceResponse struct {
	Balance float64 `json:"balance"`
	Debt    float64 `json:"debt"`
	Note    string  `json:"note"`
	Raw     string  `json:"raw"`
}

// Product is a normalized catalog row from ZNet.
type Product struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Game     string  `json:"game"`
	PriceTRY float64 `json:"price_try"`
	Coupon   string  `json:"coupon"`
}

// PlaceOrderRequest contains the minimal data required to call pin_ekle.
type PlaceOrderRequest struct {
	GameID           string `json:"game_id"`   // oyun
	CouponID         string `json:"coupon_id"` // kupur
	Reference        string `json:"reference"`
	PlayerIdentifier string `json:"player_identifier"`
	CustomerPhone    string `json:"customer_phone"`
}

// PlaceOrderResponse wraps the parsed pin_ekle output.
type PlaceOrderResponse struct {
	Success           bool    `json:"success"`
	CostTRY           float64 `json:"cost_try"`
	RemainingBalance  float64 `json:"remaining_balance"`
	ProviderReference string  `json:"provider_reference"`
	Raw               string  `json:"raw"`
}

// ListProducts fetches the catalog.
func (c *Client) ListProducts(ctx context.Context) ([]Product, error) {
	resp, err := c.get(ctx, "/servis/pin_listesi.php", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read products body: %w", err)
	}

	var payload struct {
		Success bool              `json:"success"`
		Result  []json.RawMessage `json:"result"`
		Error   string            `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode products: %w", err)
	}

	if !payload.Success {
		return nil, fmt.Errorf("znet products error: %s", payload.Error)
	}

	products := make([]Product, 0, len(payload.Result))
	for _, raw := range payload.Result {
		var item struct {
			ID    string `json:"id"`
			Adi   string `json:"adi"`
			Fiyat string `json:"fiyat"`
			Oyun  string `json:"oyun_adi"`
			Kupur string `json:"kupur"`
		}
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, fmt.Errorf("decode product item: %w", err)
		}
		price, _ := strconv.ParseFloat(item.Fiyat, 64)
		products = append(products, Product{
			ID:       item.ID,
			Name:     firstNonEmpty(item.Adi, item.Oyun),
			Game:     item.Oyun,
			PriceTRY: price,
			Coupon:   item.Kupur,
		})
	}

	return products, nil
}

// GetBalance fetches the provider balance.
func (c *Client) GetBalance(ctx context.Context) (BalanceResponse, error) {
	resp, err := c.get(ctx, "/servis/bakiye_kontrol.php", nil)
	if err != nil {
		return BalanceResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return BalanceResponse{}, fmt.Errorf("read balance body: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(body)), "|")
	if len(parts) < 4 {
		return BalanceResponse{}, fmt.Errorf("unexpected balance response: %s", body)
	}

	if parts[0] != "OK" {
		return BalanceResponse{}, fmt.Errorf("balance error: %s", body)
	}

	balance, err := strconv.ParseFloat(parts[1], 64)
	if err != nil {
		return BalanceResponse{}, fmt.Errorf("parse balance: %w", err)
	}
	debt, err := strconv.ParseFloat(parts[2], 64)
	if err != nil {
		return BalanceResponse{}, fmt.Errorf("parse debt: %w", err)
	}

	return BalanceResponse{
		Balance: balance,
		Debt:    debt,
		Note:    parts[3],
		Raw:     string(body),
	}, nil
}

// PlaceOrder executes the pin_ekle endpoint.
func (c *Client) PlaceOrder(ctx context.Context, req PlaceOrderRequest) (PlaceOrderResponse, error) {
	if req.GameID == "" || req.CouponID == "" || req.PlayerIdentifier == "" {
		return PlaceOrderResponse{}, errors.New("game_id, coupon_id and player_identifier are required")
	}
	params := url.Values{}
	params.Set("oyun", req.GameID)
	params.Set("kupur", req.CouponID)
	params.Set("oyuncu_bilgi", req.PlayerIdentifier)
	if req.CustomerPhone != "" {
		params.Set("musteri_tel", req.CustomerPhone)
	}

	reference := req.Reference
	if reference == "" {
		reference = fmt.Sprintf("ahla-%d", time.Now().UnixNano())
	}
	params.Set("referans", reference)

	resp, err := c.get(ctx, "/servis/pin_ekle.php", params)
	if err != nil {
		return PlaceOrderResponse{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return PlaceOrderResponse{}, fmt.Errorf("read order body: %w", err)
	}

	parts := strings.Split(strings.TrimSpace(string(body)), "|")
	if len(parts) < 3 {
		return PlaceOrderResponse{}, fmt.Errorf("unexpected order response: %s", body)
	}

	if parts[0] != "OK" {
		return PlaceOrderResponse{}, fmt.Errorf("order error: %s", string(body))
	}

	cost, err := strconv.ParseFloat(parts[1], 64)
	if err != nil {
		return PlaceOrderResponse{}, fmt.Errorf("parse cost: %w", err)
	}
	remaining, err := strconv.ParseFloat(parts[2], 64)
	if err != nil {
		return PlaceOrderResponse{}, fmt.Errorf("parse remaining balance: %w", err)
	}

	return PlaceOrderResponse{
		Success:           true,
		CostTRY:           cost,
		RemainingBalance:  remaining,
		ProviderReference: reference,
		Raw:               string(body),
	}, nil
}

func (c *Client) get(ctx context.Context, path string, params url.Values) (*http.Response, error) {
	if params == nil {
		params = url.Values{}
	}
	params.Set("kod", c.kod)
	params.Set("sifre", c.sifre)

	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)
	if len(params) > 0 {
		endpoint = fmt.Sprintf("%s?%s", endpoint, params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("perform request: %w", err)
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("znet http %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return resp, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
