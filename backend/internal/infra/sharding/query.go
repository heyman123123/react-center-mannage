package sharding

import (
	"context"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

type FilterFunc func(db *gorm.DB) *gorm.DB

// CountAcross sums COUNT(*) per month table (newest-first order not required).
func (s *Shards) CountAcross(ctx context.Context, base string, months []string, filter FilterFunc) (int64, error) {
	var total int64
	for _, ym := range months {
		if !s.db.Migrator().HasTable(Table(base, ym)) {
			continue
		}
		q := s.db.WithContext(ctx).Table(Table(base, ym))
		if filter != nil {
			q = filter(q)
		}
		var n int64
		if err := q.Count(&n).Error; err != nil {
			return 0, err
		}
		total += n
	}
	return total, nil
}

// PaginateAcross walks months newest-first and fills one page.
func PaginateAcross[T any](
	ctx context.Context,
	db *gorm.DB,
	base string,
	months []string,
	page, pageSize int,
	filter FilterFunc,
	scan func(*gorm.DB) ([]T, error),
) ([]T, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	total, err := CountAcrossGeneric(ctx, db, base, months, filter)
	if err != nil {
		return nil, 0, err
	}
	skip := (page - 1) * pageSize
	need := pageSize
	var out []T
	for _, ym := range months {
		tbl := Table(base, ym)
		if !db.Migrator().HasTable(tbl) {
			continue
		}
		q := db.WithContext(ctx).Table(tbl)
		if filter != nil {
			q = filter(q)
		}
		var monthCount int64
		if err := q.Count(&monthCount).Error; err != nil {
			return nil, 0, err
		}
		if skip >= int(monthCount) {
			skip -= int(monthCount)
			continue
		}
		q = db.WithContext(ctx).Table(tbl).Order("created_at DESC")
		if filter != nil {
			q = filter(q)
		}
		if skip > 0 {
			q = q.Offset(skip)
		}
		q = q.Limit(need)
		chunk, err := scan(q)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, chunk...)
		need -= len(chunk)
		skip = 0
		if need <= 0 {
			break
		}
	}
	return out, total, nil
}

func CountAcrossGeneric(ctx context.Context, db *gorm.DB, base string, months []string, filter FilterFunc) (int64, error) {
	sh := &Shards{db: db}
	return sh.CountAcross(ctx, base, months, filter)
}

// FindFirstAcross scans months newest-first until one row matches.
func (s *Shards) FindFirstAcross(ctx context.Context, base string, months []string, filter FilterFunc, dest interface{}) (string, error) {
	for _, ym := range months {
		tbl := Table(base, ym)
		if !s.db.Migrator().HasTable(tbl) {
			continue
		}
		q := s.db.WithContext(ctx).Table(tbl)
		if filter != nil {
			q = filter(q)
		}
		err := q.First(dest).Error
		if err == nil {
			return tbl, nil
		}
		if err == gorm.ErrRecordNotFound {
			continue
		}
		return "", err
	}
	return "", gorm.ErrRecordNotFound
}

var displayIDDateRe = regexp.MustCompile(`^TX-(\d{8})-`)

// MonthHintFromTransactionID parses TX-YYYYMMDD- from display id.
func MonthHintFromTransactionID(id string) string {
	m := displayIDDateRe.FindStringSubmatch(strings.TrimSpace(id))
	if len(m) < 2 || len(m[1]) != 8 {
		return ""
	}
	return m[1][:6]
}

// ScanMonthsForLookup orders months for id lookup: hint month first, then recent months.
func ScanMonthsForLookup(hintYYYYMM string) []string {
	recent := RecentMonthsNewestFirst(DefaultListMonths)
	if hintYYYYMM == "" {
		return recent
	}
	out := []string{hintYYYYMM}
	for _, ym := range recent {
		if ym != hintYYYYMM {
			out = append(out, ym)
		}
	}
	return out
}
