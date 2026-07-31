-- Ejecutar en el SQL Editor de Supabase (Project > SQL Editor > New query).
-- Es seguro re-ejecutar completo: crea la tabla si no existe y reemplaza
-- las policies de RLS por la version que soporta login web (auth.uid()).

create table if not exists movimientos (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,          -- auth.uid() (login web) o telegram chat_id (bot)
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  monto numeric not null check (monto > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  categoria text not null check (categoria in (
    'comida', 'transporte', 'servicios', 'entretenimiento',
    'salud', 'indumentaria', 'hogar', 'sueldo', 'otros'
  )),
  descripcion text,
  mensaje_original text,
  created_at timestamptz not null default now()
);

-- Migracion para instalaciones que ya tenian la tabla sin la columna moneda.
alter table movimientos add column if not exists moneda text not null default 'ARS';
alter table movimientos drop constraint if exists movimientos_moneda_check;
alter table movimientos add constraint movimientos_moneda_check check (moneda in ('ARS', 'USD'));

create index if not exists movimientos_user_id_created_at_idx
  on movimientos (user_id, created_at desc);

alter table movimientos enable row level security;

-- Policies de versiones anteriores (sin auth), se reemplazan por completo.
drop policy if exists "Lectura pública de movimientos" on movimientos;
drop policy if exists "movimientos_select_own" on movimientos;
drop policy if exists "movimientos_insert_own" on movimientos;
drop policy if exists "movimientos_update_own" on movimientos;
drop policy if exists "movimientos_delete_own" on movimientos;

-- Cada usuario autenticado (login web) solo ve y modifica sus propias filas.
-- El bot de Telegram inserta con la service role key, que bypassea RLS por
-- diseño, así que estas policies no le aplican a él.
create policy "movimientos_select_own"
  on movimientos for select
  to authenticated
  using ((select auth.uid())::text = user_id);

create policy "movimientos_insert_own"
  on movimientos for insert
  to authenticated
  with check ((select auth.uid())::text = user_id);

create policy "movimientos_update_own"
  on movimientos for update
  to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

create policy "movimientos_delete_own"
  on movimientos for delete
  to authenticated
  using ((select auth.uid())::text = user_id);

-- Ahorros: metas de ahorro con nombre propio (ej. "Auto", "Celu nuevo"),
-- cada una con un monto actual y, opcionalmente, una meta a alcanzar.
create table if not exists ahorros (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  nombre text not null,
  monto_actual numeric not null default 0 check (monto_actual >= 0),
  meta numeric check (meta is null or meta > 0),
  created_at timestamptz not null default now()
);

create index if not exists ahorros_user_id_created_at_idx
  on ahorros (user_id, created_at desc);

alter table ahorros enable row level security;

drop policy if exists "ahorros_select_own" on ahorros;
drop policy if exists "ahorros_insert_own" on ahorros;
drop policy if exists "ahorros_update_own" on ahorros;
drop policy if exists "ahorros_delete_own" on ahorros;

create policy "ahorros_select_own"
  on ahorros for select
  to authenticated
  using ((select auth.uid())::text = user_id);

create policy "ahorros_insert_own"
  on ahorros for insert
  to authenticated
  with check ((select auth.uid())::text = user_id);

create policy "ahorros_update_own"
  on ahorros for update
  to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

create policy "ahorros_delete_own"
  on ahorros for delete
  to authenticated
  using ((select auth.uid())::text = user_id);

-- Recordatorios: gastos fijos recurrentes (alquiler, servicios, etc.) con un
-- dia de vencimiento en el mes. El cron de notificaciones (api/cron/recordatorios.ts)
-- avisa por Telegram 3 dias antes y el dia del vencimiento, y resetea el
-- estado de "pagado" cuando cambia el periodo (mes) actual.
create table if not exists recordatorios (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  nombre text not null,
  monto numeric not null check (monto > 0),
  categoria text not null check (categoria in (
    'comida', 'transporte', 'servicios', 'entretenimiento',
    'salud', 'indumentaria', 'hogar', 'sueldo', 'otros'
  )),
  dia_vencimiento smallint not null check (dia_vencimiento between 1 and 31),
  activo boolean not null default true,
  -- Periodo (formato 'YYYY-MM') al que corresponde el estado pagado/notificado
  -- de mas abajo. El cron lo compara contra el mes actual y resetea si cambio.
  periodo_actual text,
  pagado boolean not null default false,
  notificado_3dias boolean not null default false,
  notificado_vencimiento boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists recordatorios_user_id_activo_idx
  on recordatorios (user_id, activo);

alter table recordatorios enable row level security;

drop policy if exists "recordatorios_select_own" on recordatorios;
drop policy if exists "recordatorios_insert_own" on recordatorios;
drop policy if exists "recordatorios_update_own" on recordatorios;
drop policy if exists "recordatorios_delete_own" on recordatorios;

create policy "recordatorios_select_own"
  on recordatorios for select
  to authenticated
  using ((select auth.uid())::text = user_id);

create policy "recordatorios_insert_own"
  on recordatorios for insert
  to authenticated
  with check ((select auth.uid())::text = user_id);

create policy "recordatorios_update_own"
  on recordatorios for update
  to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);

create policy "recordatorios_delete_own"
  on recordatorios for delete
  to authenticated
  using ((select auth.uid())::text = user_id);

-- Vinculo entre una cuenta de Supabase Auth (login web) y un chat de Telegram.
-- Reemplaza el viejo esquema de "bot privado" (un unico TELEGRAM_USER_ID /
-- TELEGRAM_ALLOWED_CHAT_ID fijados por variable de entorno): ahora cualquier
-- usuario que se registre en la app puede generar un codigo desde
-- Configuracion, mandarle "/start <codigo>" al bot por Telegram, y el webhook
-- (api/webhook.ts) vincula ese chat_id a su user_id. Todas las escrituras las
-- hace el backend con la service role key (ver api/telegram/link.ts,
-- api/telegram/unlink.ts y api/webhook.ts) — el frontend solo puede leer su
-- propia fila.
create table if not exists telegram_links (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique,
  chat_id text unique,
  link_code text unique,
  link_code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_links_chat_id_idx on telegram_links (chat_id);
create index if not exists telegram_links_link_code_idx on telegram_links (link_code);

alter table telegram_links enable row level security;

drop policy if exists "telegram_links_select_own" on telegram_links;

create policy "telegram_links_select_own"
  on telegram_links for select
  to authenticated
  using ((select auth.uid())::text = user_id);

-- Rate limiting: guarda timestamps de mensajes por chat_id de Telegram
-- para evitar que un usuario sature al bot. Solo el backend (service role)
-- lee/escribe acá. RLS habilitado sin policies = deny-all para el frontend.
create table if not exists rate_limit_messages (
  id bigint generated always as identity primary key,
  chat_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_messages_chat_id_created_at_idx
  on rate_limit_messages (chat_id, created_at desc);

alter table rate_limit_messages enable row level security;

-- Función atómica: cuenta mensajes en la ventana, registra el nuevo
-- si está dentro del límite, y limpia mensajes viejos (> 5 min).
create or replace function check_rate_limit(
  p_chat_id text,
  p_window_seconds int,
  p_max_messages int
)
returns json
language plpgsql
security invoker
as $$
declare
  v_window_start timestamptz;
  v_count int;
  v_oldest timestamptz;
  v_retry_after numeric;
begin
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  select count(*) into v_count
  from rate_limit_messages
  where chat_id = p_chat_id
    and created_at > v_window_start;

  if v_count >= p_max_messages then
    select min(created_at) into v_oldest
    from rate_limit_messages
    where chat_id = p_chat_id
      and created_at > v_window_start;

    v_retry_after := extract(epoch from (v_oldest + (p_window_seconds || ' seconds')::interval - now()));
    if v_retry_after < 1 then
      v_retry_after := 1;
    end if;

    return json_build_object(
      'allowed', false,
      'current_count', v_count,
      'retry_after_seconds', ceil(v_retry_after)
    );
  end if;

  insert into rate_limit_messages (chat_id) values (p_chat_id);

  delete from rate_limit_messages
  where created_at < now() - interval '5 minutes';

  return json_build_object(
    'allowed', true,
    'current_count', v_count + 1,
    'retry_after_seconds', null
  );
end;
$$;
