-- Live dates for the /live/ page. Public can read published, upcoming rows; content staff manage them.
create table events(id uuid primary key default gen_random_uuid(),title text not null,event_date date not null,city text,country text,venue text,ticket_url text check(ticket_url is null or ticket_url ~ '^https://'),description text,status content_status not null default 'draft',published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status<>'published' or published_at is not null));
alter table events enable row level security;
create policy pub_events on events for select using(status='published' and published_at<=now());
create policy staff_events on events for all using(is_content_staff()) with check(is_content_staff());
create trigger t5 before update on events for each row execute function touch_updated_at();
