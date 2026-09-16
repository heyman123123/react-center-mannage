-- 初始化语言（快照；运行时由 migrations.ApplySeed 幂等写入）
INSERT INTO languages (code, name, enabled, sort_order) VALUES
  ('zh-CN', '简体中文', true, 1),
  ('en-US', 'English', true, 2)
ON CONFLICT (code) DO NOTHING;
