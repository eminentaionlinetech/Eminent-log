create type public.app_role as enum ('admin','student');
create type public.access_type as enum ('free','premium');
create type public.course_status as enum ('draft','published');
create type public.media_kind as enum ('video','pdf','image','other');
create type public.subscription_status as enum ('inactive','pending','active','expired','cancelled','past_due');
create type public.payment_status as enum ('pending','success','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  account_status text not null default 'active' check (account_status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.my_account_status() returns text language sql stable security definer set search_path = public as $$
  select account_status from public.profiles where id = auth.uid()
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and account_status = public.my_account_status());
create policy "admin profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  if lower(new.email) = 'eminentlattice@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "categories admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  bio text,
  photo_url text,
  created_at timestamptz not null default now()
);
grant select on public.instructors to anon, authenticated;
grant insert, update, delete on public.instructors to authenticated;
grant all on public.instructors to service_role;
alter table public.instructors enable row level security;
create policy "instructors public read" on public.instructors for select to anon, authenticated using (true);
create policy "instructors admin write" on public.instructors for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.media (
  id uuid primary key default gen_random_uuid(),
  kind media_kind not null,
  title text not null,
  bucket text not null,
  path text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric,
  public_url text,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
grant select, insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;
alter table public.media enable row level security;
create policy "media admin all" on public.media for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  instructor_id uuid references public.instructors(id) on delete set null,
  thumbnail_url text,
  access_type access_type not null default 'free',
  status course_status not null default 'draft',
  learning_outcomes text[] not null default '{}',
  requirements text[] not null default '{}',
  intended_audience text,
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;
alter table public.courses enable row level security;
create policy "published courses public" on public.courses for select to anon, authenticated using (status = 'published' or public.has_role(auth.uid(),'admin'));
create policy "courses admin write" on public.courses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.modules(course_id, position);
grant select on public.modules to anon, authenticated;
grant insert, update, delete on public.modules to authenticated;
grant all on public.modules to service_role;
alter table public.modules enable row level security;
create policy "modules of published courses" on public.modules for select to anon, authenticated using (
  public.has_role(auth.uid(),'admin') or exists (select 1 from public.courses c where c.id = course_id and c.status='published'));
create policy "modules admin write" on public.modules for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  is_published boolean not null default false,
  video_media_id uuid references public.media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.lessons(module_id, position);
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
grant select on public.lessons to anon, authenticated;
grant insert, update, delete on public.lessons to authenticated;
grant all on public.lessons to service_role;
alter table public.lessons enable row level security;
create policy "published lessons readable" on public.lessons for select to anon, authenticated using (
  public.has_role(auth.uid(),'admin') or (is_published and exists (select 1 from public.courses c where c.id = course_id and c.status='published')));
create policy "lessons admin write" on public.lessons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  title text not null,
  position int not null default 0,
  unique (lesson_id, media_id)
);
grant select on public.lesson_resources to anon, authenticated;
grant insert, update, delete on public.lesson_resources to authenticated;
grant all on public.lesson_resources to service_role;
alter table public.lesson_resources enable row level security;
create policy "resources listing readable" on public.lesson_resources for select to anon, authenticated using (
  public.has_role(auth.uid(),'admin') or exists (select 1 from public.lessons l join public.courses c on c.id=l.course_id where l.id = lesson_id and l.is_published and c.status='published'));
create policy "resources admin write" on public.lesson_resources for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.course_lesson_meta(_course_id uuid)
returns table(lesson_id uuid, has_video boolean, duration_seconds numeric, resource_count int)
language sql stable security definer set search_path = public as $$
  select l.id, l.video_media_id is not null, m.duration_seconds,
    (select count(*)::int from public.lesson_resources r where r.lesson_id = l.id)
  from public.lessons l
  join public.courses c on c.id = l.course_id
  left join public.media m on m.id = l.video_media_id
  where l.course_id = _course_id and l.is_published and (c.status='published' or public.has_role(auth.uid(),'admin'))
