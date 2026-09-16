package service

import (
	"context"
	"sort"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type MenuService struct {
	db *gorm.DB
}

func NewMenuService(db *gorm.DB) *MenuService {
	return &MenuService{db: db}
}

type MenuNode struct {
	ID        string      `json:"id"`
	ParentID  *string     `json:"parentId"`
	Key       string      `json:"key"`
	Title     string      `json:"title"`
	MenuType  string      `json:"menuType"`
	Path      string      `json:"path"`
	Icon      string      `json:"icon"`
	SortOrder int         `json:"sortOrder"`
	Hidden    bool        `json:"hidden"`
	Children  []MenuNode  `json:"children,omitempty"`
}

func (s *MenuService) Tree(ctx context.Context) ([]MenuNode, error) {
	var menus []persistence.Menu
	if err := s.db.WithContext(ctx).Order("sort_order ASC").Find(&menus).Error; err != nil {
		return nil, err
	}
	return buildMenuTree(menus), nil
}

type MenuInput struct {
	ID        string `json:"id"`
	ParentID  *string `json:"parentId"`
	Key       string `json:"key"`
	Title     string `json:"title"`
	MenuType  string `json:"menuType"`
	Path      string `json:"path"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sortOrder"`
	Hidden    bool   `json:"hidden"`
}

func (s *MenuService) ReplaceTree(ctx context.Context, items []MenuInput) ([]MenuNode, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1=1").Delete(&persistence.Menu{}).Error; err != nil {
			return err
		}
		for _, it := range items {
			id := it.ID
			if id == "" {
				id = uuid.NewString()
			}
			mt := it.MenuType
			if mt == "" {
				mt = "route"
			}
			m := persistence.Menu{
				ID: id, ParentID: it.ParentID, Key: it.Key, Title: it.Title,
				MenuType: mt, Path: it.Path, Icon: it.Icon, SortOrder: it.SortOrder, Hidden: it.Hidden,
			}
			if err := tx.Create(&m).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Tree(ctx)
}

func (s *MenuService) Create(ctx context.Context, in MenuInput) (*MenuNode, error) {
	if in.Key == "" || in.Title == "" {
		return nil, apperr.InvalidArgument
	}
	id := in.ID
	if id == "" {
		id = uuid.NewString()
	}
	mt := in.MenuType
	if mt == "" {
		mt = "route"
	}
	m := persistence.Menu{
		ID: id, ParentID: in.ParentID, Key: in.Key, Title: in.Title,
		MenuType: mt, Path: in.Path, Icon: in.Icon, SortOrder: in.SortOrder, Hidden: in.Hidden,
	}
	if err := s.db.WithContext(ctx).Create(&m).Error; err != nil {
		return nil, apperr.Wrap(40900, 409, "菜单冲突", err)
	}
	n := toMenuNode(m)
	return &n, nil
}

func (s *MenuService) Update(ctx context.Context, id string, in MenuInput) (*MenuNode, error) {
	var m persistence.Menu
	if err := s.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	updates := map[string]interface{}{
		"title": in.Title, "path": in.Path, "icon": in.Icon,
		"sort_order": in.SortOrder, "hidden": in.Hidden, "parent_id": in.ParentID,
	}
	if in.MenuType != "" {
		updates["menu_type"] = in.MenuType
	}
	if in.Key != "" {
		updates["key"] = in.Key
	}
	if err := s.db.WithContext(ctx).Model(&m).Updates(updates).Error; err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&m, "id = ?", id)
	n := toMenuNode(m)
	return &n, nil
}

func (s *MenuService) Delete(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Delete(&persistence.Menu{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	_ = s.db.WithContext(ctx).Where("menu_id = ?", id).Delete(&persistence.RoleMenu{}).Error
	return nil
}

func toMenuNode(m persistence.Menu) MenuNode {
	return MenuNode{
		ID: m.ID, ParentID: m.ParentID, Key: m.Key, Title: m.Title, MenuType: m.MenuType,
		Path: m.Path, Icon: m.Icon, SortOrder: m.SortOrder, Hidden: m.Hidden,
	}
}

func buildMenuTree(menus []persistence.Menu) []MenuNode {
	byParent := map[string][]persistence.Menu{}
	roots := make([]persistence.Menu, 0)
	for _, m := range menus {
		if m.ParentID == nil || *m.ParentID == "" {
			roots = append(roots, m)
		} else {
			byParent[*m.ParentID] = append(byParent[*m.ParentID], m)
		}
	}
	var walk func(m persistence.Menu) MenuNode
	walk = func(m persistence.Menu) MenuNode {
		n := toMenuNode(m)
		kids := byParent[m.ID]
		sort.Slice(kids, func(i, j int) bool { return kids[i].SortOrder < kids[j].SortOrder })
		for _, k := range kids {
			n.Children = append(n.Children, walk(k))
		}
		return n
	}
	sort.Slice(roots, func(i, j int) bool { return roots[i].SortOrder < roots[j].SortOrder })
	out := make([]MenuNode, 0, len(roots))
	for _, r := range roots {
		out = append(out, walk(r))
	}
	return out
}
