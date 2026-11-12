-- Run ONCE after creating your login in Supabase.
-- 1. Supabase dashboard > Authentication > Users > "Add user" > "Create new user"
--    Enter your email + a strong password and tick "Auto Confirm User".
-- 2. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up"
--    (the CMS has no sign-up page, so nobody else can create an account).
-- 3. Replace the email below with yours and run this in the SQL editor.
do $$
declare uid uuid; mail text := 'you@example.com';
begin
  select id into uid from auth.users where email = mail;
  if uid is null then raise exception 'No auth user with email %. Create the user first.', mail; end if;
  insert into profiles(id, full_name) values(uid, 'Owner') on conflict (id) do nothing;
  insert into user_roles(user_id, role) values(uid, 'super_admin') on conflict do nothing;
end $$;
