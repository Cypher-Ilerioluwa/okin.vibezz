-- ============================================================================
-- OKIN VIBEZZ: COMPLETE DATABASE SETUP (migrations 0001 to 0004 in one file)
-- Safe to run more than once, and from any starting point: it only creates what is missing
-- and refreshes security policies. Run it in the Supabase SQL editor, then run check_setup.sql.
-- ============================================================================


-- ------------------------------------------------------------
-- 1) Foundation: types, tables, roles, security
-- ------------------------------------------------------------
create extension if not exists pgcrypto;
do $$ begin create type content_status as enum('draft','published','scheduled','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type release_type as enum('single','ep','album'); exception when duplicate_object then null; end $$;
do $$ begin create type app_role as enum('super_admin','editor','author','booking_manager'); exception when duplicate_object then null; end $$;
do $$ begin create type booking_status as enum('new','reviewing','awaiting_information','accepted','declined','cancelled'); exception when duplicate_object then null; end $$;

-- Safety check: if an OLD copy of one of these lists already exists with different values, stop with a clear message.
do $$
declare want jsonb := '{"content_status":["draft","published","scheduled","archived"],"release_type":["single","ep","album"],"app_role":["super_admin","editor","author","booking_manager"],"booking_status":["new","reviewing","awaiting_information","accepted","declined","cancelled"]}';
        tname text; lbl text;
begin
  for tname in select jsonb_object_keys(want) loop
    for lbl in select jsonb_array_elements_text(want -> tname) loop
      if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = tname and e.enumlabel = lbl) then
        raise exception 'Your database has an older "%" list that is missing "%". Run reset_all.sql once, then run this file again.', tname, lbl;
      end if;
    end loop;
  end loop;
end $$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create table if not exists profiles(id uuid primary key references auth.users on delete cascade,full_name text,avatar_url text,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists user_roles(user_id uuid not null references profiles on delete cascade,role app_role not null,primary key(user_id,role));

create or replace function has_role(r app_role) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from user_roles ur join profiles p on p.id=ur.user_id where ur.user_id=auth.uid() and ur.role=r and p.is_active) $$;
create or replace function is_content_staff() returns boolean language sql stable security definer set search_path=public as
$$ select has_role('super_admin') or has_role('editor') $$;

create table if not exists music_releases(id uuid primary key default gen_random_uuid(),title text not null,slug text not null unique,release_type release_type not null,cover_url text,release_date date,genre text,description text,label text,status content_status not null default 'draft',featured boolean not null default false,published_at timestamptz,seo_title text,seo_description text,created_by uuid references profiles on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'published' or published_at is not null));
create table if not exists tracks(id uuid primary key default gen_random_uuid(),release_id uuid not null references music_releases on delete cascade,track_number int not null,title text not null,duration_seconds int,featured_artists text,producer_credit text,songwriter_credit text,unique(release_id,track_number));
create table if not exists release_platform_links(id uuid primary key default gen_random_uuid(),release_id uuid not null references music_releases on delete cascade,platform text not null,url text not null check(url ~ '^https://'),is_primary boolean not null default false,display_order int not null default 0);
create table if not exists social_links(id uuid primary key default gen_random_uuid(),platform text not null,label text,url text not null check(url ~ '^https://'),icon_key text,sort_order int not null default 0,is_visible boolean not null default true);
create table if not exists site_settings(id boolean primary key default true check(id),data jsonb not null default '{}',updated_at timestamptz not null default now());
create table if not exists contact_messages(id uuid primary key default gen_random_uuid(),name text not null check(length(name)<=120),email text not null check(length(email)<=254),subject text check(length(subject)<=200),message text not null check(length(message)<=5000),status text not null default 'new',created_at timestamptz not null default now());
create table if not exists booking_enquiries(id uuid primary key default gen_random_uuid(),reference text not null unique,details jsonb not null,status booking_status not null default 'new',decision_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists booking_private_notes(id uuid primary key default gen_random_uuid(),enquiry_id uuid not null references booking_enquiries on delete cascade,author_id uuid references profiles on delete set null,note text not null,created_at timestamptz not null default now());
create table if not exists audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references profiles on delete set null,action text not null,entity_type text,entity_id text,metadata jsonb,created_at timestamptz not null default now());
create index if not exists tracks_release_id_idx on tracks(release_id);
create index if not exists release_platform_links_release_id_idx on release_platform_links(release_id);
create index if not exists music_releases_status_release_date_idx on music_releases(status,release_date desc);
create index if not exists booking_enquiries_status_created_at_idx on booking_enquiries(status,created_at desc);

drop trigger if exists t1 on music_releases;
create trigger t1 before update on music_releases for each row execute function touch_updated_at();
drop trigger if exists t2 on booking_enquiries;
create trigger t2 before update on booking_enquiries for each row execute function touch_updated_at();
drop trigger if exists t3 on profiles;
create trigger t3 before update on profiles for each row execute function touch_updated_at();

