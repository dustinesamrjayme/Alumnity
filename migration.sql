-- Alumnity initial database migration
-- Generated from the supplied schema.sql PostgreSQL 17 dump.
-- Target: Supabase PostgreSQL (requires Supabase-managed auth schema/roles).
-- This is a schema migration; it does not import application table data.
-- Apply to a fresh project/database. Do not run against an existing schema without review.

-- pg_trgm is required by public.users_name_trgm_idx.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Allow function definitions to refer to objects created later in this migration,
-- matching the behavior of the source pg_dump.
SET check_function_bodies = off;



CREATE TYPE public.attendee_status AS ENUM (
    'not_checked_in',
    'checked_in',
    'cancelled'
);


--
-- Name: event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_status AS ENUM (
    'listed',
    'closed'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'unpaid',
    'paid',
    'free'
);


--
-- Name: scan_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scan_result AS ENUM (
    'accepted',
    'duplicate',
    'rejected'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'alumni',
    'admin',
    'volunteer'
);




--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    department text NOT NULL,
    program text NOT NULL,
    batch integer NOT NULL,
    role public.user_role DEFAULT 'alumni'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_set_user_role(uuid, public.user_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role public.user_role) RETURNS public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_user users%rowtype;
begin
    if coalesce(auth_role(), '') <> 'admin' then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if p_user_id = auth.uid() then
        raise exception 'cannot change your own role' using errcode = 'P0001';
    end if;

    update users set role = p_role where id = p_user_id returning * into v_user;
    if not found then
        raise exception 'user not found' using errcode = 'P0002';
    end if;
    return v_user;
end;
$$;


