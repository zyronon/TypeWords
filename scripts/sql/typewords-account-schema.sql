-- Bootstrap for an EMPTY project, not an upgrade of a legacy shared table.
-- Deliberately fail if the table exists: inspect and migrate existing data separately.
create table public.typewords_data (
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('dict', 'setting', 'practice_word', 'practice_article')),
  data jsonb,
  data_version integer not null check (data_version > 0),
  updated_at timestamptz not null check (isfinite(updated_at)),
  primary key (user_id, type),
  constraint typewords_data_payload check (
    case
      when type in ('dict', 'setting') then data is not null and jsonb_typeof(data) = 'object'
      else data is null or jsonb_typeof(data) in ('object', 'null')
    end
  )
);

alter table public.typewords_data enable row level security;
alter table public.typewords_data force row level security;

-- Do not inherit the project's default broad Data API grants.
revoke all on table public.typewords_data from public, anon, authenticated;
grant select, insert, update on table public.typewords_data to authenticated;

create policy typewords_select_own on public.typewords_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy typewords_insert_own on public.typewords_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy typewords_update_own on public.typewords_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
