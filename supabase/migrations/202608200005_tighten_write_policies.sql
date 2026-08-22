-- Replace broad pair-member write policies with actor/owner checks.

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tasks', 'task_completions', 'goodies', 'memories', 'memory_media', 'timeline_events',
    'notes', 'presence', 'streaks', 'nudges', 'questions', 'question_answers', 'activity_events'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
  end loop;
end $$;

create policy tasks_insert_actor on public.tasks for insert
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy tasks_update_pair on public.tasks for update
using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy tasks_delete_pair on public.tasks for delete using (public.is_space_member(space_id));

create policy completions_insert_self on public.task_completions for insert
with check (public.is_space_member(space_id) and user_id = auth.uid());
create policy completions_update_self on public.task_completions for update
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_space_member(space_id));
create policy completions_delete_self on public.task_completions for delete using (user_id = auth.uid());

create policy goodies_insert_actor on public.goodies for insert
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy goodies_update_actor on public.goodies for update
using (author_id = auth.uid()) with check (author_id = auth.uid() and public.is_space_member(space_id));
create policy goodies_delete_actor on public.goodies for delete using (author_id = auth.uid());

create policy memories_insert_actor on public.memories for insert
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy memories_update_actor on public.memories for update
using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_space_member(space_id));
create policy memories_delete_actor on public.memories for delete using (created_by = auth.uid());

create policy memory_media_insert_actor on public.memory_media for insert
with check (public.is_space_member(space_id) and uploaded_by = auth.uid());
create policy memory_media_update_actor on public.memory_media for update
using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid() and public.is_space_member(space_id));
create policy memory_media_delete_actor on public.memory_media for delete using (uploaded_by = auth.uid());

create policy timeline_insert_actor on public.timeline_events for insert
with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy timeline_update_actor on public.timeline_events for update
using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_space_member(space_id));
create policy timeline_delete_actor on public.timeline_events for delete using (created_by = auth.uid());

create policy notes_insert_actor on public.notes for insert
with check (public.is_space_member(space_id) and author_id = auth.uid());
create policy notes_update_actor on public.notes for update
using (author_id = auth.uid()) with check (author_id = auth.uid() and public.is_space_member(space_id));
create policy notes_delete_actor on public.notes for delete using (author_id = auth.uid());

create policy presence_insert_self on public.presence for insert
with check (public.is_space_member(space_id) and user_id = auth.uid());
create policy presence_update_self on public.presence for update
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_space_member(space_id));
create policy presence_delete_self on public.presence for delete using (user_id = auth.uid());

create policy nudges_insert_actor on public.nudges for insert
with check (public.is_space_member(space_id) and from_user_id = auth.uid());
create policy nudges_update_actor on public.nudges for update
using (from_user_id = auth.uid()) with check (from_user_id = auth.uid() and public.is_space_member(space_id));
create policy nudges_delete_actor on public.nudges for delete using (from_user_id = auth.uid());

create policy answers_insert_self on public.question_answers for insert
with check (public.is_space_member(space_id) and user_id = auth.uid());
create policy answers_update_self on public.question_answers for update
using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_space_member(space_id));
create policy answers_delete_self on public.question_answers for delete using (user_id = auth.uid());

drop policy if exists calendar_sources_self on public.calendar_sources;
create policy calendar_sources_read_self on public.calendar_sources for select using (user_id = auth.uid());
