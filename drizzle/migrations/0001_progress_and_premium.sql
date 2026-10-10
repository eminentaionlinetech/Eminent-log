create or replace function public.record_lesson_progress(_lesson_id uuid, _position numeric, _completed boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _course uuid;
  _total int;
  _done int;
  _course_done boolean := false;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select l.course_id into _course from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = _lesson_id and l.is_published and c.status = 'published';
  if _course is null then raise exception 'lesson not available'; end if;
  if not exists (select 1 from public.enrolments e where e.user_id = _uid and e.course_id = _course) then
    raise exception 'not enrolled';
  end if;
  if not public.can_access_course(_uid, _course) then raise exception 'no access'; end if;

  insert into public.lesson_progress (user_id, lesson_id, course_id, position_seconds, completed, completed_at, last_accessed_at)
  values (_uid, _lesson_id, _course, greatest(coalesce(_position,0),0), coalesce(_completed,false), case when _completed then now() end, now())
  on conflict (user_id, lesson_id) do update set
    position_seconds = excluded.position_seconds,
    completed = public.lesson_progress.completed or excluded.completed,
    completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
    last_accessed_at = now();

  select count(*) into _total from public.lessons where course_id = _course and is_published;
  select count(*) into _done from public.lesson_progress p join public.lessons l on l.id = p.lesson_id
    where p.user_id = _uid and p.course_id = _course and p.completed and l.is_published;
  _course_done := _total > 0 and _done >= _total;

  update public.enrolments set last_accessed_at = now(),
    completed_at = case when _course_done then coalesce(completed_at, now()) else completed_at end
  where user_id = _uid and course_id = _course;

  return jsonb_build_object('completed_lessons', _done, 'total_lessons', _total, 'course_completed', _course_done);
end $$;
revoke all on function public.record_lesson_progress(uuid, numeric, boolean) from public, anon;
grant execute on function public.record_lesson_progress(uuid, numeric, boolean) to authenticated;

create or replace function public.grant_premium_payment(_reference text, _amount_kobo bigint, _raw jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _pay public.payments%rowtype;
  _sub public.subscriptions%rowtype;
  _start timestamptz;
begin
  select * into _pay from public.payments where reference = _reference for update;
  if not found then return false; end if;
  if _pay.status = 'success' then return true; end if;
  if _amount_kobo < _pay.amount_kobo then
    update public.payments set status = 'failed', raw = _raw where id = _pay.id;
    return false;
  end if;
  select * into _sub from public.subscriptions where user_id = _pay.user_id order by created_at desc limit 1 for update;
  if not found then
    insert into public.subscriptions (user_id, status) values (_pay.user_id, 'inactive') returning * into _sub;
  end if;
  _start := greatest(now(), coalesce(case when _sub.status = 'active' then _sub.current_period_end end, now()));
  update public.subscriptions set status = 'active',
    current_period_start = coalesce(case when _sub.status = 'active' and _sub.current_period_end > now() then _sub.current_period_start end, now()),
    current_period_end = _start + interval '30 days', updated_at = now()
  where id = _sub.id;
  update public.payments set status = 'success', verified_at = now(), raw = _raw, subscription_id = _sub.id where id = _pay.id;
  return true;
end $$;
revoke all on function public.grant_premium_payment(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.grant_premium_payment(text, bigint, jsonb) to service_role;