--
-- Name: analytics_by_batch(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_by_batch(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(batch integer, registrations bigint, checked_in bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    u.batch,
    count(r.id)::bigint as registrations,
    count(r.id) filter (where r.attendee_status = 'checked_in')::bigint as checked_in
  from registrations r
  join users u on u.id = r.user_id
  where r.attendee_status <> 'cancelled'
    and (p_start_date is null or r.created_at >= p_start_date)
  group by u.batch
  order by u.batch desc;
$$;


--
-- Name: analytics_by_department(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_by_department(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(department text, registrations bigint, checked_in bigint)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    u.department,
    count(r.id)::bigint as registrations,
    count(r.id) filter (where r.attendee_status = 'checked_in')::bigint as checked_in
  from registrations r
  join users u on u.id = r.user_id
  where r.attendee_status <> 'cancelled'
    and (p_start_date is null or r.created_at >= p_start_date)
  group by u.department
  order by registrations desc;
$$;


--
-- Name: analytics_trend(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.analytics_trend(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(year integer, month integer, registrations bigint, revenue numeric)
    LANGUAGE sql SECURITY DEFINER
    AS $$
  select
    extract(year from r.created_at)::integer as year,
    extract(month from r.created_at)::integer as month,
    count(r.id)::bigint as registrations,
    coalesce(sum(e.price), 0)::numeric as revenue
  from registrations r
  join events e on e.id = r.event_id
  where r.attendee_status <> 'cancelled'
    and (p_start_date is null or r.created_at >= p_start_date)
  group by 1, 2
  order by 1, 2;
$$;


--
-- Name: audit_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
    if tg_op = 'INSERT' then
        insert into audit_log (actor_id, action, table_name, record_id, details)
        values (auth.uid(), 'event_listed', 'events', new.id, to_jsonb(new));

    elsif tg_op = 'UPDATE' then
        if new.status = 'closed' and old.status <> 'closed' then
            insert into audit_log (actor_id, action, table_name, record_id, details)
            values (auth.uid(), 'event_closed', 'events', new.id,
                    jsonb_build_object('closed_at', new.closed_at));
        else
            insert into audit_log (actor_id, action, table_name, record_id, details)
            values (auth.uid(), 'event_updated', 'events', new.id,
                    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
        end if;
    end if;
    return new;
end;
$$;


--
-- Name: audit_registrations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_registrations() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
        insert into audit_log (actor_id, action, table_name, record_id, details)
        values (auth.uid(), 'payment_confirmed', 'registrations', new.id,
                jsonb_build_object('from', old.payment_status, 'to', new.payment_status,
                                   'payment_collected_by', new.payment_collected_by));
    end if;

    if new.attendee_status = 'cancelled' and old.attendee_status <> 'cancelled' then
        insert into audit_log (actor_id, action, table_name, record_id, details)
        values (auth.uid(), 'registration_cancelled', 'registrations', new.id,
                jsonb_build_object('event_id', new.event_id, 'user_id', new.user_id));
    end if;
    return new;
end;
$$;


--
-- Name: auth_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
    select auth.jwt() ->> 'user_role';
$$;


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id uuid NOT NULL,
    attendee_status public.attendee_status DEFAULT 'not_checked_in'::public.attendee_status NOT NULL,
    payment_status public.payment_status DEFAULT 'unpaid'::public.payment_status NOT NULL,
    checked_in_at timestamp with time zone,
    payment_collected_by uuid,
    payment_collected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    qr_token uuid DEFAULT gen_random_uuid() NOT NULL,
    CONSTRAINT registrations_checkin_consistent CHECK (((attendee_status = 'checked_in'::public.attendee_status) = (checked_in_at IS NOT NULL))),
    CONSTRAINT registrations_paid_consistent CHECK (((payment_status <> 'paid'::public.payment_status) OR (payment_collected_at IS NOT NULL)))
);


--
-- Name: cancel_registration(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_registration(p_registration_id integer) RETURNS public.registrations
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_reg    registrations%rowtype;
    v_status event_status;
begin
    select * into v_reg from registrations where id = p_registration_id for update;
    if not found then
        raise exception 'registration not found' using errcode = 'P0002';
    end if;

    if v_reg.user_id <> auth.uid() and coalesce(auth_role(), '') <> 'admin' then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if v_reg.attendee_status = 'checked_in' then
        raise exception 'already checked in' using errcode = 'P0001';
    end if;
    if v_reg.attendee_status = 'cancelled' then
        return v_reg;
    end if;

    select status into v_status from events where id = v_reg.event_id;
    if v_status = 'closed' and coalesce(auth_role(), '') <> 'admin' then
        raise exception 'event is closed' using errcode = 'P0001';
    end if;

    update registrations set attendee_status = 'cancelled'
    where id = p_registration_id
    returning * into v_reg;

    return v_reg;
end;
$$;


--
-- Name: confirm_payment(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_payment(p_registration_id integer) RETURNS public.registrations
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
    if v_reg.attendee_status = 'cancelled' then
        raise exception 'registration is cancelled' using errcode = 'P0001';
    end if;
    if v_reg.payment_status <> 'unpaid' then
        raise exception 'nothing to collect' using errcode = 'P0001';
    end if;

    update registrations
    set payment_status = 'paid',
        payment_collected_by = auth.uid(),
        payment_collected_at = now()
    where id = p_registration_id
    returning * into v_reg;

    return v_reg;
end;
$$;


--
-- Name: custom_access_token_hook(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_claims jsonb := event -> 'claims';
    v_role   user_role;
begin
    -- Look up the user's role
    select role into v_role from public.users where id = (event ->> 'user_id')::uuid;

    -- Inject it into the claims
    v_claims := jsonb_set(v_claims, '{user_role}', coalesce(to_jsonb(v_role::text), 'null'::jsonb));
    return jsonb_set(event, '{claims}', v_claims);
exception
    when others then
        -- If anything fails, return the original event so auth doesn't break
        raise warning 'Error in custom_access_token_hook: %', sqlerrm;
        return event;
end;
$$;


--
-- Name: events_set_closed_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.events_set_closed_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if new.status = 'closed' and old.status <> 'closed' then
        new.closed_at := coalesce(new.closed_at, now());
    end if;
    return new;
end;
$$;


--
-- Name: finalize_event(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_event(p_event_id integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_cancelled integer;
begin
    -- Reject anon explicitly. service_role / direct SQL (pg_cron) have no JWT
    -- role claim and fall through; authenticated users are checked below.
    if coalesce(auth.jwt() ->> 'role', '') = 'anon' then
        raise exception 'not allowed' using errcode = '42501';
    end if;
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


--
-- Name: finalize_past_events(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_past_events(p_grace_hours integer DEFAULT 12) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_event  record;
    v_total  integer := 0;
begin
    if coalesce(auth.jwt() ->> 'role', '') = 'anon' then
        raise exception 'not allowed' using errcode = '42501';
    end if;
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


--
-- Name: get_alumni_list(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_alumni_list() RETURNS TABLE(first_name text, last_name text, email text, phone text, department text, program text, batch integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
#variable_conflict use_column
begin
    if coalesce(auth_role(), '') <> 'admin' then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    return query
    select u.first_name, u.last_name, u.email, u.phone, u.department, u.program, u.batch
    from users u
    where u.role = 'alumni'
    order by u.last_name, u.first_name;
end;
$$;


--
-- Name: get_alumni_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_alumni_summary() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
begin
    if coalesce(auth_role(), '') <> 'admin' then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    return (
        select json_build_object(
            'total', count(*),
            'newThisMonth', count(*) filter (where created_at >= date_trunc('month', now()))
        )
        from users
        where role = 'alumni'
    );
end;
$$;


--
-- Name: get_attendee_list(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_attendee_list(p_event_id integer) RETURNS TABLE(registration_id integer, qr_token uuid, first_name text, last_name text, attendee_status public.attendee_status, payment_status public.payment_status, checked_in_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
#variable_conflict use_column
begin
    if coalesce(auth_role(), '') not in ('admin', 'volunteer') then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    return query
    select r.id, r.qr_token, u.first_name, u.last_name,
           r.attendee_status, r.payment_status, r.checked_in_at
    from registrations r
    join users u on u.id = r.user_id
    where r.event_id = p_event_id;
end;
$$;


--
-- Name: get_event_availability(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_availability(p_event_id integer) RETURNS TABLE(event_id integer, capacity integer, registered integer, available integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
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


--
-- Name: event_dashboard_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.event_dashboard_stats AS
SELECT
    NULL::integer AS event_id,
    NULL::text AS name,
    NULL::integer AS capacity,
    NULL::bigint AS registered,
    NULL::bigint AS checked_in,
    NULL::bigint AS cancelled,
    NULL::bigint AS paid,
    NULL::bigint AS unpaid,
    NULL::numeric(12,2) AS revenue;


--
-- Name: get_event_dashboard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_dashboard() RETURNS SETOF public.event_dashboard_stats
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
begin
    if coalesce(auth_role(), '') <> 'admin' then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    return query select * from event_dashboard_stats;
end;
$$;


--
-- Name: get_event_status_breakdown(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_event_status_breakdown() RETURNS TABLE(event_name text, attendee_status text, total integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if coalesce(public.auth_role(), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select de.name, f.attendee_status, count(*)::int
    from analytics.fact_registration f
    join analytics.dim_event de on de.event_key = f.event_key
    group by de.name, f.attendee_status order by de.name;
end $$;


--
-- Name: get_events_with_availability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_events_with_availability() RETURNS TABLE(id integer, name text, venue text, description text, event_date timestamp with time zone, price numeric, capacity integer, banner_url text, status public.event_status, created_by uuid, closed_at timestamp with time zone, registered integer, available integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
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


--
-- Name: get_registration_trend(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_registration_trend() RETURNS TABLE(year integer, month integer, registrations integer, revenue numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if coalesce(public.auth_role(), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select dd.year, dd.month, count(*)::int, sum(f.amount)
    from analytics.fact_registration f
    join analytics.dim_date dd on dd.date_key = f.date_key
    group by dd.year, dd.month order by dd.year, dd.month;
end $$;


--
-- Name: get_registrations_by_batch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_registrations_by_batch() RETURNS TABLE(batch integer, registrations integer, checked_in integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if coalesce(public.auth_role(), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select du.batch, count(*)::int,
           (count(*) filter (where f.attendee_status = 'checked_in'))::int
    from analytics.fact_registration f
    join analytics.dim_user du on du.user_key = f.user_key
    where f.attendee_status <> 'cancelled'
    group by du.batch order by du.batch;
end $$;


--
-- Name: get_registrations_by_department(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_registrations_by_department() RETURNS TABLE(department text, program text, registrations integer, checked_in integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if coalesce(public.auth_role(), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select du.department, du.program, count(*)::int,
           (count(*) filter (where f.attendee_status = 'checked_in'))::int
    from analytics.fact_registration f
    join analytics.dim_user du on du.user_key = f.user_key
    where f.attendee_status <> 'cancelled'
    group by du.department, du.program order by 3 desc;
end $$;


--
-- Name: get_total_alumni_growth(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_total_alumni_growth(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(date_str text, cumulative_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_start date;
  v_end date;
begin
  if coalesce(auth_role(), '') <> 'admin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Find the earliest date to start the chart
  select coalesce(p_start_date::date, min(created_at)::date, current_date)
  into v_start
  from public.users where role = 'alumni';

  if v_start is null then return; end if;
  v_end := current_date;

  return query
  with months as (
    select date_trunc('month', d)::date as m_date
    from generate_series(v_start, v_end, interval '1 month') d
  ),
  counts as (
    select 
      date_trunc('month', created_at)::date as c_date,
      count(id)::integer as new_alumni
    from public.users
    where role = 'alumni'
    group by 1
  )
  select
    to_char(m.m_date, 'YYYY-MM') as date_str,
    coalesce(
      sum(coalesce(c.new_alumni, 0)) over (order by m.m_date rows between unbounded preceding and current row),
      0
    )::integer as cumulative_count
  from months m
  left join counts c on c.c_date = m.m_date
  order by m.m_date asc;
end;
$$;


--
-- Name: get_user_counts_by_department(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_counts_by_department() RETURNS TABLE(department text, alumni_count integer, total_users integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
#variable_conflict use_column
begin
  if coalesce(auth_role(), '') <> 'admin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select
    u.department,   -- Qualified with alias 'u'
    count(u.id) filter (where u.role = 'alumni')::integer as alumni_count,
    count(u.id)::integer as total_users
  from public.users u
  group by u.department
  order by total_users desc;
end;
$$;


--
-- Name: get_user_counts_by_department(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_counts_by_department(p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE(department text, alumni_count integer, total_users integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
#variable_conflict use_column
begin
  if coalesce(auth_role(), '') <> 'admin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  select
    u.department,
    count(u.id) filter (where u.role = 'alumni')::integer as alumni_count,
    count(u.id)::integer as total_users
  from public.users u
  where (p_start_date is null or u.created_at >= p_start_date)
  group by u.department
  order by total_users desc;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
    insert into public.users
        (id, first_name, last_name, email, phone, department, program, batch, role)
    values (
        new.id,
        coalesce(m ->> 'first_name', ''),
        coalesce(m ->> 'last_name',  ''),
        new.email,
        coalesce(m ->> 'phone',      ''),
        coalesce(m ->> 'department', ''),
        coalesce(m ->> 'program',    ''),
        coalesce(nullif(m ->> 'batch', '')::integer, 0),
        'alumni'
    );
    return new;
end;
$$;


--
-- Name: mark_no_show(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_no_show(p_registration_id integer) RETURNS public.registrations
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


--
-- Name: prevent_self_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_self_role_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if new.role is distinct from old.role then
        -- Block anyone from changing their own role
        if auth.uid() = old.id then
            raise exception 'cannot change your own role' using errcode = 'P0001';
        end if;
        -- Block non-admin from changing anyone's role
        if auth.uid() is not null and coalesce(public.auth_role(), '') <> 'admin' then
            raise exception 'not allowed' using errcode = '42501';
        end if;
    end if;
    return new;
end;
$$;


--
-- Name: refresh_analytics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_analytics() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if coalesce(public.auth_role(), '') <> 'admin' then raise exception 'not allowed' using errcode = '42501'; end if;
  perform analytics.run_etl();
end $$;


--
-- Name: register_for_event(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_for_event(p_event_id integer) RETURNS public.registrations
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_event events%rowtype;
    v_count integer;
    v_reg   registrations%rowtype;
begin
    if auth.uid() is null then
        raise exception 'not authenticated' using errcode = '28000';
    end if;

    select * into v_event from events where id = p_event_id for update;
    if not found then
        raise exception 'event not found' using errcode = 'P0002';
    end if;
    if v_event.status <> 'listed' then
        raise exception 'event is closed' using errcode = 'P0001';
    end if;

    select count(*) into v_count
    from registrations
    where event_id = p_event_id and attendee_status <> 'cancelled';

    if v_event.capacity is not null and v_count >= v_event.capacity then
        raise exception 'event is full' using errcode = 'P0001';
    end if;

    -- a duplicate active registration raises unique_violation (23505)
    insert into registrations (event_id, user_id, payment_status)
    values (
        p_event_id, auth.uid(),
        case when coalesce(v_event.price, 0) = 0 then 'free'::payment_status
             else 'unpaid'::payment_status end
    )
    returning * into v_reg;

    return v_reg;
end;
$$;


--
-- Name: search_users(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_users(p_term text) RETURNS SETOF public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select *
    from users
    where coalesce(auth_role(), '') = 'admin'
      and (
          p_term is null or p_term = ''
          or first_name ilike '%' || p_term || '%'
          or last_name  ilike '%' || p_term || '%'
          or email      ilike '%' || p_term || '%'
      )
    order by last_name, first_name
    limit 25;
$$;


--
-- Name: sync_check_ins(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_check_ins(p_batch jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_item   record;
    v_reg    registrations%rowtype;
    v_result scan_result;
    v_out    jsonb := '[]'::jsonb;
begin
    if coalesce(auth_role(), '') not in ('admin', 'volunteer') then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    for v_item in
        select (x ->> 'client_id')::uuid                       as client_id,
               (x ->> 'registration_id')::integer              as registration_id,
               (x ->> 'device_time')::timestamptz              as device_time,
               x ->> 'device_id'                               as device_id,
               coalesce((x ->> 'is_offline')::boolean, false)  as is_offline
        from jsonb_array_elements(p_batch) x
        order by 3
    loop
        select l.result into v_result from check_in_log l where l.client_id = v_item.client_id;
        if found then
            v_out := v_out || jsonb_build_object('client_id', v_item.client_id, 'result', v_result);
            continue;
        end if;

        select * into v_reg from registrations where id = v_item.registration_id for update;
        if not found then
            v_out := v_out || jsonb_build_object('client_id', v_item.client_id, 'result', 'rejected');
            continue;
        end if;

        if v_reg.attendee_status = 'cancelled' then
            v_result := 'rejected';

        elsif v_reg.attendee_status = 'not_checked_in' then
            v_result := 'accepted';

            -- UPDATED LOGIC: If they are unpaid, mark them as paid automatically
            update registrations
            set attendee_status = 'checked_in', 
                checked_in_at = v_item.device_time,
                payment_status = case when payment_status = 'unpaid' then 'paid'::payment_status else payment_status end,
                payment_collected_by = case when payment_status = 'unpaid' then auth.uid() else payment_collected_by end,
                payment_collected_at = case when payment_status = 'unpaid' then v_item.device_time else payment_collected_at end
            where id = v_reg.id;

        elsif v_item.device_time < v_reg.checked_in_at then
            update check_in_log set result = 'duplicate'
            where registration_id = v_reg.id and result = 'accepted';
            update registrations set checked_in_at = v_item.device_time where id = v_reg.id;
            v_result := 'accepted';

        else
            v_result := 'duplicate';
        end if;

        insert into check_in_log
            (client_id, registration_id, event_id, scanned_by, device_id, result, is_offline, device_time)
        values
            (v_item.client_id, v_reg.id, v_reg.event_id, auth.uid(),
             v_item.device_id, v_result, v_item.is_offline, v_item.device_time);

        v_out := v_out || jsonb_build_object('client_id', v_item.client_id, 'result', v_result);
    end loop;

    return v_out;
end;
$$;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id integer NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: check_in_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_in_log (
    id integer NOT NULL,
    client_id uuid NOT NULL,
    registration_id integer NOT NULL,
    event_id integer NOT NULL,
    scanned_by uuid NOT NULL,
    device_id text,
    result public.scan_result NOT NULL,
    is_offline boolean DEFAULT false NOT NULL,
    device_time timestamp with time zone NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: check_in_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.check_in_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.check_in_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    name text NOT NULL,
    venue text NOT NULL,
    description text NOT NULL,
    event_date timestamp with time zone NOT NULL,
    price numeric(10,2),
    capacity integer,
    banner_url text,
    status public.event_status DEFAULT 'listed'::public.event_status NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    closed_at timestamp with time zone,
    CONSTRAINT events_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT events_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.registrations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.registrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: check_in_log check_in_log_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_log
    ADD CONSTRAINT check_in_log_client_id_key UNIQUE (client_id);


--
-- Name: check_in_log check_in_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_log
    ADD CONSTRAINT check_in_log_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: registrations registrations_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_qr_token_key UNIQUE (qr_token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_log_record_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_record_idx ON public.audit_log USING btree (table_name, record_id);


--
-- Name: check_in_log_registration_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX check_in_log_registration_idx ON public.check_in_log USING btree (registration_id, device_time);


--
-- Name: events_listed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_listed_idx ON public.events USING btree (event_date) WHERE (status = 'listed'::public.event_status);


--
-- Name: registrations_active_event_user_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registrations_active_event_user_uniq ON public.registrations USING btree (event_id, user_id) WHERE (attendee_status <> 'cancelled'::public.attendee_status);


--
-- Name: registrations_event_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registrations_event_status_idx ON public.registrations USING btree (event_id, attendee_status);


--
-- Name: registrations_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registrations_user_created_idx ON public.registrations USING btree (user_id, created_at DESC);


--
-- Name: users_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_name_trgm_idx ON public.users USING gin ((((first_name || ' '::text) || last_name)) extensions.gin_trgm_ops);


--
-- Name: event_dashboard_stats _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.event_dashboard_stats WITH (security_invoker='true') AS
 SELECT e.id AS event_id,
    e.name,
    e.capacity,
    count(r.id) FILTER (WHERE (r.attendee_status <> 'cancelled'::public.attendee_status)) AS registered,
    count(r.id) FILTER (WHERE (r.attendee_status = 'checked_in'::public.attendee_status)) AS checked_in,
    count(r.id) FILTER (WHERE (r.attendee_status = 'cancelled'::public.attendee_status)) AS cancelled,
    count(r.id) FILTER (WHERE (r.payment_status = 'paid'::public.payment_status)) AS paid,
    count(r.id) FILTER (WHERE ((r.payment_status = 'unpaid'::public.payment_status) AND (r.attendee_status <> 'cancelled'::public.attendee_status))) AS unpaid,
    (((count(r.id) FILTER (WHERE (r.payment_status = 'paid'::public.payment_status)))::numeric * COALESCE(e.price, (0)::numeric)))::numeric(12,2) AS revenue
   FROM (public.events e
     LEFT JOIN public.registrations r ON ((r.event_id = e.id)))
  GROUP BY e.id;


--
-- Name: events events_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_audit_trg AFTER INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.audit_events();


--
-- Name: events events_closed_at_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_closed_at_trg BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_set_closed_at();


--
-- Name: registrations registrations_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER registrations_audit_trg AFTER UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.audit_registrations();


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: check_in_log check_in_log_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_log
    ADD CONSTRAINT check_in_log_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: check_in_log check_in_log_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_log
    ADD CONSTRAINT check_in_log_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id);


--
-- Name: check_in_log check_in_log_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_in_log
    ADD CONSTRAINT check_in_log_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.users(id);


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: registrations registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);


--
-- Name: registrations registrations_payment_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_payment_collected_by_fkey FOREIGN KEY (payment_collected_by) REFERENCES public.users(id);


--
-- Name: registrations registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT TO authenticated USING ((( SELECT public.auth_role() AS auth_role) = 'admin'::text));


--
-- Name: check_in_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.check_in_log ENABLE ROW LEVEL SECURITY;

--
-- Name: check_in_log check_in_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY check_in_log_select ON public.check_in_log FOR SELECT TO authenticated USING ((( SELECT public.auth_role() AS auth_role) = ANY (ARRAY['admin'::text, 'volunteer'::text])));


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_admin_write ON public.events TO authenticated USING ((( SELECT public.auth_role() AS auth_role) = 'admin'::text)) WITH CHECK ((( SELECT public.auth_role() AS auth_role) = 'admin'::text));


--
-- Name: events events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (true);


--
-- Name: registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: registrations registrations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY registrations_select ON public.registrations FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.auth_role() AS auth_role) = 'admin'::text)));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_auth_hook; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_auth_hook ON public.users FOR SELECT TO supabase_auth_admin USING (true);


--
-- Name: users users_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select ON public.users FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.auth_role() AS auth_role) = 'admin'::text)));


--
-- Name: users users_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_admin ON public.users FOR UPDATE TO authenticated USING ((( SELECT public.auth_role() AS auth_role) = 'admin'::text)) WITH CHECK ((( SELECT public.auth_role() AS auth_role) = 'admin'::text));


--
-- Name: users users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_self ON public.users FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
--



CREATE SCHEMA analytics;


--
-- Name: run_etl(); Type: FUNCTION; Schema: analytics; Owner: -
--

CREATE FUNCTION analytics.run_etl() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into analytics.dim_event (event_id, name, event_date, price, capacity, status)
  select id, name, event_date, price, capacity, status::text from public.events
  on conflict (event_id) do update
    set name = excluded.name, event_date = excluded.event_date, price = excluded.price,
        capacity = excluded.capacity, status = excluded.status;

  insert into analytics.dim_user (user_id, department, program, batch, role)
  select id, department, program, batch, role::text from public.users
  on conflict (user_id) do update
    set department = excluded.department, program = excluded.program,
        batch = excluded.batch, role = excluded.role;

  insert into analytics.fact_registration
    (registration_id, event_key, user_key, date_key, attendee_status, payment_status, amount)
  select r.id, de.event_key, du.user_key,
         to_char(r.created_at at time zone 'Asia/Manila', 'YYYYMMDD')::int,
         r.attendee_status::text, r.payment_status::text,
         case when r.payment_status = 'paid' and r.attendee_status <> 'cancelled'
              then coalesce(e.price, 0) else 0 end
  from public.registrations r
  join public.events e        on e.id = r.event_id
  join analytics.dim_event de on de.event_id = r.event_id
  join analytics.dim_user  du on du.user_id  = r.user_id
  on conflict (registration_id) do update
    set attendee_status = excluded.attendee_status,
        payment_status  = excluded.payment_status,
        amount          = excluded.amount;
end $$;




--
-- Name: dim_date; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.dim_date (
    date_key integer NOT NULL,
    full_date date NOT NULL,
    year integer,
    month integer,
    day integer
);


--
-- Name: dim_event; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.dim_event (
    event_key integer NOT NULL,
    event_id integer NOT NULL,
    name text,
    event_date timestamp with time zone,
    price numeric(10,2),
    capacity integer,
    status text
);


--
-- Name: dim_event_event_key_seq; Type: SEQUENCE; Schema: analytics; Owner: -
--

CREATE SEQUENCE analytics.dim_event_event_key_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_event_event_key_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: -
--

ALTER SEQUENCE analytics.dim_event_event_key_seq OWNED BY analytics.dim_event.event_key;


--
-- Name: dim_user; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.dim_user (
    user_key integer NOT NULL,
    user_id uuid NOT NULL,
    department text,
    program text,
    batch integer,
    role text
);


--
-- Name: dim_user_user_key_seq; Type: SEQUENCE; Schema: analytics; Owner: -
--

CREATE SEQUENCE analytics.dim_user_user_key_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dim_user_user_key_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: -
--

ALTER SEQUENCE analytics.dim_user_user_key_seq OWNED BY analytics.dim_user.user_key;


--
-- Name: fact_registration; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.fact_registration (
    registration_id integer NOT NULL,
    event_key integer,
    user_key integer,
    date_key integer,
    attendee_status text,
    payment_status text,
    amount numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: dim_event event_key; Type: DEFAULT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_event ALTER COLUMN event_key SET DEFAULT nextval('analytics.dim_event_event_key_seq'::regclass);


--
-- Name: dim_user user_key; Type: DEFAULT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_user ALTER COLUMN user_key SET DEFAULT nextval('analytics.dim_user_user_key_seq'::regclass);


--
-- Name: dim_date dim_date_full_date_key; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_date
    ADD CONSTRAINT dim_date_full_date_key UNIQUE (full_date);


--
-- Name: dim_date dim_date_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_date
    ADD CONSTRAINT dim_date_pkey PRIMARY KEY (date_key);


--
-- Name: dim_event dim_event_event_id_key; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_event
    ADD CONSTRAINT dim_event_event_id_key UNIQUE (event_id);


--
-- Name: dim_event dim_event_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_event
    ADD CONSTRAINT dim_event_pkey PRIMARY KEY (event_key);


--
-- Name: dim_user dim_user_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_user
    ADD CONSTRAINT dim_user_pkey PRIMARY KEY (user_key);


--
-- Name: dim_user dim_user_user_id_key; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.dim_user
    ADD CONSTRAINT dim_user_user_id_key UNIQUE (user_id);


--
-- Name: fact_registration fact_registration_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.fact_registration
    ADD CONSTRAINT fact_registration_pkey PRIMARY KEY (registration_id);


--
-- Name: fact_registration_date_key_idx; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX fact_registration_date_key_idx ON analytics.fact_registration USING btree (date_key);


--
-- Name: fact_registration_event_key_idx; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX fact_registration_event_key_idx ON analytics.fact_registration USING btree (event_key);


--
-- Name: fact_registration_user_key_idx; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX fact_registration_user_key_idx ON analytics.fact_registration USING btree (user_key);


--
-- Name: fact_registration fact_registration_date_key_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.fact_registration
    ADD CONSTRAINT fact_registration_date_key_fkey FOREIGN KEY (date_key) REFERENCES analytics.dim_date(date_key);


--
-- Name: fact_registration fact_registration_event_key_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.fact_registration
    ADD CONSTRAINT fact_registration_event_key_fkey FOREIGN KEY (event_key) REFERENCES analytics.dim_event(event_key);


--
-- Name: fact_registration fact_registration_user_key_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.fact_registration
    ADD CONSTRAINT fact_registration_user_key_fkey FOREIGN KEY (user_key) REFERENCES analytics.dim_user(user_key);


--
-- Name: dim_date; Type: ROW SECURITY; Schema: analytics; Owner: -
--

ALTER TABLE analytics.dim_date ENABLE ROW LEVEL SECURITY;

--
-- Name: dim_event; Type: ROW SECURITY; Schema: analytics; Owner: -
--

ALTER TABLE analytics.dim_event ENABLE ROW LEVEL SECURITY;

--
-- Name: dim_user; Type: ROW SECURITY; Schema: analytics; Owner: -
--

ALTER TABLE analytics.dim_user ENABLE ROW LEVEL SECURITY;

--
-- Name: fact_registration; Type: ROW SECURITY; Schema: analytics; Owner: -
--

ALTER TABLE analytics.fact_registration ENABLE ROW LEVEL SECURITY;

SET check_function_bodies = on;