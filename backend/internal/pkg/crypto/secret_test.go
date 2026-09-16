package crypto

import (
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := DevDefaultDataKey()
	plain := "sk_test_secret_value"
	cipher, err := Encrypt(plain, key)
	if err != nil {
		t.Fatal(err)
	}
	if cipher == plain {
		t.Fatal("expected encrypted value")
	}
	out, err := Decrypt(cipher, key)
	if err != nil {
		t.Fatal(err)
	}
	if out != plain {
		t.Fatalf("expected %q, got %q", plain, out)
	}
}

func TestDecryptPlaintextPassthrough(t *testing.T) {
	out, err := Decrypt("legacy-plaintext", DevDefaultDataKey())
	if err != nil {
		t.Fatal(err)
	}
	if out != "legacy-plaintext" {
		t.Fatalf("unexpected: %s", out)
	}
}
