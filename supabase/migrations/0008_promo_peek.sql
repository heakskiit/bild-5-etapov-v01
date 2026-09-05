-- =====================================================================
-- 0008_promo_peek.sql
-- Read-only eligibility lookup, for showing the discounted total before
-- the customer pays (PROMO-6/8).
--
-- The checkout modal has to resolve a code's value while the customer is
-- still typing. Routing that through claim_promo_hold() (0007) would take a
-- real hold just to render a number, so merely opening the modal and typing
-- would squat codes for an hour. peek_promo() answers the same question
-- without writing anything.
--
-- ⚠ THE WHERE CLAUSE BELOW IS A DELIBERATE COPY of the one in
-- claim_promo_hold(). The two MUST stay in sync: if a code previews as valid
-- but then fails to hold, the customer watches a discount vanish at the very
-- last second, which is worse than never showing it.
--
-- It is duplicated rather than factored into a shared helper on purpose.
-- Rewriting claim_promo_hold()'s predicate would change the evaluation
-- semantics of the atomic UPDATE that guards against double-spend — and that
-- path is already verified working in production. A five-line copy with this
-- comment is the cheaper risk. If you edit one, edit both.
-- =====================================================================

create or replace function public.peek_promo(
  p_code    text,
  p_user_id uuid
)
returns table (discount_type discount_type, discount_value numeric)
language sql
stable
as $$
  select pc.discount_type, pc.discount_value
    from promo_codes pc
   where pc.code = p_code
     and pc.active
     and pc.used_at is null
     and (pc.held_until is null or pc.held_until < now())
     and (pc.expires_at is null or pc.expires_at > now())
     and (pc.reserved_for_user_id is null or pc.reserved_for_user_id = p_user_id)
   limit 1;
$$;

-- Same posture as 0007: not security definer, service-role only. The preview
-- route authenticates the customer and calls this with the service key; the
-- browser never reaches it directly.
revoke all on function public.peek_promo(text, uuid) from public, anon, authenticated;
grant execute on function public.peek_promo(text, uuid) to service_role;

notify pgrst, 'reload schema';