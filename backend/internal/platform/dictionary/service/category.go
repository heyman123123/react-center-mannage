package service

import (
	"context"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
)

type CategoryNode struct {
	ID        string         `json:"id"`
	ParentID  *string        `json:"parentId"`
	Key       string         `json:"key"`
	Name      string         `json:"name"`
	IsSystem  bool           `json:"isSystem"`
	SortOrder int            `json:"sortOrder"`
	Children  []CategoryNode `json:"children,omitempty"`
}

type CategoryInput struct {
	ParentID  *string `json:"parentId"`
	Key       string  `json:"key"`
	Name      string  `json:"name"`
	SortOrder *int    `json:"sortOrder"`
}

func (s *Service) ListCategories(ctx context.Context) ([]CategoryNode, error) {
	var rows []persistence.DictionaryCategory
	if err := s.db.WithContext(ctx).Order("sort_order ASC, created_at ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	flat := make([]CategoryNode, 0, len(rows))
	for _, r := range rows {
		flat = append(flat, CategoryNode{
			ID: r.ID, ParentID: r.ParentID, Key: r.Key, Name: r.Name,
			IsSystem: r.IsSystem, SortOrder: r.SortOrder,
		})
	}
	return buildCategoryTree(flat), nil
}

func (s *Service) CreateCategory(ctx context.Context, in CategoryInput) (*CategoryNode, error) {
	key := strings.TrimSpace(in.Key)
	name := strings.TrimSpace(in.Name)
	if key == "" || name == "" {
		return nil, apperr.InvalidArgument
	}
	if in.ParentID != nil && *in.ParentID != "" {
		var parent persistence.DictionaryCategory
		if err := s.db.WithContext(ctx).First(&parent, "id = ?", *in.ParentID).Error; err != nil {
			return nil, apperr.NotFound
		}
	} else {
		in.ParentID = nil
	}
	sortOrder := 1
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}
	row := persistence.DictionaryCategory{
		ID: uuid.NewString(), ParentID: in.ParentID, Key: key, Name: name, SortOrder: sortOrder,
	}
	if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "分类键冲突", err)
	}
	node := toCategoryNode(row)
	return &node, nil
}

func (s *Service) UpdateCategory(ctx context.Context, id string, in CategoryInput) (*CategoryNode, error) {
	var row persistence.DictionaryCategory
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{}
	if name := strings.TrimSpace(in.Name); name != "" {
		updates["name"] = name
	}
	if in.SortOrder != nil {
		updates["sort_order"] = *in.SortOrder
	}
	if len(updates) == 0 {
		return nil, apperr.InvalidArgument
	}
	if err := s.db.WithContext(ctx).Model(&row).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&row, "id = ?", id)
	node := toCategoryNode(row)
	return &node, nil
}

func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	var row persistence.DictionaryCategory
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		return apperr.NotFound
	}
	if row.IsSystem {
		return apperr.New(40910, 409, "系统分类不可删除")
	}
	var childCount int64
	if err := s.db.WithContext(ctx).Model(&persistence.DictionaryCategory{}).Where("parent_id = ?", id).Count(&childCount).Error; err != nil {
		return err
	}
	if childCount > 0 {
		return apperr.New(40911, 409, "请先删除子分类")
	}
	var entryCount int64
	if err := s.db.WithContext(ctx).Model(&persistence.DictionaryEntry{}).Where("category_id = ?", id).Count(&entryCount).Error; err != nil {
		return err
	}
	if entryCount > 0 {
		return apperr.New(40912, 409, "分类下仍有词条，无法删除")
	}
	res := s.db.WithContext(ctx).Delete(&persistence.DictionaryCategory{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func toCategoryNode(r persistence.DictionaryCategory) CategoryNode {
	return CategoryNode{
		ID: r.ID, ParentID: r.ParentID, Key: r.Key, Name: r.Name,
		IsSystem: r.IsSystem, SortOrder: r.SortOrder,
	}
}

func buildCategoryTree(flat []CategoryNode) []CategoryNode {
	byParent := map[string][]CategoryNode{}
	roots := make([]CategoryNode, 0)
	for _, n := range flat {
		if n.ParentID == nil || *n.ParentID == "" {
			roots = append(roots, n)
		} else {
			byParent[*n.ParentID] = append(byParent[*n.ParentID], n)
		}
	}
	var walk func(n CategoryNode) CategoryNode
	walk = func(n CategoryNode) CategoryNode {
		kids := byParent[n.ID]
		sort.Slice(kids, func(i, j int) bool { return kids[i].SortOrder < kids[j].SortOrder })
		for _, k := range kids {
			n.Children = append(n.Children, walk(k))
		}
		return n
	}
	sort.Slice(roots, func(i, j int) bool { return roots[i].SortOrder < roots[j].SortOrder })
	out := make([]CategoryNode, 0, len(roots))
	for _, r := range roots {
		out = append(out, walk(r))
	}
	return out
}
