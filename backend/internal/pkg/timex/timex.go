package timex

import "time"

// Now 返回 UTC Unix 秒时间戳（业务时间统一存秒级时间戳，查询侧再按时区展示）。
func Now() int64 {
	return time.Now().UTC().Unix()
}

// Ptr 将时间戳转为指针；0 视为空。
func Ptr(ts int64) *int64 {
	if ts == 0 {
		return nil
	}
	return &ts
}

// Val 解引用时间戳指针。
func Val(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// FormatUTC 将 Unix 秒时间戳格式化为 UTC 字符串。
func FormatUTC(ts int64) string {
	return time.Unix(ts, 0).UTC().Format("2006-01-02 15:04:05")
}
