package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds runtime configuration for the local backend server.
type Config struct {
	App struct {
		Addr string `mapstructure:"addr"`
	} `mapstructure:"app"`

	Database struct {
		Host     string `mapstructure:"host"`
		Port     int    `mapstructure:"port"`
		User     string `mapstructure:"user"`
		Password string `mapstructure:"password"`
		Name     string `mapstructure:"name"`
		SSLMode  string `mapstructure:"sslmode"`
	} `mapstructure:"database"`

	Redis struct {
		Addr     string `mapstructure:"addr"`
		Password string `mapstructure:"password"`
		DB       int    `mapstructure:"db"`
	} `mapstructure:"redis"`

	Auth struct {
		JWTSecret       string `mapstructure:"jwt_secret"`
		DefaultTenantID string `mapstructure:"default_tenant_id"`
		Auth0           struct {
			Domain       string `mapstructure:"domain"`
			ClientID     string `mapstructure:"client_id"`
			ClientSecret string `mapstructure:"client_secret"`
			Audience     string `mapstructure:"audience"`
		} `mapstructure:"auth0"`
	} `mapstructure:"auth"`

	Provider struct {
		ZnetBaseURL string `mapstructure:"znet_base_url"`
		ZnetKod     string `mapstructure:"znet_kod"`
		ZnetSifre   string `mapstructure:"znet_sifre"`
	} `mapstructure:"provider"`
}

// Load reads configuration from environment variables (optionally .env/.env.local files).
func Load() (Config, error) {
	v := viper.New()
	v.SetConfigType("env")
	v.SetEnvPrefix("ahla")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	setDefaults(v)
	if err := bindEnvs(v); err != nil {
		return Config{}, fmt.Errorf("bind env: %w", err)
	}

	// Attempt to read .env.local first, then .env if present.
	for _, candidate := range []string{".env.local", ".env"} {
		v.SetConfigFile(candidate)
		if err := v.ReadInConfig(); err == nil {
			break
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return Config{}, fmt.Errorf("config unmarshal: %w", err)
	}

	if err := cfg.validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func bindEnvs(v *viper.Viper) error {
	keys := []string{
		"app.addr",
		"database.host",
		"database.port",
		"database.user",
		"database.password",
		"database.name",
		"database.sslmode",
		"redis.addr",
		"redis.password",
		"redis.db",
		"auth.jwt_secret",
		"auth.default_tenant_id",
		"auth.auth0.domain",
		"auth.auth0.client_id",
		"auth.auth0.client_secret",
		"auth.auth0.audience",
		"provider.znet_base_url",
		"provider.znet_kod",
		"provider.znet_sifre",
	}
	for _, key := range keys {
		if err := v.BindEnv(key); err != nil {
			return err
		}
	}
	return nil
}

func (c Config) validate() error {
	switch {
	case c.Auth.JWTSecret == "":
		return fmt.Errorf("auth.jwt_secret is required")
	case c.Auth.Auth0.Domain == "":
		return fmt.Errorf("auth.auth0.domain is required")
	case c.Auth.Auth0.ClientID == "":
		return fmt.Errorf("auth.auth0.client_id is required")
	case c.Auth.Auth0.ClientSecret == "":
		return fmt.Errorf("auth.auth0.client_secret is required")
	case c.Database.Host == "":
		return fmt.Errorf("database.host is required")
	case c.Database.User == "":
		return fmt.Errorf("database.user is required")
	case c.Database.Password == "":
		return fmt.Errorf("database.password is required")
	case c.Database.Name == "":
		return fmt.Errorf("database.name is required")
	case c.Auth.DefaultTenantID == "":
		return fmt.Errorf("auth.default_tenant_id is required")
	case c.Provider.ZnetBaseURL == "":
		return fmt.Errorf("provider.znet_base_url is required")
	case c.Provider.ZnetKod == "":
		return fmt.Errorf("provider.znet_kod is required")
	case c.Provider.ZnetSifre == "":
		return fmt.Errorf("provider.znet_sifre is required")
	}
	return nil
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("app.addr", ":8080")
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "ahla")
	v.SetDefault("database.password", "ahla")
	v.SetDefault("database.name", "ahla")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("redis.addr", "localhost:6379")
	v.SetDefault("redis.db", 0)
	v.SetDefault("auth.jwt_secret", "change-me")
	v.SetDefault("auth.default_tenant_id", "tenant-ahla")
	v.SetDefault("auth.auth0.audience", "")
	v.SetDefault("provider.znet_base_url", "https://bayi.alayatl.com")
}
