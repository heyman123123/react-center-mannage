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
	if crypto.IsEncrypted(plain) {
		return plain
	}
	out, err := crypto.Encrypt(plain, s.dataKey)
	if err != nil {
		log.Printf("WARNING: encrypt email secret failed: %v; storing plaintext", err)
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
		// Legacy plaintext rows: return as-is so existing Resend channels keep working.
		log.Printf("WARNING: decrypt email secret failed: %v; treating as plaintext", err)
		return stored
	}
	return out
}

// upgradeSecretIfPlain re-encrypts legacy plaintext keys in-place when used.
func (s *Service) upgradeSecretIfPlain(id, stored string) string {
	plain := s.openSecret(stored)
	if plain == "" || crypto.IsEncrypted(stored) {
		return plain
	}
	sealed := s.sealSecret(plain)
	if sealed != "" && sealed != stored && crypto.IsEncrypted(sealed) {
		_ = s.db.Model(&persistence.EmailChannel{}).Where("id = ?", id).Update("api_key", sealed).Error
	}
	return plain
}

func isMaskedSecret(value string) bool {
	return strings.Contains(value, "****") || strings.Contains(value, "********")
}
