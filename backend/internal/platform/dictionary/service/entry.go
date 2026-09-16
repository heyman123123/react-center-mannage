package service

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service { return &Service{db: db} }

type EntryDTO struct {
	ID           string            `json:"id"`
	Namespace    string            `json:"namespace"`
	EntryKey     string            `json:"entryKey"`
	Key          string            `json:"key"` // alias for frontend
	Description  string            `json:"description"`
	Label        string            `json:"label"`
	Translations map[string]string `json:"translations"`
	Category     string            `json:"category"`
	CategoryID   *string           `json:"categoryId"`
	CreatedAt    int64             `json:"createdAt"`
}

func (s *Service) ListLanguages(ctx context.Context) ([]persistence.Language, error) {
	var list []persistence.Language
	err := s.db.WithContext(ctx).Where("enabled = ?", true).Order("sort_order ASC").Find(&list).Error
	return list, err
}

func (s *Service) ListEntries(ctx context.Context, page, pageSize int, keyword, namespace, categoryID string) ([]EntryDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := s.db.WithContext(ctx).Model(&persistence.DictionaryEntry{})
	if namespace != "" {
		q = q.Where("namespace = ?", namespace)
	}
	if categoryID != "" {
		q = q.Where("category_id = ?", categoryID)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("(entry_key ILIKE ? OR description ILIKE ?)", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []persistence.DictionaryEntry
	if err := q.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]EntryDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDTO(r))
	}
	return out, total, nil
}

func (s *Service) Create(ctx context.Context, ns, key, desc, category, categoryID string, translations map[string]string) (*EntryDTO, error) {
	if ns == "" || key == "" || categoryID == "" {
		return nil, apperr.InvalidArgument
	}
	var cat persistence.DictionaryCategory
	if err := s.db.WithContext(ctx).First(&cat, "id = ?", categoryID).Error; err != nil {
		return nil, apperr.NotFound
	}
	if category == "" {
		category = cat.Key
	}
	raw, _ := json.Marshal(translations)
	cid := cat.ID
	e := persistence.DictionaryEntry{
		ID: uuid.NewString(), Namespace: ns, EntryKey: key, Description: desc,
		Translations: string(raw), Category: category, CategoryID: &cid,
	}
	if err := s.db.WithContext(ctx).Create(&e).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "字典键冲突", err)
	}
	dto := toDTO(e)
	return &dto, nil
}

func (s *Service) Update(ctx context.Context, id, desc, category, categoryID string, translations map[string]string) (*EntryDTO, error) {
	var e persistence.DictionaryEntry
	if err := s.db.WithContext(ctx).First(&e, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if desc != "" {
		updates["description"] = desc
	}
	if categoryID != "" {
		var cat persistence.DictionaryCategory
		if err := s.db.WithContext(ctx).First(&cat, "id = ?", categoryID).Error; err != nil {
			return nil, apperr.NotFound
		}
		updates["category_id"] = cat.ID
		if category == "" {
			category = cat.Key
		}
	}
	if category != "" {
		updates["category"] = category
	}
	if translations != nil {
		raw, _ := json.Marshal(translations)
		updates["translations"] = string(raw)
	}
	if err := s.db.WithContext(ctx).Model(&e).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&e, "id = ?", id)
	dto := toDTO(e)
	return &dto, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	var e persistence.DictionaryEntry
	if err := s.db.WithContext(ctx).First(&e, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	if e.CategoryID != nil && *e.CategoryID != "" {
		var cat persistence.DictionaryCategory
		if err := s.db.WithContext(ctx).First(&cat, "id = ?", *e.CategoryID).Error; err == nil && cat.IsSystem {
			return apperr.New(40913, 409, "系统分类下的词条不可删除")
		}
	}
	res := s.db.WithContext(ctx).Delete(&persistence.DictionaryEntry{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func toDTO(e persistence.DictionaryEntry) EntryDTO {
	tr := map[string]string{}
	_ = json.Unmarshal([]byte(e.Translations), &tr)
	label := tr["zh-CN"]
	if label == "" {
		for _, v := range tr {
			label = v
			break
		}
	}
	if label == "" {
		label = e.EntryKey
	}
	return EntryDTO{
		ID: e.ID, Namespace: e.Namespace, EntryKey: e.EntryKey, Key: e.EntryKey,
		Description: e.Description, Label: label, Translations: tr, Category: e.Category,
		CategoryID: e.CategoryID, CreatedAt: e.CreatedAt,
	}
}
