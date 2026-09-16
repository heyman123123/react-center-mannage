package conf

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr        string
	Mode            string // debug|release
	PostgresDSN     string
	RedisAddr       string
	RedisPassword   string
	RedisDB         int
	CORSOrigins     []string
	CookieSecure    bool
	CookieDomain    string
	AccessTTL       time.Duration
	RefreshTTL      time.Duration
	JWTSecret       string
	DefaultAppEnv   string
	DataKey         string
}

func Load() *Config {
	accessTTL, _ := time.ParseDuration(getenv("NOVAS_ACCESS_TTL", "2h"))
	refreshTTL, _ := time.ParseDuration(getenv("NOVAS_REFRESH_TTL", "168h"))
	redisDB, _ := strconv.Atoi(getenv("NOVAS_REDIS_DB", "0"))
	origins := strings.Split(getenv("NOVAS_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return &Config{
		HTTPAddr:      getenv("NOVAS_HTTP_ADDR", ":8080"),
		Mode:          getenv("NOVAS_MODE", "debug"),
		PostgresDSN:   getenv("NOVAS_POSTGRES_DSN", "host=127.0.0.1 user=novas password=novas dbname=novaspay port=5433 sslmode=disable TimeZone=UTC"),
		RedisAddr:     getenv("NOVAS_REDIS_ADDR", "127.0.0.1:6380"),
		RedisPassword: getenv("NOVAS_REDIS_PASSWORD", ""),
		RedisDB:       redisDB,
		CORSOrigins:   origins,
		CookieSecure:  getenv("NOVAS_COOKIE_SECURE", "false") == "true",
		CookieDomain:  getenv("NOVAS_COOKIE_DOMAIN", ""),
		AccessTTL:     accessTTL,
		RefreshTTL:    refreshTTL,
		JWTSecret:     getenv("NOVAS_JWT_SECRET", "dev-change-me-novaspay-admin-secret"),
		DefaultAppEnv: getenv("NOVAS_DEFAULT_APP_ENV", "live"),
		DataKey:       getenv("NOVAS_DATA_KEY", ""),
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
