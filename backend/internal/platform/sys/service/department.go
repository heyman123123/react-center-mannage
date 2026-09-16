package service

import (
	"context"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/infra/persistence"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

type DepartmentService struct {
	db *gorm.DB
}

func NewDepartmentService(db *gorm.DB) *DepartmentService {
	return &DepartmentService{db: db}
}

type DeptNode struct {
	ID          string     `json:"id"`
	ParentID    *string    `json:"parentId"`
	Name        string     `json:"name"`
	Code        string     `json:"code"`
	SortOrder   int        `json:"sortOrder"`
	Leader      string     `json:"leader"`
	Description string     `json:"description"`
	RoleKeys    []string   `json:"roleKeys"`
	MemberIDs   []string   `json:"memberIds"`
	Children    []DeptNode `json:"children,omitempty"`
}

type DeptInput struct {
	ParentID    *string  `json:"parentId"`
	Name        string   `json:"name"`
	Code        string   `json:"code"`
	SortOrder   int      `json:"sortOrder"`
	Leader      string   `json:"leader"`
	Description string   `json:"description"`
	RoleKeys    []string `json:"roleKeys"`
	MemberIDs   []string `json:"memberIds"`
}

func (s *DepartmentService) Tree(ctx context.Context) ([]DeptNode, error) {
	var depts []persistence.Department
	if err := s.db.WithContext(ctx).Order("sort_order ASC").Find(&depts).Error; err != nil {
		return nil, err
	}
	nodes := make([]DeptNode, 0, len(depts))
	for _, d := range depts {
		n, err := s.toNode(ctx, &d)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, *n)
	}
	return buildDeptTree(nodes), nil
}

func (s *DepartmentService) Create(ctx context.Context, in DeptInput) (*DeptNode, error) {
	if in.Name == "" || in.Code == "" {
		return nil, apperr.InvalidArgument
	}
	d := persistence.Department{
		ID: uuid.NewString(), ParentID: in.ParentID, Name: in.Name, Code: in.Code,
		SortOrder: in.SortOrder, Leader: in.Leader, Description: in.Description,
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&d).Error; err != nil {
			return apperr.Wrap(40900, 409, "部门编码冲突", err)
		}
		return s.replaceBindings(tx, d.ID, in.RoleKeys, in.MemberIDs)
	})
	if err != nil {
		return nil, err
	}
	return s.toNode(ctx, &d)
}

func (s *DepartmentService) Update(ctx context.Context, id string, in DeptInput) (*DeptNode, error) {
	var d persistence.Department
	if err := s.db.WithContext(ctx).First(&d, "id = ?", id).Error; err != nil {
		return nil, apperr.NotFound
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"name": in.Name, "leader": in.Leader, "description": in.Description,
			"sort_order": in.SortOrder, "parent_id": in.ParentID,
		}
		if in.Code != "" {
			updates["code"] = in.Code
		}
		if err := tx.Model(&d).Updates(updates).Error; err != nil {
			return err
		}
		if in.RoleKeys != nil || in.MemberIDs != nil {
			rk, mk := in.RoleKeys, in.MemberIDs
			if rk == nil {
				var drs []persistence.DepartmentRole
				tx.Where("department_id = ?", id).Find(&drs)
				rk = make([]string, 0, len(drs))
				for _, dr := range drs {
					rk = append(rk, dr.RoleKey)
				}
			}
			if mk == nil {
				var uds []persistence.UserDepartment
				tx.Where("department_id = ?", id).Find(&uds)
				mk = make([]string, 0, len(uds))
				for _, ud := range uds {
					mk = append(mk, ud.UserID)
				}
			}
			return s.replaceBindings(tx, id, rk, mk)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	_ = s.db.WithContext(ctx).First(&d, "id = ?", id)
	return s.toNode(ctx, &d)
}

func (s *DepartmentService) Delete(ctx context.Context, id string) error {
	var child int64
	s.db.WithContext(ctx).Model(&persistence.Department{}).Where("parent_id = ?", id).Count(&child)
	if child > 0 {
		return apperr.New(40902, 409, "请先删除或转移子部门")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tx.Where("department_id = ?", id).Delete(&persistence.DepartmentRole{})
		tx.Where("department_id = ?", id).Delete(&persistence.UserDepartment{})
		res := tx.Delete(&persistence.Department{}, "id = ?", id)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return apperr.NotFound
		}
		return nil
	})
}

