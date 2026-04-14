-- Assistant V3 Quality Layer
ALTER TABLE assistant_findings ADD COLUMN score INTEGER DEFAULT 0;
ALTER TABLE assistant_findings ADD COLUMN dismissed_until TEXT;
