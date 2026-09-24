// Package tenant 提供统一的租户数据隔离过滤逻辑。
//
// 约定：tenantID 为空、"ALL"、"group_hq" 时表示跨租户/总部视角，不加租户过滤；
// 其余值视为具体租户，追加 WHERE tenant_id = ?。
package tenant

import "gorm.io/gorm"

// ShouldFilter 判断是否需要按租户过滤：tenantID 非空、非 ALL、非 group_hq 时返回 true。
func ShouldFilter(tenantID string) bool {
	return tenantID != "" && tenantID != "ALL" && tenantID != "group_hq"
}

// Apply 向查询追加租户过滤条件（如果需要）。返回传入的 q 以便链式调用。
func Apply(q *gorm.DB, tenantID string) *gorm.DB {
	if q == nil {
		return q
	}
	if ShouldFilter(tenantID) {
		q = q.Where("tenant_id = ?", tenantID)
	}
	return q
}

// FilterFunc 是 sharding 兼容的过滤函数签名。
type FilterFunc func(q *gorm.DB) *gorm.DB

// Filter 返回一个闭包，调用时向 q 追加租户过滤（如果需要）。
// 注意：调用方通常仍需自行追加 deleted_at IS NULL 等基础条件；本函数只负责租户维度。
func Filter(tenantID string) FilterFunc {
	return func(q *gorm.DB) *gorm.DB {
		return Apply(q, tenantID)
	}
}
