-- The friend board gained its own composer (note / voice / photo / video), so
-- it must carry video as well. Friend media cannot use the Drive pipeline —
-- `finalize_drive_goodie_upload` and its RLS chain are keyed to `space_id`,
-- which a friend is not a member of — so the bytes live in `friend-media`.

alter table public.friend_posts
  drop constraint if exists friend_posts_kind_check;
alter table public.friend_posts
  add constraint friend_posts_kind_check
  check (kind in ('photo', 'video', 'voice', 'note'));

-- Room for a short clip, and the video mime types to go with it.
update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'audio/m4a', 'audio/mp4', 'audio/aac'
  ]
where id = 'friend-media';
