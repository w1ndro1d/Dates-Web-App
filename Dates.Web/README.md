# Dates

Dates is a Vite and Three.js event tracker with a serverless Express API, email verification, timezone-aware reminders, and PostgreSQL persistence.

## Deploy to Vercel

Create a Vercel project from this repository and set **Root Directory** to `Dates.Web`. Vercel will use `vercel.json` to build the Vite frontend and deploy the API function.

In the project's **Storage** tab, add a Neon Postgres integration and connect it to the project. Confirm that it creates `DATABASE_URL`. Vercel's current Postgres offering is provided by Marketplace partners such as Neon rather than a separate first-party database.

Add these Production environment variables:

| Name | Value |
| --- | --- |
| `APP_ORIGIN` | The exact production URL, such as `https://dates.example.com` |
| `RATE_LIMIT_SECRET` | A unique random string of at least 32 characters |
| `CRON_SECRET` | A different random string of at least 32 characters |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | The sender Gmail address |
| `SMTP_PASSWORD` | The account's Google app password |
| `SMTP_FROM` | The sender Gmail address |
| `SMTP_NAME` | `Dates Reminders` |
| `REMINDERS_ENABLED` | Start with `false`; change to `true` after the smoke test |

Do not create any variable beginning with `VITE_` for a password, database URL, or secret. `VITE_` variables are shipped to browsers.

Run the database schema once from the `Dates.Web` directory with a local `DATABASE_URL`:

```powershell
$env:DATABASE_URL='your Neon pooled connection string'
npm run db:migrate
Remove-Item Env:DATABASE_URL
```

Deploy, then check `https://your-domain/api/health`. Register a test account, follow its verification email, sign in, add an event, edit it, and delete it. Once that works, set `REMINDERS_ENABLED=true` and redeploy.

## Free reminder scheduling

The database stores reminder delivery state, so restarting or invoking the API again does not resend a successfully recorded reminder. The database does not invoke reminders itself.

On Vercel Hobby, native cron is limited to a daily schedule and can run with substantial timing variation. For reminders checked every 15 minutes, configure a free external scheduler such as cron-job.org:

- URL: `https://your-domain/api/cron/reminders`
- Schedule: every 15 minutes
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

Never put `CRON_SECRET` in the URL. The endpoint is bounded, authenticated, production-only on Vercel, and reminder sends are durably claimed in PostgreSQL. A crash after SMTP accepted a message but before its database update can still produce a retry; no SMTP system can make that boundary perfectly atomic.

## Local development

`npm run dev` starts both the API and Vite. Without `DATABASE_URL`, it creates a private Postgres-compatible database under the ignored `.local` directory. The API reuses SMTP settings from the ignored `.NET` `appsettings.Local.json`; `.env.local` values take precedence when present.

```powershell
npm install
npm run dev
```

Use `npm run dev:api` only when you want to run the API separately. Before release, run `npm test`, `npm run build`, and `npm audit --omit=dev`.

The older `.NET` project remains available for local reference and migration history. It is not used by the Vercel deployment.
