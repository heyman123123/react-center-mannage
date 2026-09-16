package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const resendAPI = "https://api.resend.com/emails"

type ResendClient struct {
	httpClient *http.Client
}

func NewResendClient() *ResendClient {
	return &ResendClient{httpClient: &http.Client{Timeout: 30 * time.Second}}
}

type SendEmailInput struct {
	ApiKey      string
	FromName    string
	FromEmail   string
	To          string
	Subject     string
	HTML        string
	Text        string
}

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html,omitempty"`
	Text    string   `json:"text,omitempty"`
}

type resendResponse struct {
	ID string `json:"id"`
}

func (c *ResendClient) Send(ctx context.Context, in SendEmailInput) (string, error) {
	from := in.FromEmail
	if in.FromName != "" {
		from = fmt.Sprintf("%s <%s>", in.FromName, in.FromEmail)
	}
	body := resendPayload{
		From:    from,
		To:      []string{in.To},
		Subject: in.Subject,
		HTML:    in.HTML,
		Text:    in.Text,
	}
	if body.HTML == "" {
		body.HTML = "<p>" + in.Text + "</p>"
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPI, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+in.ApiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("resend api %d: %s", resp.StatusCode, string(respBody))
	}
	var parsed resendResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", err
	}
	return parsed.ID, nil
}
