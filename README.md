# SolutionFinder

SolutionFinder is a public solution-discovery site with an authenticated,
private workspace. Public searches keep using the existing n8n webhook.
Signed-in searches are sent server-side to the same webhook and are stored
with the authenticated user's ID. Search history and saved recommendations
are protected by Supabase Row Level Security.

## Local development

```powershell
npm install
# Only if .env.local does not already exist:
Copy-Item .env.example .env.local
npm run dev
```

If `.env.local` already exists, preserve it and add only the missing variables
from `.env.example`.

Configure these in `.env.local` and your deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the public Supabase publishable key.
- `NEXT_PUBLIC_SITE_URL`: the app's origin (`http://localhost:3000` locally).
- `SUPABASE_SECRET_KEY`: Supabase's server-only secret key (or a legacy
  `service_role` key), used only by server-side Stripe, analytics, and public
  search protection code. Do not add a `NEXT_PUBLIC_` prefix.
- `PUBLIC_SEARCH_RATE_LIMIT_SECRET`: a long, random server-only HMAC secret;
  never use a `NEXT_PUBLIC_` prefix.
- `PUBLIC_SEARCH_LIMIT_PER_HOUR`: public anonymous search allowance per source
  IP address per UTC hour (default: 20).
- `N8N_FEEDBACK_WEBHOOK_URL`: optional HTTPS webhook for solution feedback.
- `N8N_WAITLIST_WEBHOOK_URL`: optional HTTPS webhook for waitlist submissions.
- `STRIPE_SECRET_KEY`: a Stripe test-mode secret key beginning with `sk_test_`.
- `STRIPE_PREMIUM_PRICE_ID`: the recurring Premium Price ID created in Stripe
  **test mode**.
- `STRIPE_WEBHOOK_SECRET`: the test webhook signing secret from the Stripe CLI
  or a configured Stripe test webhook endpoint.

Never place Supabase secret/service-role keys or Stripe secret keys in browser
code or `NEXT_PUBLIC_` variables. `.env.example` contains placeholders only.

In Supabase Authentication URL Configuration, allow
`http://localhost:3000/auth/callback` and the corresponding production callback.
Email/password sign-up and email confirmation must be enabled.
Email confirmation is a one-time account verification step. After the address
is confirmed, users sign in directly with their email and password; normal
sign-in does not send an email. If a confirmation message is missing, use
`/resend-confirmation`. Supabase's default SMTP service only delivers to
pre-authorized project team addresses and is heavily rate-limited, so configure
a custom SMTP provider in Supabase Authentication SMTP settings to deliver
confirmation mail to Gmail. Keep email confirmation enabled; disabling it skips
verification rather than fixing email delivery.

## Apply the database migrations manually

No database changes are run automatically. For a new database only, apply
[`supabase/migrations/202609290001_saas_workspace.sql`](./supabase/migrations/202609290001_saas_workspace.sql)
first in the Supabase Dashboard SQL Editor. This repository has no Supabase CLI
project configuration, so use the Dashboard SQL Editor rather than multiple
application methods. The baseline creates the plan catalog, per-user search
history and saved solutions, subscription/webhook-event tables, RLS policies,
and usage functions.

For an existing database whose baseline migration is already applied, do not
rerun it. Apply
[`supabase/migrations/202609290003_monthly_limit_safety.sql`](./supabase/migrations/202609290003_monthly_limit_safety.sql)
once in Dashboard → SQL Editor → New query. It sets Free to 10 and Premium to 100
searches per month, and replaces both usage RPCs to count from the UTC month
boundary. It fails closed if a plan row is missing or its limit is NULL or
negative; zero is a valid limit. This follow-up supersedes the earlier daily
allowance change without editing older migration files. No `.env` values are
used for plan allowances.

For the product growth features, apply these new migrations in order in
Dashboard → SQL Editor → New query. Do not edit or rerun older migrations:

1. [`supabase/migrations/202609290004_product_analytics.sql`](./supabase/migrations/202609290004_product_analytics.sql)
   aggregates daily successful searches and new signups, backfills totals from
   existing records, and installs future-counting triggers.
2. [`supabase/migrations/202609290005_public_search_rate_limits.sql`](./supabase/migrations/202609290005_public_search_rate_limits.sql)
   creates a private hashed-IP counter and the server-only hourly reservation
   function. The public search endpoint fails closed until this is applied.

The aggregate analytics contain only UTC day, event type, and count. To inspect
the totals, run this read-only query in the SQL Editor:

```sql
select event_date, event_name, event_count
from public.product_analytics_daily
order by event_date desc, event_name;
```

To audit every RLS policy on the five workspace tables, run this read-only
query in the SQL Editor:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in (
    'plan_catalog',
    'subscriptions',
    'search_history',
    'saved_solutions',
    'stripe_webhook_events'
  )
order by tablename, permissive desc, policyname;
```

- Set `price_display`, ISO currency, description, and feature list on each row.
- Make the Premium `price_display` and currency match the test-mode Stripe Price.

Failed search attempts also count, preventing repeated failing requests from
bypassing the allowance. The Premium price remains unannounced until you choose one; the app shows
“Price to be announced,” not a configuration token.

## Stripe test mode

1. In the Stripe Dashboard, switch to **test mode**, create a recurring Premium
   product and price, and configure the test customer portal.
2. Add the test secret key and test Price ID to `.env.local`.
3. Install/use the Stripe CLI and run:

   ```powershell
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the CLI's `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET` and
   restart the dev server.
5. The webhook handles `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, and
   `invoice.paid`. It verifies Stripe signatures, rejects live-mode events,
   and records event IDs for retry-safe processing.

Premium is granted only after a verified Stripe event updates the protected
subscription record. The Checkout success redirect alone never grants access.
Manage Subscription opens the Stripe customer portal. The integration rejects
non-test Stripe secret keys; do not configure live payment values.

## Product routes

- `/`: public marketing page and existing public search.
- `/pricing`: public Free/Premium pricing.
- `/login`, `/signup`, `/forgot-password`: Supabase email/password auth.
- `/dashboard`: authenticated New Search workspace.
- `/dashboard/history`, `/dashboard/saved`, `/dashboard/usage`,
  `/dashboard/account`: private user workspace.

Public searches remain anonymous and do not appear in private history.
The browser-only recent-problems list is a separate convenience feature stored
in localStorage; it never replaces Supabase history. Public searches are
forwarded server-side to the same n8n URL as before, rate-limited to 20 requests
per source IP per UTC hour by default, and counted only as an aggregate. The
reverse proxy hosting the app must set/overwrite `CF-Connecting-IP`,
`X-Real-IP`, or `X-Forwarded-For` with the actual client IP; do not trust
client-supplied forwarding headers when directly exposing the Node server.

To enable feedback and waitlist delivery, add the two HTTPS n8n webhook URLs to
the server environment. The feedback webhook receives `searchId` (or `null`),
`solution: { name, url }`, `helpful`, and `submittedAt`. The waitlist webhook
receives `email`, `source`, and `submittedAt`. Configure each n8n workflow to
append the corresponding fields to its Google Sheet. These optional routes
return a clear configuration error until their URLs are set.

The n8n solution workflow should read the optional `language` (`en` or `bn`)
and `category` (`freelancing`, `business`, `student`, or `tech`) request fields.
Preserve the existing response wrapper and `name`, `description`, and `url`
fields; include an optional per-solution `summary` to show the AI summary.

## End-to-end checks

1. Sign up with an email, follow its confirmation link, then sign in. The
   callback and sign-in should land in `/dashboard`.
2. Apply and configure the migration. Submit a dashboard search and confirm
   solution cards appear in Search History. Save a card and confirm it appears
   in Saved Solutions. Confirm a different account cannot access those rows.
   Try selecting each language/category, then use the browser recent-problems
   list, Copy all links, Share result, and per-solution feedback controls.
3. Configure the two optional n8n webhook URLs and add their workflows to
   Google Sheets. Submit feedback and a waitlist email, then verify the rows in
   the respective sheets. The form forwards email only after explicit submit.
4. Try 10 searches up to the Free monthly allowance; the next server action
   should be denied. Premium is limited to 100 searches per month and is
   granted only after Stripe webhook confirmation.
5. Submit public searches from the same IP until the configured hourly limit is
   reached. The next request should return an hourly-limit message. Verify
   daily aggregate counts in the SQL query above.
6. With Stripe test settings and webhook forwarding active, start Premium
   Checkout and use a Stripe test card. The Usage & Plan page should show
   Premium after the webhook is processed. Open Manage Subscription and cancel
   through the test customer portal; verify status/renewal behavior updates
   from Stripe events.

The Premium price/currency remain business decisions. Current monthly
allowances are Free: 10 and Premium: 100. Real money/live payments are not
enabled by this implementation.
