-- Development-only credential, localhost binding. Choose separate secrets for production.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='campus_geo_reader') THEN
  CREATE ROLE campus_geo_reader LOGIN PASSWORD 'local-spatial-reader-only';
END IF; END $$;
GRANT CONNECT ON DATABASE campus_spatial TO campus_geo_reader;
GRANT USAGE ON SCHEMA geo TO campus_geo_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA geo TO campus_geo_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE spatial IN SCHEMA geo GRANT SELECT ON TABLES TO campus_geo_reader;
