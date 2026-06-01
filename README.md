# 🏗 Competitor Intel Portal
**100% GitHub + Netlify + Supabase — no separate server needed**

Monitors HEFT, Amrik Singh and Sons, and Barkat Cranes on LinkedIn.
Classifies posts with Claude AI every 10 minutes.
Portal auto-refreshes every 30 seconds showing only official updates.

---

## Architecture

```
GitHub repo
    │
    ▼
Netlify (free)
    ├── /portal/index.html         ← Frontend (auto-deployed from GitHub)
    └── /netlify/functions/
        ├── poll.mjs               ← Scheduled: runs every 10 min automatically
        ├── posts.mjs              ← GET /api/posts  (frontend polls this)
        ├── stats.mjs              ← GET /api/stats
        └── trigger-poll.mjs      ← POST /api/poll  (manual trigger)
            │
            ├── Apify             ← Scrapes LinkedIn pages
            ├── Claude API        ← Classifies posts as official/skip
            └── Supabase (free)   ← Stores posts (PostgreSQL database)
```

---

## Step 1 — Create Supabase database (5 min)

1. Go to **supabase.com** → Sign up free → New project
2. Choose a name (e.g. `competitor-portal`) and a strong password → Create
3. Wait ~2 minutes for the project to be ready
4. Go to **SQL Editor** (left sidebar) → **New query**
5. Copy the entire contents of `supabase-schema.sql` → Paste → **Run**
6. You should see: `posts table ready ✅` and `poll_log table ready ✅`
7. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role key** (under Project API keys) → this is your `SUPABASE_SERVICE_KEY`
   
   ⚠️ Keep the service_role key secret — never commit it to GitHub

---

## Step 2 — Get your API keys

| Key | Where to get it |
|-----|----------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `APIFY_TOKEN` | apify.com → Settings → Integrations → Personal API tokens |
| `SUPABASE_URL` | supabase.com → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | supabase.com → Project Settings → API → service_role key |

---

## Step 3 — Push to GitHub (3 min)

```bash
cd competitor-portal-netlify

git init
git add .
git commit -m "Initial commit — competitor intel portal"

# Create a new repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/competitor-portal.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Deploy on Netlify (5 min)

1. Go to **netlify.com** → Log in with GitHub
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** → Select your `competitor-portal` repo
4. Build settings:

   | Setting | Value |
   |---------|-------|
   | Base directory | *(leave blank)* |
   | Build command | `npm install` |
   | Publish directory | `portal` |
   | Functions directory | `netlify/functions` |

5. Click **Deploy site** — Netlify gives you a URL like `https://competitor-intel.netlify.app`

---

## Step 5 — Add environment variables to Netlify (3 min)

1. Go to your Netlify site → **Site configuration → Environment variables**
2. Click **Add a variable** for each of these:

```
ANTHROPIC_API_KEY      =  sk-ant-...
APIFY_TOKEN            =  apify_api_...
SUPABASE_URL           =  https://xxxx.supabase.co
SUPABASE_SERVICE_KEY   =  eyJ...
HEFT_LINKEDIN_URL      =  https://www.linkedin.com/company/heft-heavy-equipment/
AMRIK_LINKEDIN_URL     =  https://www.linkedin.com/company/amrik-singh-and-sons/
BARKAT_LINKEDIN_URL    =  https://www.linkedin.com/company/barkat-cranes/
POLL_SECRET            =  any-random-string-you-choose
FRONTEND_URL           =  https://competitor-intel.netlify.app
```

3. Go to **Deploys → Trigger deploy → Deploy site** to redeploy with new env vars

---

## Step 6 — Verify it works

1. Open your Netlify URL — you should see the dark portal
2. The status pill should show 🟢 **LIVE**
3. To trigger an immediate scrape (instead of waiting 10 min):
   - Open browser console on your portal
   - Run:
   ```js
   fetch('/api/poll', {
     method: 'POST',
     headers: { 'x-poll-secret': 'your-POLL_SECRET-value' }
   }).then(r => r.json()).then(console.log)
   ```
4. Wait ~2 minutes → refresh → new posts should appear

---

## From now on — auto-deploy workflow

Every time you push to GitHub:

```
git add .
git commit -m "your change"
git push
      │
      └──► Netlify auto-deploys in ~30 seconds
```

The scheduler runs automatically every 10 minutes on Netlify's servers. You don't need to do anything.

---

## Finding the correct LinkedIn URLs

For each competitor:
1. Go to their LinkedIn company page in your browser
2. Copy the URL — it looks like: `https://www.linkedin.com/company/company-name/`
3. Make sure it's the **company page** URL, not a personal profile

If you're unsure of the exact URL:
- Search for the company on LinkedIn
- Click their company name → copy the URL from your browser

---

## Adding more competitors

In `netlify/functions/shared.mjs`, add to the `COMPETITORS` array:
```js
{
  name: 'New Company',
  linkedinUrl: process.env.NEW_COMPANY_LINKEDIN_URL,
  color: '#8B5CF6',
  initials: 'NC'
}
```

Then add `NEW_COMPANY_LINKEDIN_URL` to Netlify environment variables.

---

## Changing the poll interval

In `netlify/functions/poll.mjs`, find the last line:
```js
export default schedule('*/10 * * * *', handler);
```

Change `*/10` to:
- `*/5`  → every 5 minutes
- `*/15` → every 15 minutes  
- `*/30` → every 30 minutes

---

## Troubleshooting

**Portal shows "Connecting..." and never goes live:**
- Check browser console for errors
- Make sure Netlify deployed successfully (check Netlify → Deploys tab)

**No posts appearing after manual poll:**
- Check Netlify → Functions → poll → logs for errors
- Verify your Apify token is valid at console.apify.com
- Verify the LinkedIn URLs are correct company page URLs

**Supabase errors:**
- Make sure you used the `service_role` key, NOT the `anon` key
- Check that you ran the SQL schema (Step 1)

**Claude not classifying:**
- Check your ANTHROPIC_API_KEY is set correctly in Netlify env vars
- Check you have API credits at console.anthropic.com
