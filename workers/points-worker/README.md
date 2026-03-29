# IPL Fantasy Points Worker

Cloudflare Worker that runs nightly to calculate fantasy points from match scorecards.

## Setup

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Set secrets
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CRICKET_DATA_API_KEY
```

### 3. Deploy
```bash
cd workers/points-worker
wrangler deploy
```

### 4. Seed matches table
Before IPL starts, add each match to the `matches` table in Supabase with the `api_match_id` from CricketData.org.

To find match IDs: `https://api.cricapi.com/v1/series_matches?apikey=KEY&id=IPL_SERIES_ID`

## Manual trigger (testing)

Once deployed, hit the worker URL with `/trigger`:
```
https://ipl-fantasy-points.<your-subdomain>.workers.dev/trigger
```

## How it works

1. Cron fires at 1:00 AM UTC (6:30 AM IST) daily
2. Queries Supabase for matches where `match_date = yesterday` AND `points_processed = false`
3. For each match, fetches scorecard from CricAPI `/match_scorecard`
4. Parses batting, bowling, and fielding stats (including dismissal text for fielding)
5. Calculates fantasy points using My11Circle scoring rules
6. Inserts rows into `player_match_points` for each drafted player
7. Marks match as `points_processed = true`

## Player name matching

Players are matched first by `api_player_id`, then by exact name, then by partial name.
For best accuracy, seed players via `node scripts/seed-players.js --api` once IPL 2026
appears in the CricAPI (which populates `api_player_id` on all players).
