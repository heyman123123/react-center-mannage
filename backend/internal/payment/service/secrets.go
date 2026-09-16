package service

import (
	"log"
	"strings"

	"github.com/novaspay/admin-api/internal/conf"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/crypto"
)

func resolveDataKey(cfg *conf.Config) ([]byte, bool) {
	if cfg == nil {
		key := crypto.DevDefaultDataKey()
		return key, true
	}
	key, err := crypto.NormalizeDataKey(cfg.DataKey)
	if err != nil {
		log.Printf("WARNING: %v; using dev default data key", err)
		return crypto.DevDefaultDataKey(), true
	}
	if key == nil {
		log.Printf("WARNING: NOVAS_DATA_KEY is empty; using dev default data key (generate with: openssl rand -base64 32)")
		return crypto.DevDefaultDataKey(), true
	}
	return key, false
}

func (s *Service) sealSecret(plain string) string {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return ""
	}
	out, err := crypto.Encrypt(plain, s.dataKey)
	if err != nil {
		log.Printf("WARNING: encrypt secret failed: %v; storing plaintext", err)
		return plain
	}
	return out
}

func (s *Service) openSecret(stored string) string {
	if stored == "" {
		return ""
	}
	out, err := crypto.Decrypt(stored, s.dataKey)
	if err != nil {
		log.Printf("WARNING: decrypt secret failed: %v", err)
		return stored
	}
	return out
}

func (s *Service) decryptChannel(row *persistence.PaymentChannel) *persistence.PaymentChannel {
	if row == nil {
		return nil
	}
	cp := *row
	cp.ApiKey = s.openSecret(row.ApiKey)
	cp.ApiSecretKey = s.openSecret(row.ApiSecretKey)
	cp.WebhookSecret = s.openSecret(row.WebhookSecret)
	return &cp
}
