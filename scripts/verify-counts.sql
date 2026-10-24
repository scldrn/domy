-- Domy restore check (release review DEPLOY-1): one line per base table with its row count,
-- then the COP totals that money reconciliation depends on. Read-only. scripts/restore.sh runs
-- it against the live and the restored database; compare both columns.
select 'rows ' || table_schema || '.' || table_name as item,
  (xpath('/row/c/text()', query_to_xml(
    format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')
  ))[1]::text as value
from information_schema.tables
where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE'
union all
select 'cop shipments.fee', coalesce(sum(fee), 0)::text from public.shipments
union all
select 'cop shipments.cod_amount', coalesce(sum(cod_amount), 0)::text from public.shipments
union all
select 'cop courier_records.cash_amount', coalesce(sum(cash_amount), 0)::text
from public.courier_records
union all
select 'cop courier_records.company_transfer_amount',
  coalesce(sum(company_transfer_amount), 0)::text from public.courier_records
union all
select 'cop courier_records.merchant_transfer_amount',
  coalesce(sum(merchant_transfer_amount), 0)::text from public.courier_records
union all
select 'cop courier_records.disbursement_amount',
  coalesce(sum(disbursement_amount), 0)::text from public.courier_records
union all
select 'cop rate_card_entries.amount', coalesce(sum(amount), 0)::text
from public.rate_card_entries
order by 1;
