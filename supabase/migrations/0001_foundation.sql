create extension if not exists pgcrypto;
create type content_status as enum('draft','published','scheduled','archived');
create type release_type as enum('single','ep','album');
create type app_role as enum('super_admin','editor','author','booking_manager');
create type booking_status as enum('new','reviewing','awaiting_information','accepted','declined','cancelled');

create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

create table profiles(id uuid primary key references auth.users on delete cascade,full_name text,avatar_url text,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table user_roles(user_id uuid not null references profiles on delete cascade,role app_role not null,primary key(user_id,role));

create function has_role(r app_role) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from user_roles ur join profiles p on p.id=ur.user_id where ur.user_id=auth.uid() and ur.role=r and p.is_active) $$;
create function is_content_staff() returns boolean language sql stable security definer set search_path=public as
$$ select has_role('super_admin') or has_role('editor') $$;

create table music_releases(id uuid primary key default gen_random_uuid(),title text not null,slug text not null unique,release_type release_type not null,cover_url text,release_date date,genre text,description text,label text,status content_status not null default 'draft',featured boolean not null default false,published_at timestamptz,seo_title text,seo_description text,created_by uuid references profiles on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'published' or published_at is not null));
create table tracks(id uuid primary key default gen_random_uuid(),release_id uuid not null references music_releases on delete cascade,track_number int not null,title text not null,duration_seconds int,featured_artists text,producer_credit text,songwriter_credit text,unique(release_id,track_number));
create table release_platform_links(id uuid primary key default gen_random_uuid(),release_id uuid not null references music_releases on delete cascade,platform text not null,url text not null check(url ~ '^https://'),is_primary boolean not null default false,display_order int not null default 0);
create table social_links(id uuid primary key default gen_random_uuid(),platform text not null,label text,url text not null check(url ~ '^https://'),icon_key text,sort_order int not null default 0,is_visible boolean not null default true);
create table site_settings(id boolean primary key default true check(id),data jsonb not null default '{}',updated_at timestamptz not null default now());
create table contact_messages(id uuid primary key default gen_random_uuid(),name text not null check(length(name)<=120),email text not null check(length(email)<=254),subject text check(length(subject)<=200),message text not null check(length(message)<=5000),status text not null default 'new',created_at timestamptz not null default now());
create table booking_enquiries(id uuid primary key default gen_random_uuid(),reference text not null unique,details jsonb not null,status booking_status not null default 'new',decision_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table booking_private_notes(id uuid primary key default gen_random_uuid(),enquiry_id uuid not null references booking_enquiries on delete cascade,author_id uuid references profiles on delete set null,note text not null,created_at timestamptz not null default now());
create table audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references profiles on delete set null,action text not null,entity_type text,entity_id text,metadata jsonb,created_at timestamptz not null default now());
create index on tracks(release_id);create index on release_platform_links(release_id);create index on music_releases(status,release_date desc);
create index on booking_enquiries(status,created_at desc);

create trigger t1 before update on music_releases for each row execute function touch_updated_at();
create trigger t2 before update on booking_enquiries for each row execute function touch_updated_at();
create trigger t3 before update on profiles for each row execute function touch_updated_at();

do $$ declare t text; begin
 for t in select unnest(array['profiles','user_roles','music_releases','tracks','release_platform_links','social_links','site_settings','contact_messages','booking_enquiries','booking_private_notes','audit_logs']) loop
  execute format('alter table %I enable row level security',t); end loop; end $$;

-- Public read: only published, due content
create policy pub_releases on music_releases for select using(status='published' and published_at<=now());
create policy pub_tracks on tracks for select using(exists(select 1 from music_releases r where r.id=release_id and r.status='published' and r.published_at<=now()));
create policy pub_links on release_platform_links for select using(exists(select 1 from music_releases r where r.id=release_id and r.status='published' and r.published_at<=now()));
create policy pub_social on social_links for select using(is_visible);
create policy pub_settings on site_settings for select using(true);
-- Staff write
create policy staff_releases on music_releases for all using(is_content_staff()) with check(is_content_staff());
create policy staff_tracks on tracks for all using(is_content_staff()) with check(is_content_staff());
create policy staff_links on release_platform_links for all using(is_content_staff()) with check(is_content_staff());
create policy staff_social on social_links for all using(is_content_staff()) with check(is_content_staff());
create policy admin_settings on site_settings for all using(has_role('super_admin')) with check(has_role('super_admin'));
create policy author_drafts_ins on music_releases for insert with check(has_role('author') and status='draft' and created_by=auth.uid());
create policy author_drafts_upd on music_releases for update using(has_role('author') and status='draft' and created_by=auth.uid()) with check(status='draft' and created_by=auth.uid());
-- Private data: no anon access; inserts come from Edge Functions using the service role
create policy contact_staff on contact_messages for all using(is_content_staff()) with check(is_content_staff());
create policy booking_staff on booking_enquiries for all using(is_content_staff() or has_role('booking_manager')) with check(is_content_staff() or has_role('booking_manager'));
create policy notes_staff on booking_private_notes for all using(is_content_staff() or has_role('booking_manager')) with check(is_content_staff() or has_role('booking_manager'));
create policy audit_read on audit_logs for select using(has_role('super_admin'));
create policy profile_self on profiles for select using(id=auth.uid() or has_role('super_admin'));
create policy roles_read on user_roles for select using(user_id=auth.uid() or has_role('super_admin'));
create policy roles_admin on user_roles for all using(has_role('super_admin')) with check(has_role('super_admin'));
create policy profile_admin on profiles for all using(has_role('super_admin')) with check(has_role('super_admin'));