do $$ declare t text; begin
 for t in select unnest(array['profiles','user_roles','music_releases','tracks','release_platform_links','social_links','site_settings','contact_messages','booking_enquiries','booking_private_notes','audit_logs']) loop
  execute format('alter table %I enable row level security',t); end loop; end $$;

-- Public read: only published, due content
drop policy if exists pub_releases on music_releases;
create policy pub_releases on music_releases for select using(status='published' and published_at<=now());
drop policy if exists pub_tracks on tracks;
create policy pub_tracks on tracks for select using(exists(select 1 from music_releases r where r.id=release_id and r.status='published' and r.published_at<=now()));
drop policy if exists pub_links on release_platform_links;
create policy pub_links on release_platform_links for select using(exists(select 1 from music_releases r where r.id=release_id and r.status='published' and r.published_at<=now()));
drop policy if exists pub_social on social_links;
create policy pub_social on social_links for select using(is_visible);
drop policy if exists pub_settings on site_settings;
create policy pub_settings on site_settings for select using(true);
-- Staff write
drop policy if exists staff_releases on music_releases;
create policy staff_releases on music_releases for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists staff_tracks on tracks;
create policy staff_tracks on tracks for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists staff_links on release_platform_links;
create policy staff_links on release_platform_links for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists staff_social on social_links;
create policy staff_social on social_links for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists admin_settings on site_settings;
create policy admin_settings on site_settings for all using(has_role('super_admin')) with check(has_role('super_admin'));
drop policy if exists author_drafts_ins on music_releases;
create policy author_drafts_ins on music_releases for insert with check(has_role('author') and status='draft' and created_by=auth.uid());
drop policy if exists author_drafts_upd on music_releases;
create policy author_drafts_upd on music_releases for update using(has_role('author') and status='draft' and created_by=auth.uid()) with check(status='draft' and created_by=auth.uid());
-- Private data: no anon access; inserts come from Edge Functions using the service role
drop policy if exists contact_staff on contact_messages;
create policy contact_staff on contact_messages for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists booking_staff on booking_enquiries;
create policy booking_staff on booking_enquiries for all using(is_content_staff() or has_role('booking_manager')) with check(is_content_staff() or has_role('booking_manager'));
drop policy if exists notes_staff on booking_private_notes;
create policy notes_staff on booking_private_notes for all using(is_content_staff() or has_role('booking_manager')) with check(is_content_staff() or has_role('booking_manager'));
drop policy if exists audit_read on audit_logs;
create policy audit_read on audit_logs for select using(has_role('super_admin'));
drop policy if exists profile_self on profiles;
create policy profile_self on profiles for select using(id=auth.uid() or has_role('super_admin'));
drop policy if exists roles_read on user_roles;
create policy roles_read on user_roles for select using(user_id=auth.uid() or has_role('super_admin'));
drop policy if exists roles_admin on user_roles;
create policy roles_admin on user_roles for all using(has_role('super_admin')) with check(has_role('super_admin'));
drop policy if exists profile_admin on profiles;
create policy profile_admin on profiles for all using(has_role('super_admin')) with check(has_role('super_admin'));


-- ------------------------------------------------------------
-- 2) Gallery items, pages, form spam protection
-- ------------------------------------------------------------
create table if not exists gallery_items(id uuid primary key default gen_random_uuid(),media_type text not null check(media_type in('photo','video')),title text not null,caption text,media_url text,thumbnail_url text,video_id text check(video_id ~ '^[A-Za-z0-9_-]{11}$'),alt_text text,credit text,category text,featured boolean not null default false,status content_status not null default 'draft',sort_order int not null default 0,published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status<>'published' or published_at is not null));
create table if not exists pages(id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,body text,seo_description text,status content_status not null default 'draft',published_at timestamptz,updated_at timestamptz not null default now());
alter table contact_messages add column if not exists ip_hash text;
alter table booking_enquiries add column if not exists ip_hash text;
create index if not exists contact_messages_ip_hash_created_at_idx on contact_messages(ip_hash,created_at);
create index if not exists booking_enquiries_ip_hash_created_at_idx on booking_enquiries(ip_hash,created_at);
alter table gallery_items enable row level security;
alter table pages enable row level security;
drop policy if exists pub_gallery on gallery_items;
create policy pub_gallery on gallery_items for select using(status='published' and published_at<=now());
drop policy if exists staff_gallery on gallery_items;
create policy staff_gallery on gallery_items for all using(is_content_staff()) with check(is_content_staff());
drop policy if exists pub_pages on pages;
create policy pub_pages on pages for select using(status='published' and published_at<=now());
drop policy if exists staff_pages on pages;
create policy staff_pages on pages for all using(is_content_staff()) with check(is_content_staff());
drop trigger if exists t4 on gallery_items;
create trigger t4 before update on gallery_items for each row execute function touch_updated_at();


