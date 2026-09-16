package casbinx

// ModelText returns the Casbin model conf (§3.2) with keyMatch for app:ALL.
func ModelText() string {
	return `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && (
      r.obj == p.obj ||
      (keyMatch(r.obj, "app:*") && p.obj == "app:ALL")
    ) && r.act == p.act
`
}
