package casbinx

import (
	"fmt"

	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"gorm.io/gorm"
)

// NewEnforcer builds a Casbin enforcer backed by the shared GORM DB (casbin_rule).
func NewEnforcer(db *gorm.DB) (*casbin.Enforcer, error) {
	a, err := gormadapter.NewAdapterByDB(db)
	if err != nil {
		return nil, fmt.Errorf("casbin adapter: %w", err)
	}
	m, err := model.NewModelFromString(ModelText())
	if err != nil {
		return nil, fmt.Errorf("casbin model: %w", err)
	}
	e, err := casbin.NewEnforcer(m, a)
	if err != nil {
		return nil, fmt.Errorf("casbin enforcer: %w", err)
	}
	e.EnableAutoSave(true)
	return e, nil
}
