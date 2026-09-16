package service

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"gorm.io/gorm"
)

func unmarshalJSON[T any](raw string) (T, error) {
	var item T
	if err := json.Unmarshal([]byte(raw), &item); err != nil {
		return item, err
	}
	return item, nil
}

func marshalJSON[T any](item T) (string, error) {
	b, err := json.Marshal(item)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func listDataJSON[T any](ctx context.Context, db *gorm.DB, model any, order string) ([]T, error) {
	rows, err := fetchDataJSONRows(ctx, db, model, order)
	if err != nil {
		return nil, err
	}
	out := make([]T, 0, len(rows))
	for _, raw := range rows {
		item, err := unmarshalJSON[T](raw)
		if err != nil {
			continue
		}
		out = append(out, item)
	}
	return out, nil
}

func fetchDataJSONRows(ctx context.Context, db *gorm.DB, model any, order string) ([]string, error) {
	type row struct {
		DataJSON string `gorm:"column:data_json"`
	}
	var rows []row
	if err := db.WithContext(ctx).Model(model).Select("data_json").Order(order).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]string, 0, len(rows))
	for _, r := range rows {
		out = append(out, r.DataJSON)
	}
	return out, nil
}

func getDataJSON[T any](ctx context.Context, db *gorm.DB, model any, id string) (*T, error) {
	type row struct {
		DataJSON string `gorm:"column:data_json"`
	}
	var r row
	if err := db.WithContext(ctx).Model(model).Select("data_json").Where("id = ?", id).First(&r).Error; err != nil {
		return nil, apperr.NotFound
	}
	item, err := unmarshalJSON[T](r.DataJSON)
	if err != nil {
		return nil, apperr.Internal
	}
	return &item, nil
}

func deleteByID(ctx context.Context, db *gorm.DB, model any, id string) error {
	res := db.WithContext(ctx).Where("id = ?", id).Delete(model)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return apperr.NotFound
	}
	return nil
}

func newID() string {
	return uuid.NewString()
}
