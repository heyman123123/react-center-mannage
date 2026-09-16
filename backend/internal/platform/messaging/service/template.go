package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/novaspay/admin-api/internal/pkg/timex"
)

type TemplateDTO struct {
	ID                 string   `json:"id"`
	Code               string   `json:"code"`
	Name               string   `json:"name"`
	Language           string   `json:"language"`
	Category           string   `json:"category"`
	Description        string   `json:"description"`
	TriggerEvent       string   `json:"triggerEvent"`
	Subject            string   `json:"subject"`
	SenderName         string   `json:"senderName"`
	SenderEmail        string   `json:"senderEmail"`
	PreviewText        string   `json:"previewText"`
	ContentMarkdown    string   `json:"contentMarkdown"`
	Status             string   `json:"status"`
	AssociatedTenantID string   `json:"associatedTenantId"`
	Variables          []string `json:"variables"`
	DictReferences     []string `json:"dictReferences"`
	UpdatedAt          string   `json:"updatedAt"`
}

type TemplateInput struct {
	Code               string   `json:"code"`
	Name               string   `json:"name"`
	Language           string   `json:"language"`
	Category           string   `json:"category"`
	Description        string   `json:"description"`
	TriggerEvent       string   `json:"triggerEvent"`
	Subject            string   `json:"subject"`
	SenderName         string   `json:"senderName"`
	SenderEmail        string   `json:"senderEmail"`
	PreviewText        string   `json:"previewText"`
	ContentMarkdown    string   `json:"contentMarkdown"`
	Status             string   `json:"status"`
	AssociatedTenantID string   `json:"associatedTenantId"`
	Variables          []string `json:"variables"`
	DictReferences     []string `json:"dictReferences"`
}

func (s *Service) ListTemplates(ctx context.Context, keyword string) ([]TemplateDTO, error) {
	q := s.db.WithContext(ctx).Model(&persistence.EmailTemplate{})
	if kw := strings.TrimSpace(keyword); kw != "" {
		like := "%" + kw + "%"
		q = q.Where("name ILIKE ? OR code ILIKE ? OR subject ILIKE ?", like, like, like)
	}
	var rows []persistence.EmailTemplate
	if err := q.Order("updated_at DESC").Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]TemplateDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toTemplateDTO(r))
	}
	return out, nil
}

func (s *Service) CreateTemplate(ctx context.Context, in TemplateInput) (*TemplateDTO, error) {
	code := strings.TrimSpace(in.Code)
	name := strings.TrimSpace(in.Name)
	subject := strings.TrimSpace(in.Subject)
	if code == "" || name == "" || subject == "" {
		return nil, apperr.InvalidArgument
	}
	varsJSON, _ := json.Marshal(in.Variables)
	dictJSON, _ := json.Marshal(in.DictReferences)
	tenantID := strings.TrimSpace(in.AssociatedTenantID)
	if tenantID == "" {
		tenantID = "ALL"
	}
	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = "DRAFT"
	}
	row := persistence.EmailTemplate{
		ID:                 uuid.NewString(),
		Code:               strings.ToUpper(code),
		Name:               name,
		Language:           defaultLang(in.Language),
		Category:           defaultCategory(in.Category),
		Description:        strings.TrimSpace(in.Description),
		TriggerEvent:       strings.TrimSpace(in.TriggerEvent),
		Subject:            subject,
		SenderName:         strings.TrimSpace(in.SenderName),
		SenderEmail:        strings.TrimSpace(in.SenderEmail),
		PreviewText:        strings.TrimSpace(in.PreviewText),
		ContentMarkdown:    in.ContentMarkdown,
		Status:             status,
		AssociatedTenantID: tenantID,
		VariablesJSON:      string(varsJSON),
		DictReferencesJSON: string(dictJSON),
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "模板代码冲突", err)
	}
	dto := toTemplateDTO(row)
	return &dto, nil
}

func (s *Service) UpdateTemplate(ctx context.Context, id string, in TemplateInput) (*TemplateDTO, error) {
	var row persistence.EmailTemplate
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
	}
	if code := strings.TrimSpace(in.Code); code != "" {
		updates["code"] = strings.ToUpper(code)
	}
	if in.Language != "" {
		updates["language"] = in.Language
	}
	if in.Category != "" {
		updates["category"] = in.Category
	}
	if in.Description != "" {
		updates["description"] = strings.TrimSpace(in.Description)
	}
	if in.TriggerEvent != "" {
		updates["trigger_event"] = strings.TrimSpace(in.TriggerEvent)
	}
	if subject := strings.TrimSpace(in.Subject); subject != "" {
		updates["subject"] = subject
	}
	if in.SenderName != "" {
		updates["sender_name"] = strings.TrimSpace(in.SenderName)
	}
	if in.SenderEmail != "" {
		updates["sender_email"] = strings.TrimSpace(in.SenderEmail)
	}
	if in.PreviewText != "" {
		updates["preview_text"] = strings.TrimSpace(in.PreviewText)
	}
	if in.ContentMarkdown != "" {
		updates["content_markdown"] = in.ContentMarkdown
	}
	if in.Status != "" {
		updates["status"] = in.Status
	}
	if in.AssociatedTenantID != "" {
		updates["associated_tenant_id"] = strings.TrimSpace(in.AssociatedTenantID)
	}
	if in.Variables != nil {
		varsJSON, _ := json.Marshal(in.Variables)
		updates["variables_json"] = string(varsJSON)
	}
	if in.DictReferences != nil {
		dictJSON, _ := json.Marshal(in.DictReferences)
		updates["dict_references_json"] = string(dictJSON)
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	dto := toTemplateDTO(row)
	return &dto, nil
}

func (s *Service) DeleteTemplate(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.EmailTemplate{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func toTemplateDTO(r persistence.EmailTemplate) TemplateDTO {
	vars := []string{}
	dicts := []string{}
	_ = json.Unmarshal([]byte(r.VariablesJSON), &vars)
	_ = json.Unmarshal([]byte(r.DictReferencesJSON), &dicts)
	return TemplateDTO{
		ID:                 r.ID,
		Code:               r.Code,
		Name:               r.Name,
		Language:           r.Language,
		Category:           r.Category,
		Description:        r.Description,
		TriggerEvent:       r.TriggerEvent,
		Subject:            r.Subject,
		SenderName:         r.SenderName,
		SenderEmail:        r.SenderEmail,
		PreviewText:        r.PreviewText,
		ContentMarkdown:    r.ContentMarkdown,
		Status:             r.Status,
		AssociatedTenantID: r.AssociatedTenantID,
		Variables:          vars,
		DictReferences:     dicts,
		UpdatedAt:          timex.FormatUTC(r.UpdatedAt),
	}
}

func defaultLang(lang string) string {
	if lang != "" {
		return lang
	}
	return "en-US"
}

func defaultCategory(cat string) string {
	if cat != "" {
		return cat
	}
	return "SYSTEM"
}
