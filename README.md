# VirtualCrew Lead Intelligence Agent

Live lead-generation tool for VirtualCrew.co.uk — queries the Companies House API in real time, scores results against your ICP (£5M–£200M, courier/logistics/ecommerce, lean board), and surfaces the best fractional/transformation prospects.

## What's inside

```
/api/search.js      — Serverless function: CH search + ICP scoring (key stays server-side)
/api/company.js     — Serverless function: full company profile + officers + filings
/public/index.html  — Full lead agent UI
/vercel.json        — Vercel routing config
```

## Deploy in 5 minutes

### 1. Get a free Companies House API key
1. Go to https://find-and-update.company-information.service.gov.uk
2. Register → Your applications → Create application → API key tab → Create new key
3. Copy it — looks like `abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "VirtualCrew lead agent"
git remote add origin https://github.com/YOURNAME/virtualcrew-lead-agent.git
git push -u origin main
```

### 3. Deploy on Vercel
1. Go to https://vercel.com → Add New Project → import your repo
2. Click Deploy (no build config needed)
3. In Settings → Environment Variables, add:
   - Name: `CH_API_KEY`
   - Value: (your key from step 1)
   - Environments: Production + Preview
4. Redeploy

### 4. Custom domain (optional)
In Vercel → Settings → Domains → add `leads.virtualcrew.co.uk`

Then in your DNS (wherever virtualcrew.co.uk is managed):
```
leads  CNAME  cname.vercel-dns.com
```
Live in 2–5 minutes.

## ICP scoring

| Signal | Points |
|--------|--------|
| SIC code match (courier/logistics/ecomm) | +1 to +3 |
| Lean board: 2–5 directors | +2 |
| Accounts filed < 12 months ago | +1 |
| Company age 3–20 years | +1 |
| CILT SME member (CSV import) | +1 to +2 |

Grades: A+ = 6+pts, A = 4–5pts, B = 2–3pts, C = below

## API endpoints

- `GET /api/search?q=courier&maxResults=20` — search + score
- `GET /api/search?sic=53200&maxResults=40` — search by SIC code
- `GET /api/company?number=07123456` — full profile + officers + filings
