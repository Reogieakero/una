-- 00025_announcement_images: public bucket for announcement cover images
-- (<img> tags can't send auth headers, so reads are public; writes stay
-- head-only) plus the announcements.image_url column.

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do update set public = true;

create policy announcement_images_public_read
  on storage.objects for select
  using (bucket_id = 'announcement-images');

create policy announcement_images_head_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'announcement-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guidance_head'
    )
  );

create policy announcement_images_head_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'announcement-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guidance_head'
    )
  );

alter table public.announcements
  add column if not exists image_url text;