$$;

create or replace function public.course_catalog_stats()
returns table(course_id uuid, module_count int, lesson_count int, total_seconds numeric, all_durations_known boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
    (select count(*)::int from public.modules mo where mo.course_id=c.id),
    (select count(*)::int from public.lessons l where l.course_id=c.id and l.is_published),
    (select coalesce(sum(m.duration_seconds),0) from public.lessons l join public.media m on m.id=l.video_media_id where l.course_id=c.id and l.is_published),
    not exists (select 1 from public.lessons l left join public.media m on m.id=l.video_media_id where l.course_id=c.id and l.is_published and m.duration_seconds is null)
  from public.courses c where c.status='published'
$$;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan text not null default 'premium_monthly',
  status subscription_status not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.subscriptions(user_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own subs read" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'korapay',
  reference text not null unique,
  amount_kobo bigint not null,
  currency text not null default 'NGN',
  status payment_status not null default 'pending',
  verified_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments read" on public.payments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.has_active_premium(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id=_user_id and s.status='active' and s.current_period_end > now())
$$;

create or replace function public.can_access_course(_user_id uuid, _course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'admin') or exists (
    select 1 from public.courses c where c.id=_course_id and c.status='published'
      and (c.access_type='free' or public.has_active_premium(_user_id)))
$$;

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_accessed_at timestamptz,
  unique (user_id, course_id)
);
grant select, insert on public.enrolments to authenticated;
grant all on public.enrolments to service_role;
alter table public.enrolments enable row level security;
create policy "own enrolments read" on public.enrolments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "enrol self when allowed" on public.enrolments for insert to authenticated with check (user_id = auth.uid() and completed_at is null and public.can_access_course(auth.uid(), course_id));

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position_seconds numeric not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
grant select on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
alter table public.lesson_progress enable row level security;
create policy "own progress read" on public.lesson_progress for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.site_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Storage: one private bucket; images/ folder is publicly readable (thumbnails), everything else admin-only
create policy "anyone reads images folder" on storage.objects for select to anon, authenticated using (bucket_id='course-media' and (storage.foldername(name))[1] = 'images');
create policy "admin all course-media" on storage.objects for all to authenticated using (bucket_id='course-media' and public.has_role(auth.uid(),'admin')) with check (bucket_id='course-media' and public.has_role(auth.uid(),'admin'));

insert into public.categories (name, slug, position) values
 ('Website Design','website-design',1),('Graphic Design','graphic-design',2),('Online Business','online-business',3),('AI & Digital Skills','ai-digital-skills',4);

insert into public.courses (slug, title, category_id, access_type, status) values
 ('mastering-website-design','Mastering Website Design: From Beginner to Professional',(select id from public.categories where slug='website-design'),'free','draft'),
 ('canva-masterclass','Canva Masterclass: Professional Graphic Design',(select id from public.categories where slug='graphic-design'),'free','draft'),
 ('online-business-development-skills','Online Business Development Skills',(select id from public.categories where slug='online-business'),'free','draft');

insert into public.modules (course_id, title, position)
select c.id, m.title, m.pos from public.courses c, (values
 ('Website Fundamentals',1),('Understanding Domains, Hosting and Browsers',2),('WordPress Fundamentals',3),('Themes and Website Structure',4),
 ('Elementor Website Design',5),('Professional Page Layout',6),('Responsive Website Design',7),('Plugins and Website Functionality',8),
 ('Content, Images and Media',9),('Forms, SEO and Basic Security',10),('Launching a Professional Website',11),('Working With Clients and Monetising Website Design Skills',12)
) as m(title,pos) where c.slug='mastering-website-design';

insert into public.lessons (module_id, course_id, title, position, is_published)
select m.id, m.course_id, 'What Is a Website?', 1, false from public.modules m join public.courses c on c.id=m.course_id
where c.slug='mastering-website-design' and m.position=1;