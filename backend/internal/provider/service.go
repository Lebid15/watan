package provider

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/lebid15/ahla/backend/internal/domain"
	"github.com/lebid15/ahla/backend/internal/provider/zdk"
	"github.com/lebid15/ahla/backend/internal/provider/znet"
)

// Supported provider keys.
const (
	ProviderZNet     = "znet"
	ProviderZDK      = "zdk"
	ProviderAhla     = "ahla"
	ProviderBarakat  = "barakat"
	ProviderAppStore = "apstore"
)

var (
	// ErrCredentialNotFound signals the requested credential does not exist for the tenant.
	ErrCredentialNotFound = errors.New("provider credential not found")
	// ErrUnsupportedProvider indicates the provider type is not yet wired.
	ErrUnsupportedProvider = errors.New("provider not supported")
)

var supportedProviders = map[string]struct{}{
	ProviderZNet:     {},
	ProviderZDK:      {},
	ProviderAhla:     {},
	ProviderBarakat:  {},
	ProviderAppStore: {},
}

// Service centralises provider credential CRUD and client creation.
type Service struct {
	db *gorm.DB
}

// NewService builds a provider service instance.
func NewService(db *gorm.DB) *Service {
	if db == nil {
		panic("provider service requires db")
	}
	return &Service{db: db}
}

// CreateCredentialInput captures the fields needed to create a credential.
type CreateCredentialInput struct {
	Provider string
	BaseURL  string
	Kod      string
	Sifre    string
}

// ListCredentials returns all credentials for a tenant/provider pair (provider optional).
func (s *Service) ListCredentials(ctx context.Context, tenantID, provider string) ([]domain.ProviderCredential, error) {
	query := s.db.WithContext(ctx).Where("tenant_id = ?", tenantID)
	if provider != "" {
		query = query.Where("provider = ?", normalizeProvider(provider))
	}
	var creds []domain.ProviderCredential
	if err := query.Order("created_at DESC").Find(&creds).Error; err != nil {
		return nil, err
	}
	return creds, nil
}

// CreateCredential inserts a new credential for the tenant.
func (s *Service) CreateCredential(ctx context.Context, tenantID string, input CreateCredentialInput) (domain.ProviderCredential, error) {
	providerKey := normalizeProvider(input.Provider)
	if _, ok := supportedProviders[providerKey]; !ok {
		return domain.ProviderCredential{}, ErrUnsupportedProvider
	}
	if strings.TrimSpace(input.BaseURL) == "" {
		return domain.ProviderCredential{}, fmt.Errorf("base_url is required")
	}

	requireKOD := providerKey == ProviderZNet
	requireSifre := providerKey == ProviderZNet
	zdkFamily := isZDKProvider(providerKey)

	if requireKOD && strings.TrimSpace(input.Kod) == "" {
		return domain.ProviderCredential{}, fmt.Errorf("kod is required")
	}
	if requireSifre && strings.TrimSpace(input.Sifre) == "" {
		return domain.ProviderCredential{}, fmt.Errorf("sifre is required")
	}

	if zdkFamily {
		if strings.TrimSpace(input.Kod) == "" && strings.TrimSpace(input.Sifre) == "" {
			return domain.ProviderCredential{}, fmt.Errorf("api token is required")
		}
	}

	token := strings.TrimSpace(input.Kod)
	if zdkFamily && token == "" {
		token = strings.TrimSpace(input.Sifre)
	}

	credential := domain.ProviderCredential{
		ID:       fmt.Sprintf("%s-%s", providerKey, uuid.NewString()),
		TenantID: tenantID,
		Provider: providerKey,
		BaseURL:  strings.TrimRight(input.BaseURL, "/"),
		Kod:      input.Kod,
		Sifre:    input.Sifre,
	}
	if zdkFamily {
		credential.Kod = token
	}

	if err := s.db.WithContext(ctx).Create(&credential).Error; err != nil {
		return domain.ProviderCredential{}, err
	}
	return credential, nil
}

// ResolveCredential fetches the credential by id, falling back to the most recent one if id empty.
func (s *Service) ResolveCredential(ctx context.Context, tenantID, provider, credentialID string) (domain.ProviderCredential, error) {
	providerKey := normalizeProvider(provider)
	if _, ok := supportedProviders[providerKey]; !ok {
		return domain.ProviderCredential{}, ErrUnsupportedProvider
	}

	var credential domain.ProviderCredential
	query := s.db.WithContext(ctx).Where("tenant_id = ? AND provider = ?", tenantID, providerKey)
	if credentialID != "" {
		query = query.Where("id = ?", credentialID)
	}
	if credentialID == "" {
		query = query.Order("created_at DESC")
	}
	err := query.First(&credential).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.ProviderCredential{}, ErrCredentialNotFound
		}
		return domain.ProviderCredential{}, err
	}
	return credential, nil
}

// BuildZNetClient instantiates a ZNet client for the tenant and credential.
func (s *Service) BuildZNetClient(ctx context.Context, tenantID, credentialID string) (*znet.Client, domain.ProviderCredential, error) {
	credential, err := s.ResolveCredential(ctx, tenantID, ProviderZNet, credentialID)
	if err != nil {
		return nil, domain.ProviderCredential{}, err
	}
	client := znet.NewClient(credential.BaseURL, credential.Kod, credential.Sifre)
	return client, credential, nil
}

// BuildZDKClient instantiates a ZDK-compatible client for the requested provider.
func (s *Service) BuildZDKClient(ctx context.Context, tenantID, providerKey, credentialID string) (*zdk.Client, domain.ProviderCredential, error) {
	key := normalizeProvider(providerKey)
	if key == "" {
		key = ProviderZDK
	}
	if !isZDKProvider(key) {
		return nil, domain.ProviderCredential{}, ErrUnsupportedProvider
	}
	credential, err := s.ResolveCredential(ctx, tenantID, key, credentialID)
	if err != nil {
		return nil, domain.ProviderCredential{}, err
	}
	token := strings.TrimSpace(credential.Kod)
	if token == "" {
		token = strings.TrimSpace(credential.Sifre)
	}
	if token == "" {
		return nil, domain.ProviderCredential{}, fmt.Errorf("credential missing api token")
	}
	client := zdk.NewClient(credential.BaseURL, token)
	return client, credential, nil
}

func normalizeProvider(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func isZDKProvider(provider string) bool {
	switch provider {
	case ProviderZDK, ProviderAhla, ProviderBarakat, ProviderAppStore:
		return true
	default:
		return false
	}
}
