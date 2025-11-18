package zdk

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

// Client talks to Barakat/APStore style providers (ZDK-compatible API).
type Client struct {
	baseURL    string
	apiToken   string
	httpClient *http.Client
}

// Option customises the client.
type Option func(*Client)

// WithHTTPClient overrides the internal http.Client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

// NewClient constructs a ZDK-compatible provider client.
func NewClient(baseURL, apiToken string, opts ...Option) *Client {
	client := &Client{
		baseURL:  strings.TrimRight(baseURL, "/"),
		apiToken: apiToken,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(client)
	}
	return client
}

// BalanceResponse represents the parsed profile endpoint data.
type BalanceResponse struct {
	Balance float64 `json:"balance"`
	Email   string  `json:"email"`
	Raw     any     `json:"raw"`
}

// Product describes a catalog item returned by the provider.
type Product struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	PriceTRY    float64  `json:"price_try"`
	Available   bool     `json:"available"`
	InputParams []string `json:"input_params"`
	Quantity    Quantity `json:"quantity"`
	Kind        string   `json:"kind"`
}

// Quantity captures the provider's quantity metadata.
type Quantity struct {
	Type   string   `json:"type"`
	Min    float64  `json:"min,omitempty"`
	Max    float64  `json:"max,omitempty"`
	Values []string `json:"values,omitempty"`
}

// PlaceOrderRequest contains the properties required to submit a new order.
type PlaceOrderRequest struct {
	ProductID string            `json:"product_id"`
	Quantity  int               `json:"quantity"`
	Params    map[string]string `json:"params"`
	OrderUUID string            `json:"order_uuid"`
}

// PlaceOrderResponse wraps the parsed order response.
type PlaceOrderResponse struct {
	Success        bool    `json:"success"`
	ExternalID     string  `json:"external_id"`
	ProviderStatus string  `json:"provider_status"`
	PriceTRY       float64 `json:"price_try"`
	Pin            string  `json:"pin,omitempty"`
	Note           string  `json:"note,omitempty"`
	Raw            any     `json:"raw"`
}

// ListProducts fetches the provider catalog.
func (c *Client) ListProducts(ctx context.Context) ([]Product, error) {
	resp, err := c.request(ctx, http.MethodGet, "/client/api/products", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read products body: %w", err)
	}

	var payload []map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode products: %w", err)
	}

	products := make([]Product, 0, len(payload))
	for _, raw := range payload {
		product, err := parseProduct(raw)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, nil
}

// GetBalance fetches the provider balance/profile data.
func (c *Client) GetBalance(ctx context.Context) (BalanceResponse, error) {
	resp, err := c.request(ctx, http.MethodGet, "/client/api/profile", nil)
	if err != nil {
		return BalanceResponse{}, err
	}
	defer resp.Body.Close()

	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return BalanceResponse{}, fmt.Errorf("decode balance: %w", err)
	}

	balance, _ := strconv.ParseFloat(fmt.Sprint(payload["balance"]), 64)
	email, _ := payload["email"].(string)

	return BalanceResponse{
		Balance: balance,
		Email:   email,
		Raw:     payload,
	}, nil
}

// PlaceOrder submits a new order with the provided payload.
func (c *Client) PlaceOrder(ctx context.Context, req PlaceOrderRequest) (PlaceOrderResponse, error) {
	if req.ProductID == "" {
		return PlaceOrderResponse{}, errors.New("product_id is required")
	}
	if req.Quantity <= 0 {
		return PlaceOrderResponse{}, errors.New("quantity must be positive")
	}
	params := url.Values{}
	params.Set("qty", strconv.Itoa(req.Quantity))
	if req.OrderUUID != "" {
		params.Set("order_uuid", req.OrderUUID)
	}
	for k, v := range req.Params {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			continue
		}
		params.Set(k, v)
	}

	path := fmt.Sprintf("/client/api/newOrder/%s/params", url.PathEscape(req.ProductID))
	resp, err := c.request(ctx, http.MethodGet, path, params)
	if err != nil {
		return PlaceOrderResponse{}, err
	}
	defer resp.Body.Close()

	var payload struct {
		Status  string         `json:"status"`
		Data    map[string]any `json:"data"`
		Error   string         `json:"error"`
		Message string         `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return PlaceOrderResponse{}, fmt.Errorf("decode order response: %w", err)
	}

	if !strings.EqualFold(payload.Status, "OK") {
		msg := payload.Message
		if msg == "" {
			msg = payload.Error
		}
		if msg == "" {
			msg = "provider rejected order"
		}
		return PlaceOrderResponse{}, fmt.Errorf("zdk order error: %s", msg)
	}

	var price float64
	if payload.Data != nil {
		price, _ = strconv.ParseFloat(fmt.Sprint(payload.Data["price"]), 64)
	}

	respData := PlaceOrderResponse{
		Success:        true,
		ExternalID:     fmt.Sprint(payload.Data["order_id"]),
		ProviderStatus: fmt.Sprint(payload.Data["status"]),
		PriceTRY:       price,
		Pin:            fmt.Sprint(payload.Data["pin"]),
		Note:           fmt.Sprint(payload.Data["note"]),
		Raw:            payload,
	}
	return respData, nil
}

func (c *Client) request(ctx context.Context, method, path string, params url.Values) (*http.Response, error) {
	endpoint := fmt.Sprintf("%s%s", c.baseURL, path)
	if len(params) > 0 {
		endpoint = fmt.Sprintf("%s?%s", endpoint, params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("api-token", c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("perform request: %w", err)
	}
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("zdk http %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return resp, nil
}

func parseProduct(raw map[string]any) (Product, error) {
	price, _ := strconv.ParseFloat(fmt.Sprint(raw["price"]), 64)
	available, _ := raw["available"].(bool)
	inputParams := make([]string, 0)
	if params, ok := raw["params"].([]any); ok {
		for _, p := range params {
			inputParams = append(inputParams, fmt.Sprint(p))
		}
	}

	quantity := Quantity{Type: "none"}
	if v := raw["qty_values"]; v != nil {
		switch vv := v.(type) {
		case map[string]any:
			quantity.Type = "range"
			quantity.Min, _ = strconv.ParseFloat(fmt.Sprint(vv["min"]), 64)
			quantity.Max, _ = strconv.ParseFloat(fmt.Sprint(vv["max"]), 64)
		case []any:
			quantity.Type = "set"
			for _, item := range vv {
				quantity.Values = append(quantity.Values, fmt.Sprint(item))
			}
		}
	}

	kind := fmt.Sprint(raw["product_type"])
	if kind == "" {
		kind = "package"
	}

	product := Product{
		ID:          fmt.Sprint(raw["id"]),
		Name:        fmt.Sprint(raw["name"]),
		Category:    fmt.Sprint(raw["category_name"]),
		PriceTRY:    price,
		Available:   available,
		InputParams: inputParams,
		Quantity:    quantity,
		Kind:        kind,
	}
	return product, nil
}
