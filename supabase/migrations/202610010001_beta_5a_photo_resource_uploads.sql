-- Beta 5A: reliable cross-device photo uploads, shared photo viewing, and PDF resources.

alter table public.resources
  add column if not exists file_type text
  check (file_type is null or file_type in ('image','pdf'));

update public.resources
set file_type=case
  when lower(file_path) like '%.pdf' then 'pdf'
  when file_path is not null then 'image'
  else null
end
where file_type is null;

drop policy if exists "photos assigned insert" on public.photos;
create policy "photos assigned insert" on public.photos for insert to authenticated with check(
  public.is_active_user()
  and uploaded_by=auth.uid()
  and (
    public.is_admin()
    or exists(
      select 1 from public.contracts c
      where c.id=contract_id
        and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
    )
  )
);

drop policy if exists "drivers upload own roadshow photos" on storage.objects;
drop policy if exists "assigned users upload roadshow photos" on storage.objects;
create policy "assigned users upload roadshow photos" on storage.objects for insert to authenticated with check(
  public.is_active_user()
  and bucket_id='roadshow-photos'
  and (storage.foldername(name))[1]=auth.uid()::text
  and (
    public.is_admin()
    or exists(
      select 1 from public.contracts c
      where c.id::text=(storage.foldername(name))[2]
        and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
    )
  )
);

drop policy if exists "drivers read own roadshow photos" on storage.objects;
drop policy if exists "assigned users read roadshow photos" on storage.objects;
create policy "assigned users read roadshow photos" on storage.objects for select to authenticated using(
  public.is_active_user()
  and bucket_id='roadshow-photos'
  and (
    public.is_admin()
    or exists(
      select 1 from public.contracts c
      where c.id::text=(storage.foldername(name))[2]
        and (c.driver_id=auth.uid() or public.is_contract_driver(c.id))
    )
  )
);

drop policy if exists "drivers delete own roadshow photos" on storage.objects;
drop policy if exists "uploaders and admins delete roadshow photos" on storage.objects;
create policy "uploaders and admins delete roadshow photos" on storage.objects for delete to authenticated using(
  public.is_active_user()
  and bucket_id='roadshow-photos'
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin())
);
