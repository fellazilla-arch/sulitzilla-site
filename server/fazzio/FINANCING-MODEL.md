# Fazzio private financing – recommended pricing model

Seller-internal memo (not served publicly). Every number below is a default in `fazzio/pricing.js`
and can be changed at `/fazzio/admin/` → Settings without touching code.

## Recommendation in one paragraph

Price the installment plan with a **flat monthly financing rate on the amount financed**, stepping up with
plan length: **0.50% / 0.65% / 0.80% / 0.90% per month** for 1–6 / 7–12 / 13–18 / 19–24 months. Require
**₱10,000 down**, cap plans at **24 months**, and set a **₱1,500** floor on any monthly payment. Allow early
pay-off at any time with **no penalty**, charging only the unpaid share of the cash price. Your preliminary
₱10,000 down / ₱3,000 a month idea comes out almost exactly where you guessed: **22 payments, ₱75,890 total,
₱10,890 premium**, which works out to about a **21% effective yearly return**. The Sumisho quote costs the buyer
**50–60% a year**.

## Why these numbers

| Component | Roughly per year | Reasoning |
|---|---|---|
| Cost of capital | 5–6% | What ₱65,000 cash would earn in a digital bank / time deposit |
| Default and recovery risk | 8–10% | No credit check, private enforcement, recovering a bike costs time and money, and a used bike resells below the balance |
| Admin and hassle | 2–4% | Tracking payments, follow-ups, transfer paperwork at the end |
| **Target effective yearly rate** | **≈ 15–21%** | Below bank personal loans (≈ 25–35% effective) and far below motorcycle dealer financing |

A flat rate on the original amount financed costs more than the same rate on a declining balance. That's why
0.90% flat per month shows up as about 21% a year (effective).

**Shorter plans get a lower rate.** Less time means less risk, and the buyer gets a clear reason to pay faster:

| Plan length | Rate / month | Effective / year | Example (₱10,000 down) |
|---|---|---|---|
| 1–6 months | 0.50% | ≈ 10.7% | 6 × ₱9,450 → total ₱66,650 (premium ₱1,650) |
| 7–12 months | 0.65% | ≈ 15.1% | 12 × ₱4,950 → total ₱69,290 (premium ₱4,290) |
| 13–18 months | 0.80% | ≈ 19.0% | 18 × ₱3,500 → total ₱72,920 (premium ₱7,920) |
| 19–24 months | 0.90% | ≈ 21.4% | 24 × ₱2,790 → total ₱76,880 (premium ₱11,880) |

**Bigger down payments reduce the premium automatically**, because the rate only applies to what's financed.
For example, 24 months with ₱20,000 down is ₱2,280 a month and ₱74,720 in total.

## Against the dealer quote (Click 125 SE, rebate applied every month)

| Term | Sumisho total | Sumisho cost over cash | Fazzio total (₱10k down) | Fazzio cost over cash |
|---|---|---|---|---|
| 12 mo | ₱74,644 | ₱14,962 (≈ 60%/yr) | ₱69,290 | ₱4,290 (≈ 15%/yr) |
| 18 mo | ₱81,316 | ₱21,634 (≈ 57%/yr) | ₱72,920 | ₱7,920 (≈ 19%/yr) |
| 24 mo | ₱87,664 | ₱27,982 (≈ 54%/yr) | ₱76,880 | ₱11,880 (≈ 21%/yr) |

He pays less in total for a motorcycle with a higher cash value, and he skips the waiting list.

## The approved rules (what the calculator enforces)

1. **Minimum down payment: ₱10,000** (≈ 15%). This covers the immediate resale haircut and recovery costs
   if the plan fails early. Below that, our exposure is larger than the bike's quick-sale value.
2. **Minimum monthly payment: ₱1,500**, and in practice whatever finishes the plan within 24 months. With ₱10,000
   down that's **₱2,790**; with ₱20,000 down, ₱2,280. The page works this out and shows it live.
3. **Maximum duration: 24 months.** Beyond that the bike depreciates faster than the balance falls, so the
   collateral stops covering us.
4. **Financing premium by period:** the tier table above.
5. **Total installment price** = down payment + amount financed × (1 + rate × months). Payments are equal, with a
   smaller final payment for the remainder. The calculator never invents a price outside this formula.
6. **Early repayment:** allowed any time with no penalty. Each payment is split between the cash price and the
   financing charge in a fixed proportion. Pay-off amount = the unpaid share of the cash price plus any unpaid
   late fees, so the unearned financing charge is waived in full. Extra partial payments shorten the plan.
7. **Late fees and default:** 5-day grace; ₱100 at days 6–15; another ₱200 at days 16–30 (capped at ₱300 per
   installment, never daily, never compounded); written notice after 30 days; formal default notice after 2
   consecutive misses with a **15-day cure period**; remedies only after 3 unpaid installments.

Out-of-terms inputs (for example ₱5,000 down and ₱1,000 a month) are still shown so the buyer can see the effect,
but they're flagged **"Outside approved terms"** with one-tap fixes, and the admin list tags them in the same way.
Submissions are re-priced on the server, so the stored numbers always follow the approved formula.

## Protecting the capital (practical checklist)

- **Paperwork:** a notarized *Deed of Conditional Sale* (the Seller keeps ownership until full payment) plus a
  promissory note with the schedule attached. Take copies of the buyer's IDs and proof of address. Photograph the
  bike and the odometer at handover.
- **Registration:** the CR stays in the Seller's name. Give the buyer the current OR, a CR photocopy, and a
  notarized authorization to use the motorcycle.
- **Insurance:** CTPL is mandatory. Strongly push comprehensive insurance with theft coverage, naming the Seller
  as loss payee, because theft is the biggest single risk to the capital.
- **Collection:** bank transfer or GCash on a fixed day, with receipts. Optional: post-dated cheques or scheduled
  transfers.
- **Law to respect:** Civil Code Art. 1484 (the "Recto Law") applies to installment sales of personal property.
  After 2 or more missed installments the seller may (a) demand payment, (b) cancel the sale, or (c) foreclose a
  chattel mortgage. Under (b) or (c), the seller **cannot also collect the deficiency**. Art. 1486 allows keeping
  part of the payments made only if that is not unconscionable. The page's voluntary-return clause (refund any
  surplus over the pay-off amount; seller absorbs any shortfall) is written to stay inside these limits. Have a
  lawyer review the final agreement before signing.

## When to revisit

- If the buyer wants longer than 24 months: add a 25–30 month tier at ≈ 1.0%/month and raise the minimum down
  to ₱15,000.
- If comprehensive insurance isn't taken: consider 0.10%/month more on every tier, or ₱15,000 down.
- If the market price of 2025 Fazzios drops: update the cash benchmark in Settings. Everything else
  recalculates.
