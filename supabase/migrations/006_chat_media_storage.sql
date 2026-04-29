-- Ensure chat-media bucket exists and is public
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', true, 10485760, array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = 10485760;

-- Drop and recreate policies cleanly
drop policy if exists "Authenticated users can upload to chat-media" on storage.objects;
drop policy if exists "Anyone can view chat-media" on storage.objects;
drop policy if exists "chat-media upload" on storage.objects;
drop policy if exists "chat-media read" on storage.objects;

create policy "chat-media upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media');

create policy "chat-media read"
  on storage.objects for select to public
  using (bucket_id = 'chat-media');
