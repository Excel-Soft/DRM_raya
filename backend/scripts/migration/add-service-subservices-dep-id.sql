-- drm.service_subservices lacks dep_id (services and service_sub_subservices have it), so
-- create/update of a sub-service on DRM Setting -> Attributes returned 500
-- ("column dep_id does not exist"). Same type as the sibling tables. Additive.
-- Rollback: add-service-subservices-dep-id.rollback.sql
ALTER TABLE drm.service_subservices ADD COLUMN IF NOT EXISTS dep_id integer;