// Transfer moves a department under a new parent, or moves a user to target department.
func (s *DepartmentService) Transfer(ctx context.Context, deptID, newParentID, userID, targetDeptID string) error {
	if userID != "" && targetDeptID != "" {
		return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			tx.Where("user_id = ?", userID).Delete(&persistence.UserDepartment{})
			return tx.Create(&persistence.UserDepartment{UserID: userID, DepartmentID: targetDeptID}).Error
		})
	}
	if deptID == "" {
		return apperr.InvalidArgument
	}
	var d persistence.Department
	if err := s.db.WithContext(ctx).First(&d, "id = ?", deptID).Error; err != nil {
		return apperr.NotFound
	}
	var parent *string
	if newParentID != "" {
		if newParentID == deptID {
			return apperr.InvalidArgument
		}
		parent = &newParentID
	}
	return s.db.WithContext(ctx).Model(&d).Update("parent_id", parent).Error
}

func (s *DepartmentService) replaceBindings(tx *gorm.DB, deptID string, roleKeys, memberIDs []string) error {
	if roleKeys != nil {
		if err := tx.Where("department_id = ?", deptID).Delete(&persistence.DepartmentRole{}).Error; err != nil {
			return err
		}
		for _, k := range roleKeys {
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			if err := tx.Create(&persistence.DepartmentRole{DepartmentID: deptID, RoleKey: k}).Error; err != nil {
				return err
			}
		}
	}
	if memberIDs != nil {
		if err := tx.Where("department_id = ?", deptID).Delete(&persistence.UserDepartment{}).Error; err != nil {
			return err
		}
		for _, uid := range memberIDs {
			if uid == "" {
				continue
			}
			if err := tx.Create(&persistence.UserDepartment{UserID: uid, DepartmentID: deptID}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *DepartmentService) toNode(ctx context.Context, d *persistence.Department) (*DeptNode, error) {
	var drs []persistence.DepartmentRole
	s.db.WithContext(ctx).Where("department_id = ?", d.ID).Find(&drs)
	rk := make([]string, 0, len(drs))
	for _, dr := range drs {
		rk = append(rk, dr.RoleKey)
	}
	var uds []persistence.UserDepartment
	s.db.WithContext(ctx).Where("department_id = ?", d.ID).Find(&uds)
	mids := make([]string, 0, len(uds))
	for _, ud := range uds {
		mids = append(mids, ud.UserID)
	}
	return &DeptNode{
		ID: d.ID, ParentID: d.ParentID, Name: d.Name, Code: d.Code, SortOrder: d.SortOrder,
		Leader: d.Leader, Description: d.Description, RoleKeys: rk, MemberIDs: mids,
	}, nil
}

func buildDeptTree(flat []DeptNode) []DeptNode {
	byParent := map[string][]DeptNode{}
	roots := make([]DeptNode, 0)
	for _, n := range flat {
		if n.ParentID == nil || *n.ParentID == "" {
			roots = append(roots, n)
		} else {
			byParent[*n.ParentID] = append(byParent[*n.ParentID], n)
		}
	}
	var walk func(n DeptNode) DeptNode
	walk = func(n DeptNode) DeptNode {
		kids := byParent[n.ID]
		sort.Slice(kids, func(i, j int) bool { return kids[i].SortOrder < kids[j].SortOrder })
		for _, k := range kids {
			n.Children = append(n.Children, walk(k))
		}
		return n
	}
	sort.Slice(roots, func(i, j int) bool { return roots[i].SortOrder < roots[j].SortOrder })
	out := make([]DeptNode, 0, len(roots))
	for _, r := range roots {
		out = append(out, walk(r))
	}
	return out
}
