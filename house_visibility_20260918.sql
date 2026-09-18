-- Ejecutar una sola vez en el editor SQL del proyecto Supabase de House Management.
-- No borra casas ni modifica sus datos: todas empiezan visibles.
begin;

alter table public.houses
    add column if not exists visible_to_clients boolean not null default true;

-- La regla es adicional a los permisos existentes: una casa apagada no queda
-- disponible para admins, colaboradores ni propietarios, incluso por URL o API.
do $$
begin
    if not (select relrowsecurity from pg_class where oid = 'public.houses'::regclass) then
        raise exception 'La tabla houses no tiene RLS; revisar políticas antes de activar visibilidad por casa';
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'houses'
          and policyname = 'houses_visible_to_clients'
    ) then
        create policy houses_visible_to_clients
            on public.houses as restrictive for all to authenticated
            using (visible_to_clients or (select public.current_user_is_superadmin()))
            with check (visible_to_clients or (select public.current_user_is_superadmin()));
    end if;
end $$;

create or replace function public.superadmin_list_houses_visibility()
returns table (
    id uuid,
    nombre text,
    organization_id text,
    visible_to_clients boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if public.current_user_is_superadmin() is distinct from true then
        raise exception 'Sin permiso de superadministrador' using errcode = '42501';
    end if;

    return query
    select h.id, h.nombre::text,
           to_jsonb(h)->>'organization_id', h.visible_to_clients
    from public.houses h
    where coalesce(h.eliminada, false) = false
    order by h.nombre;
end;
$$;

create or replace function public.superadmin_set_house_visibility(
    p_house_id uuid,
    p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if public.current_user_is_superadmin() is distinct from true then
        raise exception 'Sin permiso de superadministrador' using errcode = '42501';
    end if;
    if p_house_id is null or p_visible is null then
        raise exception 'Faltan datos de la casa';
    end if;

    update public.houses
    set visible_to_clients = p_visible
    where id = p_house_id and coalesce(eliminada, false) = false;

    if not found then
        raise exception 'No se encontró la casa';
    end if;
    return true;
end;
$$;

revoke all on function public.superadmin_list_houses_visibility() from public, anon;
revoke all on function public.superadmin_set_house_visibility(uuid, boolean) from public, anon;
grant execute on function public.superadmin_list_houses_visibility() to authenticated;
grant execute on function public.superadmin_set_house_visibility(uuid, boolean) to authenticated;

commit;
