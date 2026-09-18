package cache

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/novaspay/admin-api/internal/conf"
	"github.com/redis/go-redis/v9"
)

// Atomic GET+DEL for Redis < 6.2 (GETDEL unavailable).
var getDelScript = redis.NewScript(`
local v = redis.call('GET', KEYS[1])
if v == false then
  return false
end
redis.call('DEL', KEYS[1])
return v
`)

type Redis struct {
	Client *redis.Client
}

func NewRedis(cfg *conf.Config) (*Redis, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &Redis{Client: client}, nil
}

func (r *Redis) Set(ctx context.Context, key, val string, ttl time.Duration) error {
	return r.Client.Set(ctx, key, val, ttl).Err()
}

func (r *Redis) Get(ctx context.Context, key string) (string, error) {
	return r.Client.Get(ctx, key).Result()
}

// GetDel atomically reads and deletes a key (single-use tokens).
// Prefers Redis GETDEL; falls back to a Lua get+del script on older servers.
func (r *Redis) GetDel(ctx context.Context, key string) (string, error) {
	val, err := r.Client.GetDel(ctx, key).Result()
	if err == nil || err == redis.Nil {
		return val, err
	}
	if !isUnknownCommand(err) {
		return "", err
	}
	return getDelScript.Run(ctx, r.Client, []string{key}).Text()
}

func isUnknownCommand(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "unknown command")
}

func (r *Redis) Del(ctx context.Context, keys ...string) error {
	return r.Client.Del(ctx, keys...).Err()
}

func (r *Redis) Incr(ctx context.Context, key string) (int64, error) {
	return r.Client.Incr(ctx, key).Result()
}

func (r *Redis) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return r.Client.Expire(ctx, key, ttl).Err()
}
