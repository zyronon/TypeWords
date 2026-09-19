-- Run only against an authorized EMPTY test table, as the management role.
-- Every synthetic write is rolled back. No auth users are created or modified.
begin;

do $$
declare owner_id uuid;
begin
  if exists (select 1 from public.typewords_data) then
    raise exception 'STOP: table contains data; no test writes authorized';
  end if;
  select id into strict owner_id from auth.users
    where email_confirmed_at is not null and encrypted_password <> '' and not is_anonymous;
  perform set_config('typewords.test_owner', owner_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;
do $$
declare owner_id uuid := current_setting('typewords.test_owner')::uuid;
begin
  if current_user <> 'authenticated' then raise exception 'wrong test role'; end if;
  insert into public.typewords_data(user_id, type, data, data_version, updated_at)
    select owner_id, t, '{"synthetic":"typewords-r3"}'::jsonb, 1, now()
    from unnest(array['dict','setting','practice_word','practice_article']) t;
  if (select count(*) from public.typewords_data) <> 4 then raise exception 'owner read failed'; end if;
  insert into public.typewords_data values (owner_id, 'setting', '{"synthetic":"updated"}', 2, now())
    on conflict (user_id, type) do update set data = excluded.data, data_version = excluded.data_version;
  if not exists (select 1 from public.typewords_data where type = 'setting' and data_version = 2) then
    raise exception 'owner upsert failed';
  end if;
  update public.typewords_data set data = null where type = 'practice_word';
  update public.typewords_data set data = 'null'::jsonb where type = 'practice_article';
  begin
    update public.typewords_data set user_id = '00000000-0000-4000-8000-000000000001' where type = 'dict';
    raise exception 'owner reassignment allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.typewords_data values
      ('00000000-0000-4000-8000-000000000001', 'dict', '{}', 1, now());
    raise exception 'foreign insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.typewords_data;
    raise exception 'delete allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.typewords_data set data_version = 0 where type = 'dict';
    raise exception 'invalid version allowed';
  exception when check_violation then null;
  end;
  begin
    update public.typewords_data set type = 'unknown' where type = 'dict';
    raise exception 'invalid type allowed';
  exception when check_violation then null;
  end;
  begin
    update public.typewords_data set data = null where type = 'dict';
    raise exception 'missing dictionary allowed';
  exception when check_violation then null;
  end;
  begin
    update public.typewords_data set data = '[]' where type = 'setting';
    raise exception 'invalid settings allowed';
  exception when check_violation then null;
  end;
  begin
    update public.typewords_data set updated_at = 'infinity' where type = 'dict';
    raise exception 'infinite timestamp allowed';
  exception when check_violation then null;
  end;
end $$;

-- Simulate another verified JWT subject, not a real second login.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare affected integer;
begin
  if exists (select 1 from public.typewords_data) then raise exception 'foreign rows visible'; end if;
  update public.typewords_data set data_version = 99;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'foreign rows updated'; end if;
  begin
    insert into public.typewords_data values
      (current_setting('typewords.test_owner')::uuid, 'dict', '{}', 1, now())
      on conflict (user_id, type) do update set data = excluded.data;
    raise exception 'foreign upsert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.typewords_data) then raise exception 'missing subject read allowed'; end if;
  begin
    insert into public.typewords_data values
      (current_setting('typewords.test_owner')::uuid, 'dict', '{}', 1, now());
    raise exception 'missing subject write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.typewords_data;
    raise exception 'anonymous read allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.typewords_data values
      (current_setting('typewords.test_owner')::uuid, 'dict', '{}', 1, now());
    raise exception 'anonymous write allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$
begin
  if (select count(*) from public.typewords_data) <> 4 then raise exception 'unexpected row count'; end if;
  if exists (select 1 from public.typewords_data where user_id <> current_setting('typewords.test_owner')::uuid) then
    raise exception 'unexpected owner';
  end if;
end $$;
rollback;
select 'PASS: account RLS, privileges, upsert, constraints; synthetic transaction rolled back' as result;
