-- ============================================================================
-- OKIN VIBEZZ: CLEAN RESET
-- Removes everything this project created in your database, so you can start again from zero.
--
-- WARNING: this DELETES the website data in the database (releases, tracks, gallery rows, pages,
-- events, messages, booking requests, settings and admin roles).
-- It does NOT delete your login accounts (Authentication > Users) or files in Storage.
--
-- Order:  1) reset_all.sql   2) setup_all.sql   3) first_admin.sql   4) check_setup.sql
-- ============================================================================

-- 1) Permissions on the media bucket (created by an earlier run of the setup)
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'media%' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
exception when others then raise notice 'Skipped storage policies: %', sqlerrm;
end $$;

-- 2) A sign-up trigger some older versions added (harmless if it does not exist)
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
exception when others then raise notice 'Skipped auth trigger: %', sqlerrm;
end $$;

-- 3) Tables. Dropping a table also removes its policies, triggers and indexes.
drop table if exists
  audit_logs, booking_private_notes, booking_enquiries, contact_messages, site_settings, social_links,
  release_platform_links, tracks, music_releases, gallery_items, pages, events, user_roles, profiles
cascade;

-- 4) Functions
drop function if exists cms_save_release(jsonb) cascade;
drop function if exists is_content_staff() cascade;
drop function if exists has_role(app_role) cascade;
drop function if exists touch_updated_at() cascade;
drop function if exists handle_new_user() cascade;

-- 5) Types (including any old copies with the wrong values)
drop type if exists content_status, release_type, app_role, booking_status cascade;