-- ------------------------------------------------------------
-- 3) Live events
-- ------------------------------------------------------------
-- Live dates for the /live/ page. Public can read published, upcoming rows; content staff manage them.
create table if not exists events(id uuid primary key default gen_random_uuid(),title text not null,event_date date not null,city text,country text,venue text,ticket_url text check(ticket_url is null or ticket_url ~ '^https://'),description text,status content_status not null default 'draft',published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status<>'published' or published_at is not null));
alter table events enable row level security;
drop policy if exists pub_events on events;
create policy pub_events on events for select using(status='published' and published_at<=now());
drop policy if exists staff_events on events;
create policy staff_events on events for all using(is_content_staff()) with check(is_content_staff());
drop trigger if exists t5 on events;
create trigger t5 before update on events for each row execute function touch_updated_at();


-- ------------------------------------------------------------
-- 4) CMS: settings access, media storage, save-release function
-- ------------------------------------------------------------
-- CMS support: media storage, settings permissions, atomic release saving.

-- 1) Editors (super_admin + editor) may edit site settings (was super_admin only)
drop policy if exists admin_settings on site_settings;
drop policy if exists staff_settings on site_settings;
create policy staff_settings on site_settings for all using(is_content_staff()) with check(is_content_staff());
insert into site_settings(id,data) values(true,'{}') on conflict(id) do nothing;

-- 2) Public media bucket: anyone can read, only content staff can write
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media','media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "media read" on storage.objects;
drop policy if exists "media staff insert" on storage.objects;
drop policy if exists "media staff update" on storage.objects;
drop policy if exists "media staff delete" on storage.objects;
create policy "media read" on storage.objects for select using(bucket_id='media');
create policy "media staff insert" on storage.objects for insert to authenticated with check(bucket_id='media' and public.is_content_staff());
create policy "media staff update" on storage.objects for update to authenticated using(bucket_id='media' and public.is_content_staff());
create policy "media staff delete" on storage.objects for delete to authenticated using(bucket_id='media' and public.is_content_staff());

-- 3) Save a release with its tracks and platform links in one transaction.
--    SECURITY INVOKER: row level security still applies to the calling user.
create or replace function cms_save_release(p jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare r jsonb := p->'release'; rid uuid;
begin
  if coalesce(r->>'id','') = '' then
    insert into music_releases(title,slug,release_type,cover_url,release_date,genre,label,description,featured,status,published_at,seo_title,seo_description,created_by)
    values(r->>'title',r->>'slug',(r->>'release_type')::release_type,nullif(r->>'cover_url',''),nullif(r->>'release_date','')::date,nullif(r->>'genre',''),nullif(r->>'label',''),nullif(r->>'description',''),coalesce((r->>'featured')::boolean,false),(r->>'status')::content_status,nullif(r->>'published_at','')::timestamptz,nullif(r->>'seo_title',''),nullif(r->>'seo_description',''),auth.uid())
    returning id into rid;
  else
    rid := (r->>'id')::uuid;
    update music_releases set title=r->>'title',slug=r->>'slug',release_type=(r->>'release_type')::release_type,cover_url=nullif(r->>'cover_url',''),release_date=nullif(r->>'release_date','')::date,genre=nullif(r->>'genre',''),label=nullif(r->>'label',''),description=nullif(r->>'description',''),featured=coalesce((r->>'featured')::boolean,false),status=(r->>'status')::content_status,published_at=nullif(r->>'published_at','')::timestamptz,seo_title=nullif(r->>'seo_title',''),seo_description=nullif(r->>'seo_description','')
    where id=rid;
    if not found then raise exception 'Release not found'; end if;
  end if;
  delete from tracks where release_id=rid;
  insert into tracks(release_id,track_number,title,duration_seconds,featured_artists,producer_credit)
  select rid,(t->>'track_number')::int,t->>'title',nullif(t->>'duration_seconds','')::int,nullif(t->>'featured_artists',''),nullif(t->>'producer_credit','')
  from jsonb_array_elements(coalesce(p->'tracks','[]'::jsonb)) t;
  delete from release_platform_links where release_id=rid;
  insert into release_platform_links(release_id,platform,url,is_primary,display_order)
  select rid,l->>'platform',l->>'url',coalesce((l->>'is_primary')::boolean,false),coalesce((l->>'display_order')::int,0)
  from jsonb_array_elements(coalesce(p->'links','[]'::jsonb)) l;
  return rid;
end $$;
grant execute on function cms_save_release(jsonb) to authenticated;

-- 4) Handy index for the gallery order
create index if not exists gallery_order on gallery_items(sort_order, created_at desc);
