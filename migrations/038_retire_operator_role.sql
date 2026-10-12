-- The legacy 'operator' role is retired. Existing accounts keep the access they already had:
-- 'operator' behaved like a family member, so they become 'parent'. Other users are untouched.
UPDATE users SET role = 'parent', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE role = 'operator';
