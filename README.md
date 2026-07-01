# HSMS — Homeless Shelter Management System (Web)

A free, Supabase-backed web app implementing the HSMS spec: field registration,
shelter check-in/out, missing-person flagging, a public tips portal, reports,
and user management.

## 1. Files

```
HSMS/
├── index.html               Dashboard
├── login.html                Staff login (custom auth against `users` table)
├── person-registration.html  Multi-step registration (Modules A–E)
├── person-list.html          Search / filter persons
├── person-profile.html       Full profile, photos, relatives, shelter history
├── shelters.html              Shelter CRUD
├── shelter-log.html          Check-in / check-out + live roster
├── missing-persons.html      Review & publish/remove missing notices
├── public-tips.html           Public portal (no login) + tip submission
├── users.html                 User management (super_admin only)
├── reports.html                Analytics + CSV export
├── css/style.css
├── js/config.js                Supabase client + shared helpers
├── js/person.js                Registration form logic
├── js/list.js                  Person list/search logic
├── js/dashboard.js             Dashboard stats
├── js/shelter.js               Shelters CRUD + check-in/out
├── js/user.js                  User management logic
├── images/logo.png
└── vendor/                     (empty — all libraries loaded via CDN)
```

## 2. Before you run it

This frontend already points at your Supabase project (URL + anon key in
`js/config.js`). You still need to, in the Supabase SQL editor:

1. **Run the schema** you supplied (`Supabase_Data.docx` SQL) to create all
   tables/enums/indexes.
2. **Create a storage bucket** named `person-photos` (Storage → New bucket →
   public, or private + add signed URL logic later).
3. **Seed at least one super_admin** so you can log in:
   ```sql
   insert into users (full_name, email, password, role, is_active)
   values ('System Admin', 'admin@hsms.org', 'ChangeMe123!', 'super_admin', true);
   ```
   ⚠️ The `users.password` column is plain text per the schema you provided —
   this is fine for a quick prototype but **not production-safe**. For
   production, switch to Supabase Auth (`auth.users`) + RLS instead of this
   custom table-based login.
4. **Enable Row Level Security** policies per section 10.1 of your
   `HSMS_System_Documentation.docx` (field workers see only their own
   registrations, shelter admins see their shelter, super admins see all,
   and the public can `SELECT` on `missing_alerts` where `is_active = true`
   and `INSERT` on `public_tips`). Until RLS is configured, make sure your
   tables either have RLS disabled (open testing) or matching policies, or
   all reads/writes from this frontend will fail silently with permission
   errors.

## 3. Running locally

These are static files — no build step. Open `login.html` in a browser, or
serve the folder with any static server, e.g.:

```bash
npx serve HSMS
```

## 4. Notes on schema mapping

This build uses your **actual deployed schema** (from `Supabase_Data.docx`),
which differs slightly from the design doc (e.g. `aadhaar_status` instead of
`has_aadhaar`, `case_notes` on `persons`, `missing_alerts` instead of
`missing_person_posts`). All `.js` files reference the real column/table
names so they work against your live database as-is.
