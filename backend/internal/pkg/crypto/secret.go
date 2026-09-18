package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const encPrefix = "enc:v1:"

// IsEncrypted reports whether stored looks like an encrypted secret (enc:…).
func IsEncrypted(stored string) bool {
	return strings.HasPrefix(strings.TrimSpace(stored), "enc:")
}

func NormalizeDataKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid NOVAS_DATA_KEY: %w", err)
	}
	if len(key) != 32 {
		return nil, errors.New("NOVAS_DATA_KEY must decode to 32 bytes")
	}
	return key, nil
}

func DevDefaultDataKey() []byte {
	sum := sha256.Sum256([]byte("novaspay-dev-data-key-change-me"))
	return sum[:]
}

func Encrypt(plain string, dataKey []byte) (string, error) {
	if plain == "" {
		return "", nil
	}
	if len(dataKey) != 32 {
		return "", errors.New("data key must be 32 bytes")
	}
	block, err := aes.NewCipher(dataKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(cipherText string, dataKey []byte) (string, error) {
	if cipherText == "" {
		return "", nil
	}
	if !strings.HasPrefix(cipherText, encPrefix) {
		return cipherText, nil
	}
	if len(dataKey) != 32 {
		return "", errors.New("data key must be 32 bytes")
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(cipherText, encPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(dataKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("ciphertext too short")
	}
	nonce, payload := raw[:nonceSize], raw[nonceSize:]
	plain, err := gcm.Open(nil, nonce, payload, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
