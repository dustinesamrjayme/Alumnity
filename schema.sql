-- =====================================================================
-- schema_v3.sql  —  2026-11-06
-- Additions for the Supabase-ready frontend:
--   * get_event_availability() — alumni can't read others' registrations
--     under RLS, so availability must be computed server-side.
--   * search_users() — replaces the .or() string-built filter (injection).
--   * mark_no_show() — volunteers can cancel un-attended registrations.
--   * finalize_event() / finalize_past_events() — close past events and
--     cancel anyone who didn't check in. Idempotent.
--   * users.password_hash dropped — Supabase Auth owns credentials.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Availability for the alumni side
-- ---------------------------------------------------------------------
-- RLS restricts `registrations` to owner + admin, so `count(*)` of active
-- registrations per event is impossible for a normal alumni. This function
-- is the sanctioned read path for slots-left and capacity checks.
create or replace function get_event_availability(p_event_id integer)
returns table (
    event_id   integer,
    capacity   integer,
    registered integer,
    available  integer
)
language sql stable security definer set search_path = public as $$
    with counts as (
        select
            e.id          as event_id,
            e.capacity    as capacity,
            count(r.id) filter (where r.attendee_status <> 'cancelled')::integer
                          as registered
        from events e
        left join registrations r on r.event_id = e.id
        where e.id = p_event_id
        group by e.id, e.capacity
    )
    select event_id, capacity, registered,
           case when capacity is null then null
                else greatest(capacity - registered, 0)
           end as available
    from counts;
$$;

-- Bulk variant for the events list screen: one round-trip, not N.
create or replace function get_events_with_availability()
returns table (
    id          integer,
    name        text,
    venue       text,
    description text,
    event_date  timestamptz,
    price       numeric,
    capacity    integer,
    banner_url  text,
    status      event_status,
    created_by  uuid,
    closed_at   timestamptz,
    registered  integer,
    available   integer
)
language sql stable security definer set search_path = public as $$
    select e.id, e.name, e.venue, e.description, e.event_date, e.price,
           e.capacity, e.banner_url, e.status, e.created_by, e.closed_at,
           count(r.id) filter (where r.attendee_status <> 'cancelled')::integer as registered,
           case when e.capacity is null then null
                else greatest(e.capacity - count(r.id) filter (where r.attendee_status <> 'cancelled')::integer, 0)
           end as available
    from events e
    left join registrations r on r.event_id = e.id
    group by e.id
    order by e.event_date asc;
$$;

-- ---------------------------------------------------------------------
-- 2. Safer admin search
-- ---------------------------------------------------------------------
create or replace function search_users(p_term text)
returns setof users
language sql stable security definer set search_path = public as $$
    select *
    from users
    where coalesce(auth_role(), '') = 'admin'
      and (
          p_term is null or p_term = ''
          or first_name ilike '%' || p_term || '%'
          or last_name  ilike '%' || p_term || '%'
          or username   ilike '%' || p_term || '%'
          or email      ilike '%' || p_term || '%'
      )
    order by last_name, first_name
    limit 25;
$$;

-- ---------------------------------------------------------------------
-- 3. Volunteer no-show marker
-- ---------------------------------------------------------------------
create or replace function mark_no_show(p_registration_id integer)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
    v_reg registrations%rowtype;
begin
    if coalesce(auth_role(), '') not in ('admin', 'volunteer') then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    select * into v_reg from registrations where id = p_registration_id for update;
    if not found then
        raise exception 'registration not found' using errcode = 'P0002';
    end if;
    if v_reg.attendee_status = 'checked_in' then
        raise exception 'attendee already checked in' using errcode = 'P0001';
    end if;
    if v_reg.attendee_status = 'cancelled' then
        return v_reg;
    end if;

    update registrations set attendee_status = 'cancelled'
    where id = p_registration_id
    returning * into v_reg;

    return v_reg;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Event finalization (auto-cancel no-shows)
-- ---------------------------------------------------------------------
create or replace function finalize_event(p_event_id integer)
returns integer  -- number of registrations cancelled
language plpgsql security definer set search_path = public as $$
declare
    v_cancelled integer;
begin
    -- Allow system jobs (pg_cron) where auth.uid() is null
    if auth.uid() is not null and coalesce(auth_role(), '') not in ('admin', 'volunteer') then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    with cancelled as (
        update registrations
           set attendee_status = 'cancelled'
         where event_id = p_event_id
           and attendee_status = 'not_checked_in'
        returning id
    )
    select count(*) into v_cancelled from cancelled;

    update events set status = 'closed'
     where id = p_event_id and status = 'listed';

    return v_cancelled;
end;
$$;

create or replace function finalize_past_events(p_grace_hours integer default 12)
returns integer
language plpgsql security definer set search_path = public as $$
declare
    v_event  record;
    v_total  integer := 0;
begin
    -- Allow system jobs (pg_cron) where auth.uid() is null
    if auth.uid() is not null and coalesce(auth_role(), '') not in ('admin', 'volunteer') then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    for v_event in
        select id from events
         where event_date < now() - (p_grace_hours * interval '1 hour')
           and (status = 'listed' or exists (
               select 1 from registrations
                where event_id = events.id and attendee_status = 'not_checked_in'
           ))
    loop
        v_total := v_total + finalize_event(v_event.id);
    end loop;
    return v_total;
end;
$$;
-- ---------------------------------------------------------------------
-- 5. Drop the redundant password column
-- ---------------------------------------------------------------------
alter table users drop column if exists password_hash;

-- ---------------------------------------------------------------------
-- 6. Grants for the new functions
-- ---------------------------------------------------------------------
revoke execute on function
    get_event_availability(integer),
    get_events_with_availability(),
    search_users(text),
    mark_no_show(integer),
    finalize_event(integer),
    finalize_past_events(integer)
from public, anon, authenticated;

grant execute on function
    get_event_availability(integer),
    get_events_with_availability()
to authenticated;

grant execute on function
    search_users(text),
    mark_no_show(integer),
    finalize_event(integer),
    finalize_past_events(integer)
to authenticated;   -- role checks are inside each function

-- ---------------------------------------------------------------------
-- 7. Optional: schedule finalize_past_events with pg_cron
-- Enable in Dashboard > Database > Extensions > pg_cron first.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule(
--     'finalize-past-events',
--     '0 */6 * * *',                    -- every 6 hours
--     $$ select public.finalize_past_events(); $$
-- );


-- -- 1. Grant the auth admin role permission to execute the hook itself
-- grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- -- 2. Grant permission to execute the auth_role() helper function it calls
-- grant execute on function public.auth_role() to supabase_auth_admin;

-- -- 3. Ensure the auth admin can access the public schema
-- grant usage on schema public to supabase_auth_admin;


-- create or replace function public.custom_access_token_hook(event jsonb)
-- returns jsonb
-- language plpgsql
-- security definer -- Ensures it runs with the privileges of the creator (postgres)
-- set search_path = public
-- as $$
-- declare
--     v_claims jsonb := event -> 'claims';
--     v_role   user_role;
-- begin
--     -- Look up the user's role
--     select role into v_role from public.users where id = (event ->> 'user_id')::uuid;
    
--     -- Inject it into the claims
--     v_claims := jsonb_set(v_claims, '{user_role}', coalesce(to_jsonb(v_role::text), 'null'::jsonb));
--     return jsonb_set(event, '{claims}', v_claims);
-- exception
--     when others then
--         -- If anything fails, return the original event so auth doesn't break
--         raise warning 'Error in custom_access_token_hook: %', sqlerrm;
--         return event;
-- end;
-- $$;