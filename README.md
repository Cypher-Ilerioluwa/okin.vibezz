# Okin Vibezz: website + CMS

Official website for **Okin Vibezz / Okin Music Nation**, with a private content manager at **`/admin`**.
Plain HTML, CSS and JavaScript only. Hosted on **Netlify**, code on **GitHub**, data and logins on **Supabase**.

```
Edit in /admin  ->  saved to Supabase  ->  press "Publish"  ->  Netlify rebuilds  ->  live site updates
```

## What you can manage in the CMS (`/admin`)

| Section | What it does |
|---|---|
| **Music** | Add **Singles, EPs and Albums**: cover art upload, date, genre, description, tracklist, links to every platform, draft/published, featured. Each release becomes a card on the Music page and its own detail page. |
| **Images & videos** | Upload **images** (many at once) and add **YouTube videos**. Images are auto-cropped to one standard size (1200 × 1500) so the **Images** page is perfectly even; videos appear on the Videos page. Reorder, caption, feature on the home page, draft/publish. |
| **Live shows** | Concert dates shown on the Live page. Past dates hide automatically. |
| **Pages** | Edit the text, headings, images, services, booking steps and FAQs of **every page**, the biography, and all **legal pages**. Each page also has a **Search & link preview** card (title, description, share image) with a live preview. Empty fields fall back to the built-in text. |
| **Streaming & social** | Paste your profile links for 16 streaming platforms and 7 social networks. Platforms without a link show "Link coming soon" on the Music page. |
| **Inbox** | Contact messages and booking requests from the website forms, with status and private notes. |
| **Team & access** | *(super admins only)* Create admins with a password you set, choose their role, set new passwords, disable or remove them. See below. |
| **Account** | Change password, see publishing info. |

There is **no sign-up page**. Only accounts you create yourself in Supabase can sign in.

## One-time setup

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL editor**: paste and run **`supabase/setup_all.sql`** (one file; it is safe to run again and fixes anything missing). Then run **`supabase/check_setup.sql`**: every row should say `true`. (`supabase/migrations/` holds the same SQL split into steps, for Supabase CLI users.)
3. **Create your login**: *Authentication > Users > Add user > Create new user* (tick *Auto Confirm User*).
4. **Turn off public sign-ups**: *Authentication > Sign In / Providers* > disable *Allow new users to sign up*.
5. Open `supabase/first_admin.sql`, put your email in it, and run it. This makes you the owner. **No email confirmation is needed anywhere**: logins you create are active immediately, so you can leave Supabase's *Confirm email* setting on or off.
6. *(Optional)* run `supabase/seed.sql` to load the starter releases and Apple Music / Audiomack links. **Check them in the CMS afterwards.**
7. Deploy the two functions (Supabase CLI, `supabase login` then `supabase link`):
   ```bash
   supabase functions deploy submit-form
   supabase functions deploy publish-site --no-verify-jwt
   supabase functions deploy manage-admins --no-verify-jwt
   ```
   Use the names **exactly** as written (lower case, with hyphens). `--no-verify-jwt` is safe for the two CMS functions because they check your login and role themselves; it just stops Supabase's gateway from rejecting the browser's pre-check. If you create functions in the dashboard instead, paste the code from `supabase/functions/<name>/index.ts`, press **Deploy**, and switch **Verify JWT** off for `publish-site` and `manage-admins`.
8. *(Only for the "Forgot password?" link on the login page, which sends an email)* *Authentication > URL Configuration*: set **Site URL** to your website and add `https://your-domain/admin/` under **Redirect URLs**. Adding admins does not need email.

### 2. Netlify
1. Push this repo to GitHub, then *Add new site > Import from Git* in Netlify. Build settings are already in `netlify.toml`.
2. Tell the site where your Supabase project is. Use **either** option (environment variables win if both are set):

   **Option A, Netlify environment variables** (*Site configuration > Environment variables*):
   | Variable | Value | Where to find it |
   |---|---|---|
   | `SUPABASE_URL` | Project URL, like `https://abcdxyz.supabase.co` | Supabase > Project Settings > **API** > Project URL |
   | `SUPABASE_ANON_KEY` | the **anon / public** key | Supabase > Project Settings > **API** > Project API keys > `anon` `public` |
   | `SITE_URL` | `https://okinvibezz.com` (your real domain) | your domain |

   **Option B, edit `site.config.json`** in the repo root and commit it:
   ```json
   { "supabaseUrl": "https://abcdxyz.supabase.co", "supabaseAnonKey": "eyJ...anon key...", "siteUrl": "https://okinvibezz.com" }
   ```
   The build writes these into `/admin/config.js` for you, so there is no `config.js` to edit by hand. The anon key is *meant* to be public (Row Level Security protects the data), so committing it is safe.

   **Never use the `service_role` key** anywhere in Netlify, the repo or the browser.
3. *Site configuration > Build & deploy > Build hooks > Add build hook* (name it "CMS publish") and copy the URL.
4. Give that URL to the publish function (it stays on the server, never in the browser):
   ```bash
   supabase secrets set NETLIFY_BUILD_HOOK_URL="https://api.netlify.com/build_hooks/xxxxxxxx"
   ```
5. Deploy. Visit `/admin`, sign in, and you're in.

> Never put the Supabase **service role** key in Netlify, in the repo, or in the browser. The CMS only uses the public anon key; Row Level Security does the protecting.

## Team & access (adding admins)
Open **Team & access** in the CMS (visible to super admins only). **No emails are involved.**

1. Click **Add admin**, enter their name, their email (this is their username) and choose a role.
2. A strong password is generated for you (type your own if you prefer, at least 10 characters).
3. Click **Create admin**. The account works straight away, with no confirmation email.
4. Send them the login details shown on screen (there is a **Copy details** button). They sign in at `/admin` and can change their password any time under **Account**.

