-- Run this any time to see what is set up. Every row should say true when you are finished.
select 'table: ' || t.name as item, (to_regclass('public.' || t.name) is not null) as ok
from (values ('profiles'),('user_roles'),('music_releases'),('tracks'),('release_platform_links'),('site_settings'),
             ('contact_messages'),('booking_enquiries'),('booking_private_notes'),('audit_logs'),
             ('gallery_items'),('pages'),('events')) as t(name)
union all
select 'column: contact_messages.ip_hash', exists(select 1 from information_schema.columns where table_name='contact_messages' and column_name='ip_hash')
union all
select 'column: booking_enquiries.ip_hash', exists(select 1 from information_schema.columns where table_name='booking_enquiries' and column_name='ip_hash')
union all
select 'storage bucket: media', exists(select 1 from storage.buckets where id='media')
union all
select 'storage permissions (4 expected)', (select count(*) from pg_policies where schemaname='storage' and policyname like 'media%') = 4
union all
select 'function: cms_save_release', exists(select 1 from pg_proc where proname='cms_save_release')
union all
select 'policy: site_settings staff_settings', exists(select 1 from pg_policies where tablename='site_settings' and policyname='staff_settings')
union all
select 'site_settings row exists', exists(select 1 from site_settings)
order by 2, 1;
