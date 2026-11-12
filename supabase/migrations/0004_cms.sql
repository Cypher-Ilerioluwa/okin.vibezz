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
