-- 003_m3_menus.sql
-- M3 模块菜单初始化：风控规则、商户审核、告警与通知
-- 使用确定性 UUID（与 seed.go 的 menuID() 逻辑一致：uuid.NewSHA1(NameSpaceOID, "novaspay/menu/"+logical)）
-- 幂等：ON CONFLICT (key) DO NOTHING

-- 父级菜单（root_core / root_gateway / root_ops）已由 seed.go 保证存在，此处只插入 M3 新增叶子菜单

INSERT INTO menus (id, parent_id, key, title, menu_type, path, icon, sort_order, hidden, created_at, updated_at)
VALUES
  ('3d70188a-2f8c-5017-99a5-0fc551073ced', '2a091798-7508-537b-a088-265402137525',
   'risk_rules', '风控规则与黑名单', 'route', '/risk-rules', 'Shield', 6, false,
   EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint),
  ('ab0335f7-36b7-547c-88c5-12c408013241', 'b38f22c7-2d99-54b1-992a-58c11adaa27e',
   'merchant_review', '商户/KYB 审核', 'route', '/merchant-review', 'FileText', 8, false,
   EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint),
  ('e216c8ec-0783-5fe3-a25e-c1a44804f88e', 'b097e02b-2200-529c-b64f-08634b310fcc',
   'alerts', '告警与通知', 'route', '/alerts', 'BellRing', 1, false,
   EXTRACT(EPOCH FROM NOW())::bigint, EXTRACT(EPOCH FROM NOW())::bigint)
ON CONFLICT (key) DO NOTHING;
