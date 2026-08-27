-- Official Supabase jwt.sql: store JWT settings on the database.
-- https://github.com/supabase/supabase/blob/master/docker/volumes/db/jwt.sql
\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
