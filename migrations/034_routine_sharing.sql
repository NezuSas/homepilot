-- Additive, private-by-default access lists. Ownership and existing data are unchanged.
ALTER TABLE scenes ADD COLUMN shared_user_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE automation_rules ADD COLUMN shared_user_ids TEXT NOT NULL DEFAULT '[]';
