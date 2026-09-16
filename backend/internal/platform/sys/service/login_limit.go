package service

import (
	"context"
	"strconv"
	"time"

	"github.com/novaspay/admin-api/internal/pkg/apperr"
	"github.com/redis/go-redis/v9"
)

const (
	loginFailKeyPrefix     = "novas:login:fail:"
	loginMaxFailuresPerMin = 5
	loginFailWindow        = time.Minute
	loginLockDuration      = 15 * time.Minute
)

func loginFailKey(ip string) string {
	return loginFailKeyPrefix + ip
}

func (s *AuthService) CheckLoginRateLimit(ctx context.Context, ip string) error {
	key := loginFailKey(ip)
	val, err := s.rdb.Get(ctx, key)
	if err != nil {
		if err == redis.Nil {
			return nil
		}
		return nil
	}
	count, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return nil
	}
	if count >= loginMaxFailuresPerMin {
		return apperr.LoginLocked
	}
	return nil
}

func (s *AuthService) RecordLoginFailure(ctx context.Context, ip string) {
	key := loginFailKey(ip)
	count, err := s.rdb.Incr(ctx, key)
	if err != nil {
		return
	}
	if count == 1 {
		_ = s.rdb.Expire(ctx, key, loginFailWindow)
	}
	if count >= loginMaxFailuresPerMin {
		_ = s.rdb.Expire(ctx, key, loginLockDuration)
	}
}

func (s *AuthService) ClearLoginFailures(ctx context.Context, ip string) {
	_ = s.rdb.Del(ctx, loginFailKey(ip))
}
