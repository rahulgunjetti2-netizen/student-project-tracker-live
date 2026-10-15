# Student Project Tracker (Live Cloud Variant)

A hands-on web app development project. This is the **cloud variant** of the Student Project Tracker: it uses **Vercel** for hosting and **Supabase PostgreSQL** for the database, instead of the local SQLite version.

## How this differs from the SQLite version

- Data is stored in a hosted PostgreSQL database, not a local SQLite file.
- `database.js` uses the `postgres` library. All queries are parameterised.
- `server.js` exports the Express app so Vercel can host it. `live-local.js` starts the same app on port 3000 for local rehearsal.
- Rows saved in the local SQLite project are **not migrated** to this database.

## Configuration you need

- `DATABASE_URL` is a **server-only** PostgreSQL connection string. Use the Supabase **Transaction pooler** URI.
- Do not use the Supabase project API URL or the anon key.
- Never commit `.env` or put the real connection string in public files, frontend code or `.env.example`.
- Each person running this project must create their own Supabase project and their own `DATABASE_URL`. The original deployer's credentials are not shared.

## Run locally

1. Create a Supabase project and run `schema.sql` in the SQL Editor to create the `projects` table.
2. Copy `.env.example` to `.env` and replace the placeholder with your own connection string.
3. In PowerShell inside this folder:

```powershell
npm.cmd ci
npm.cmd start
```

4. Open http://localhost:3000.

## Notes

- The app has shared demo records and **no sign-in**. Anyone who can reach the app can use its project routes. Use synthetic data only.
- Row Level Security is enabled on the table, and the app connects through its server-side database credential.

## Checks completed

- `npm.cmd ci` finished successfully.
- `schema.sql` was run in Supabase and the `projects` table was created.
- The local server connected to Supabase using a private `.env`.
- Create, edit, cancelled delete and confirmed delete worked locally against the Supabase table.
- Data remained in Supabase after restarting the local server.

## Hosted address

To be added after deployment.