| Role | Can do |
|---|---|
| **Super admin** | Everything, including adding, changing and removing admins. |
| **Editor** | Edit music, images, videos, pages, shows and links; answer messages and bookings; publish. |
| **Booking manager** | See and answer booking requests only. No access to website content. |

If the email already has a login in Supabase Auth (for example one you made in the dashboard) and that person is not an admin yet, **Add admin** adopts that login: it sets the password you chose and gives them the role, still with no email.

For anyone already on the team you can **change their role**, **set a new password** (the old one stops working at once, then send them the new one), **disable** (blocks sign-in immediately, reversible) or **remove** (deletes the login). You cannot change, disable or remove your own account. Every change is recorded in the `audit_logs` table.

How it stays safe: creating logins needs Supabase's private service key, so it lives only inside the `manage-admins` Edge Function (Supabase provides it automatically). The function checks, on every call, that you are an **active super admin**, and the browser never sees the key. Public sign-up stays off.
The first super admin is still created once with `supabase/first_admin.sql`.

## Starting over (clean database)
If the database setup gets into a muddle, you do not need to delete the Supabase project:
1. Run **`supabase/reset_all.sql`** in the SQL editor. It removes everything this project created (website data, roles, tables). It keeps your login accounts and uploaded files.
2. Run **`supabase/setup_all.sql`**.
3. Run **`supabase/first_admin.sql`** (with your email) to make yourself the owner again.
4. Run **`supabase/check_setup.sql`**: every row should say `true`.
5. *(Optional)* run `supabase/seed.sql` for the starter releases.

## Troubleshooting
| You see | Fix |
|---|---|
| `relation "..." does not exist` or `invalid input value for enum ...` in the SQL editor | An older half-finished setup is in the way. Follow **Starting over** above. |
| **Team & access** says "cannot reach the manage-admins function" | The page shows a 3-step check. In short: open `https://YOUR-PROJECT.supabase.co/functions/v1/manage-admins` in a browser tab. Seeing `Method not allowed` means it is running (switch **Verify JWT** off). `NOT_FOUND` means it is not deployed under exactly that name. `BOOT_ERROR` means the code did not start (check the function's Logs). |
| Publish says "Publishing is not set up yet" | Add the build hook secret: `supabase secrets set NETLIFY_BUILD_HOOK_URL="..."`, then deploy `publish-site`. |
| "That email already has an account" when adding an admin | They are already on the team: change their role in the list. (If the login existed only in Supabase Auth, adding them as an admin adopts it and sets the password you choose.) |
| Login says "No access" or "Account disabled" | The account needs a role (use **Team & access**, or `first_admin.sql` for the very first one) and must be active. |

## Link previews and SEO
Every page has its own title, description, canonical link, Open Graph and Twitter tags, breadcrumb data, and a **1200 × 630 share image**:
* Branded share cards for each page are in `assets/og/` (`home.jpg`, `music.jpg`, `images.jpg` ...).
* Release pages use their **cover art** as the preview.
* To change a page's title, description or preview image, open **Pages > (page) > Search & link preview** in the CMS. Uploaded preview images are cropped to 1200 × 630 automatically.
* Social apps cache previews. After changing one, refresh it with the Facebook Sharing Debugger (also fixes WhatsApp and Instagram) or the LinkedIn Post Inspector.
* `sitemap.xml` and `robots.txt` are generated on every build. The old `/gallery` address redirects to `/images`.

## Everyday use
1. Sign in at `yourdomain.com/admin`.
2. Add or edit things and press **Save**. Saving never changes the live site by itself.
3. Press **Publish** (top right). Netlify rebuilds; changes are live in about a minute. A pulsing dot on the button means you have changes that are not live yet.

Tips: use images of at least 1200 px on the short side so the standard crop stays sharp (the CMS warns you if a file is small). The Images page shows every image at the same 4:5 size. Drafts are never shown on the site. The first platform link on a release is its main "Listen" button.

## Local development
```bash
npm run build      # builds /dist (uses /content starter files if no Supabase env is set)
npm run preview    # serves /dist at http://localhost:8080
npm run check      # build + syntax-check the CMS scripts
```
To build from your real data locally, copy `.env.example` to `.env`, fill it in, and run `node --env-file=.env scripts/build.mjs`.

## Project structure
```
admin/            CMS (index.html, admin.css, js/ with one file per section)
shared/schema.js  Single source of truth: platforms, page fields and defaults (site AND CMS read it)
shared/legal.js   Default legal text + the tiny "## Heading / - list" format
scripts/build.mjs Static site generator
content/          Starter content used when Supabase is not configured
css/ js/ assets/  Public site styles, scripts, images and logos
supabase/         migrations, seed.sql, first_admin.sql, edge functions (submit-form, publish-site)
```

### Changing things in code
* **Music filter labels** (All, Single, EPs, Album): `RELEASE_TYPES` in `shared/schema.js`.
* **Add a streaming platform**: add a line to `PLATFORMS` in `shared/schema.js`. It appears on the Music page and in the CMS.
* **Make another piece of text editable**: add a field to `PAGES` in `shared/schema.js`, then use `P('page','key')` in `scripts/build.mjs`.

## Security notes
* The CMS checks your role in the database (`is_content_staff()`), not just that you are logged in.
* `/admin` is served with `no-store`, `noindex` and a restrictive Content-Security-Policy (see `netlify.toml`).
* Uploads go to a public `media` bucket that only staff can write to (images only, 10 MB max).
* Legal pages ship as sensible drafts. Have a lawyer review them before launch.
