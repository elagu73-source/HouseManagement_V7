BEGIN;

ALTER TABLE public.reservation_details
    ADD COLUMN IF NOT EXISTS rental_payment_mode text NOT NULL DEFAULT 'legacy'
    CHECK (rental_payment_mode IN ('legacy', 'unico', 'adelanto_saldo'));

CREATE TABLE IF NOT EXISTS public.reservation_rental_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL REFERENCES public.house_reservations(id) ON DELETE CASCADE,
    payment_kind text NOT NULL CHECK (payment_kind IN ('unico','adelanto','saldo')),
    paid_on date NOT NULL,
    amount numeric(14,2) NOT NULL CHECK (amount > 0),
    commission_pct numeric(7,4) NOT NULL CHECK (commission_pct BETWEEN 0 AND 100),
    commission_amount numeric(14,2) GENERATED ALWAYS AS (round(amount * commission_pct / 100, 2)) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (reservation_id, payment_kind)
);

ALTER TABLE public.reservation_rental_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rental_payments_read ON public.reservation_rental_payments;
CREATE POLICY rental_payments_read ON public.reservation_rental_payments
FOR SELECT TO authenticated
USING (public.current_user_can_access_reservation(reservation_id));
DROP POLICY IF EXISTS rental_payments_write ON public.reservation_rental_payments;
CREATE POLICY rental_payments_write ON public.reservation_rental_payments
FOR ALL TO authenticated
USING (
    public.current_user_can_access_reservation(reservation_id)
    AND COALESCE(public.current_organization_role(), '') IN ('admin','colaborador')
)
WITH CHECK (
    public.current_user_can_access_reservation(reservation_id)
    AND COALESCE(public.current_organization_role(), '') IN ('admin','colaborador')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservation_rental_payments TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_cobros_alquiler(
    p_reservation_id uuid, p_mode text, p_payments jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public
AS $function$
DECLARE
    v_total numeric;
    v_pct numeric;
    v_suma numeric;
    v_cantidad integer;
BEGIN
    IF auth.uid() IS NULL OR COALESCE(public.current_organization_role(),'') NOT IN ('admin','colaborador') THEN
        RAISE EXCEPTION 'Sin permiso para guardar cobros';
    END IF;
    IF p_mode IS NULL OR p_mode NOT IN ('unico','adelanto_saldo') OR
       p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' THEN
        RAISE EXCEPTION 'Forma de pago no válida';
    END IF;
    SELECT rental_net, rental_commission_pct INTO v_total, v_pct
    FROM public.reservation_details WHERE reservation_id = p_reservation_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no disponible'; END IF;
    IF v_total IS NULL OR v_total < 0 OR v_pct IS NULL OR v_pct NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'Revisá el importe y la comisión del alquiler';
    END IF;
    IF jsonb_array_length(p_payments) > (CASE WHEN p_mode = 'unico' THEN 1 ELSE 2 END) THEN
        RAISE EXCEPTION 'Hay más cobros que los permitidos para esta forma de pago';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_payments) AS x(payment_kind text, paid_on date, amount numeric)
        WHERE x.payment_kind IS NULL OR x.paid_on IS NULL OR x.amount IS NULL OR
              x.amount <= 0 OR x.amount <> round(x.amount,2) OR x.amount::text IN ('NaN','Infinity','-Infinity') OR
              (p_mode = 'unico' AND x.payment_kind <> 'unico') OR
              (p_mode = 'adelanto_saldo' AND x.payment_kind NOT IN ('adelanto','saldo'))
    ) THEN RAISE EXCEPTION 'Revisá tipo, fecha e importe de cada cobro'; END IF;
    SELECT count(DISTINCT x.payment_kind), COALESCE(sum(x.amount),0)
    INTO v_cantidad, v_suma
    FROM jsonb_to_recordset(p_payments) AS x(payment_kind text, amount numeric);
    IF v_cantidad <> jsonb_array_length(p_payments) THEN RAISE EXCEPTION 'Hay cobros repetidos'; END IF;
    IF v_suma > round(v_total,2) THEN RAISE EXCEPTION 'Los cobros superan el total del alquiler'; END IF;

    UPDATE public.reservation_details SET rental_payment_mode = p_mode
    WHERE reservation_id = p_reservation_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo actualizar la reserva'; END IF;
    DELETE FROM public.reservation_rental_payments WHERE reservation_id = p_reservation_id;
    INSERT INTO public.reservation_rental_payments(reservation_id,payment_kind,paid_on,amount,commission_pct)
    SELECT p_reservation_id,x.payment_kind,x.paid_on,x.amount,v_pct
    FROM jsonb_to_recordset(p_payments) AS x(payment_kind text, paid_on date, amount numeric);
    RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.guardar_cobros_alquiler(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_cobros_alquiler(uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.house_rental_account_movements
WITH (security_invoker = true) AS
SELECT r.house_id, r.id AS reservation_id, r.check_in, r.check_out, d.tenant_name,
       p.paid_on, p.payment_kind, p.amount AS rental_gross, p.amount AS rental_net,
       p.commission_pct AS rental_commission_pct, p.commission_amount AS rental_commission,
       false AS legacy
FROM public.reservation_rental_payments p
JOIN public.house_reservations r ON r.id = p.reservation_id
JOIN public.reservation_details d ON d.reservation_id = r.id
WHERE d.rental_payment_mode <> 'legacy'
UNION ALL
SELECT r.house_id,r.id,r.check_in,r.check_out,d.tenant_name,r.check_in,'legacy'::text,
       COALESCE(d.rental_amount,0),COALESCE(d.rental_net,0),COALESCE(d.rental_commission_pct,0),COALESCE(d.rental_profit,0),true
FROM public.house_reservations r
JOIN public.reservation_details d ON d.reservation_id = r.id
WHERE d.rental_payment_mode = 'legacy';
GRANT SELECT ON public.house_rental_account_movements TO authenticated;

-- El resumen nuevo se agrega debajo. El resumen anterior se conserva.

CREATE OR REPLACE VIEW public.house_monthly_cost_summary_payments
WITH (security_invoker = true) AS
WITH reservas AS (
 SELECT m.house_id, date_trunc('month',m.paid_on::timestamp)::date AS month,
 'ARS'::text AS currency, m.rental_gross, m.rental_net, m.rental_commission,
 0::numeric AS cleaning_cost, 0::numeric AS cleaning_commission, 0 AS reservation_count
 FROM public.house_rental_account_movements m
 UNION ALL
 SELECT r.house_id,date_trunc('month',r.check_in::timestamp)::date,'ARS'::text,
 0::numeric,0::numeric,0::numeric,COALESCE(d.cleaning_amount,0),COALESCE(d.cleaning_profit,0),1
 FROM public.house_reservations r JOIN public.reservation_details d ON d.reservation_id=r.id
 ), gastos AS (
         SELECT i.house_id,
            date_trunc('month'::text, COALESCE(i.fecha, i.created_at::date)::timestamp without time zone)::date AS month,
            COALESCE(i.currency, 'ARS'::text) AS currency,
            COALESCE(i.work_cost, 0::numeric) AS work_cost,
            COALESCE(i.commission_amount, 0::numeric) AS commission_amount,
            COALESCE(i.total_cost, 0::numeric) AS total_cost,
            i.economic_status,
            1 AS incident_count
           FROM house_incidencias i
          WHERE i.work_cost IS NOT NULL
        UNION ALL
         SELECT p.house_id,
            date_trunc('month'::text, t.scheduled_date::timestamp without time zone)::date AS month,
            'ARS'::text AS currency,
            COALESCE(t.work_amount, 0::numeric) AS work_cost,
            COALESCE(t.commission_amount, 0::numeric) AS commission_amount,
            COALESCE(t.total_amount, 0::numeric) AS total_cost,
            'aprobado'::text AS economic_status,
            0 AS incident_count
           FROM house_maintenance_tasks t
             JOIN house_maintenance_plans p ON p.id = t.plan_id
          WHERE t.incident_id IS NULL AND t.work_amount IS NOT NULL
        ), reservas_mes AS (
         SELECT reservas.house_id,
            reservas.month,
            reservas.currency,
            sum(reservas.reservation_count) AS reservation_count,
            sum(reservas.rental_gross) AS rental_gross,
            sum(reservas.rental_net) AS rental_net,
            sum(reservas.rental_commission) AS rental_commission,
            sum(reservas.cleaning_cost) AS cleaning_cost,
            sum(reservas.cleaning_commission) AS cleaning_commission
           FROM reservas
          GROUP BY reservas.house_id, reservas.month, reservas.currency
        ), gastos_mes AS (
         SELECT gastos.house_id,
            gastos.month,
            gastos.currency,
            sum(gastos.incident_count) AS incident_count,
            count(*) FILTER (WHERE gastos.economic_status = 'pendiente'::text) AS pending_count,
            count(*) FILTER (WHERE gastos.economic_status = 'presupuestado'::text) AS budgeted_count,
            count(*) FILTER (WHERE gastos.economic_status = 'aprobado'::text) AS approved_count,
            count(*) FILTER (WHERE gastos.economic_status = 'rechazado'::text) AS rejected_count,
            count(*) FILTER (WHERE gastos.economic_status = 'pagado'::text) AS paid_count,
            sum(gastos.work_cost) AS work_subtotal,
            sum(gastos.commission_amount) AS commission_subtotal,
            sum(gastos.total_cost) AS total,
            sum(gastos.total_cost) FILTER (WHERE gastos.economic_status = 'aprobado'::text) AS approved_total,
            sum(gastos.total_cost) FILTER (WHERE gastos.economic_status = 'pagado'::text) AS paid_total
           FROM gastos
          GROUP BY gastos.house_id, gastos.month, gastos.currency
        ), claves AS (
         SELECT reservas_mes.house_id,
            reservas_mes.month,
            reservas_mes.currency
           FROM reservas_mes
        UNION
         SELECT gastos_mes.house_id,
            gastos_mes.month,
            gastos_mes.currency
           FROM gastos_mes
        )
 SELECT c.house_id,
    c.month,
    c.currency,
    COALESCE(r.reservation_count, 0::bigint) AS reservation_count,
    COALESCE(r.rental_gross, 0::numeric)::numeric(14,2) AS rental_gross,
    COALESCE(r.rental_net, 0::numeric)::numeric(14,2) AS rental_net,
    COALESCE(r.rental_commission, 0::numeric)::numeric(14,2) AS rental_commission,
    COALESCE(r.cleaning_cost, 0::numeric)::numeric(14,2) AS cleaning_cost,
    COALESCE(r.cleaning_commission, 0::numeric)::numeric(14,2) AS cleaning_commission,
    COALESCE(g.incident_count, 0::bigint) AS incident_count,
    COALESCE(g.pending_count, 0::bigint) AS pending_count,
    COALESCE(g.budgeted_count, 0::bigint) AS budgeted_count,
    COALESCE(g.approved_count, 0::bigint) AS approved_count,
    COALESCE(g.rejected_count, 0::bigint) AS rejected_count,
    COALESCE(g.paid_count, 0::bigint) AS paid_count,
    COALESCE(g.work_subtotal, 0::numeric)::numeric(14,2) AS work_subtotal,
    COALESCE(g.commission_subtotal, 0::numeric)::numeric(14,2) AS commission_subtotal,
    COALESCE(g.total, 0::numeric)::numeric(14,2) AS total,
    COALESCE(g.approved_total, 0::numeric)::numeric(14,2) AS approved_total,
    COALESCE(g.paid_total, 0::numeric)::numeric(14,2) AS paid_total,
    (COALESCE(r.rental_commission, 0::numeric) + COALESCE(r.cleaning_commission, 0::numeric) + COALESCE(g.commission_subtotal, 0::numeric))::numeric(14,2) AS ec_income,
    (COALESCE(r.cleaning_cost, 0::numeric) + COALESCE(r.cleaning_commission, 0::numeric) + COALESCE(g.work_subtotal, 0::numeric) + COALESCE(g.commission_subtotal, 0::numeric))::numeric(14,2) AS owner_expenses,
    (COALESCE(r.rental_net, 0::numeric) - COALESCE(r.rental_commission, 0::numeric) - COALESCE(r.cleaning_cost, 0::numeric) - COALESCE(r.cleaning_commission, 0::numeric) - COALESCE(g.work_subtotal, 0::numeric) - COALESCE(g.commission_subtotal, 0::numeric))::numeric(14,2) AS owner_net
   FROM claves c
     LEFT JOIN reservas_mes r ON r.house_id = c.house_id AND r.month = c.month AND r.currency = c.currency
     LEFT JOIN gastos_mes g ON g.house_id = c.house_id AND g.month = c.month AND g.currency = c.currency;
GRANT SELECT ON public.house_monthly_cost_summary_payments TO authenticated;
COMMIT;
