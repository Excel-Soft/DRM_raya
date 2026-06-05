-- Stage 1A auth security: deprecate the legacy plaintext `password` column.
-- New writes only populate `password_hash` (bcrypt); the legacy column is no
-- longer required and must allow NULL so user creation no longer stores plaintext.
ALTER TABLE "drm"."users" ALTER COLUMN "password" DROP NOT NULL;
