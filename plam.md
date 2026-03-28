# IPL Fantasy Draft App — Final Build Plan

---

## 1. Project Overview

A private fantasy cricket web app for a closed group of friends. Each season, participants draft IPL players using a live snake draft system, accumulate fantasy points based on real match performances, and compete on a leaderboard until the tournament ends. Built entirely on free-tier infrastructure with zero commercial intent.

---

## 2. Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | Next.js (PWA) | Web app, installable on phone, no App Store needed |
| Database | Supabase (PostgreSQL) | Free tier, built-in auth, realtime subscriptions |
| Auth | Supabase Auth | Email/password login, free up to 50k MAU |
| Realtime | Supabase Realtime | Live draft room, free on hobby tier |
| Hosting | Cloudflare Pages | Free, unlimited requests, no non-commercial clause |
| Cron jobs | Cloudflare Workers | Free cron triggers for post-match points calculation |
| Cricket data | CricketData.org | Free tier, 100 hits/day, scorecard API |
| Keep-alive | cron-job.org | Free ping every 5 days to prevent Supabase pausing |

**Total monthly cost: ₹0**

---

## 3. Data Model

### 3.1 `leagues`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | string | e.g. "IPL 2026 Friends League" |
| invite_code | string | unique, shared with friends to join |
| players_per_team | int | 11 |
| draft_status | enum | `locked` / `active` / `backfill` / `completed` |
| current_pick_number | int | tracks live draft position |
| season_status | enum | `draft_phase` / `in_season` / `completed` |
| created_at | timestamp | |

### 3.2 `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Supabase Auth user ID |
| display_name | string | shown in draft room and leaderboard |
| email | string | |

### 3.3 `league_members`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| league_id | uuid FK → leagues | |
| user_id | uuid FK → users | |
| draft_order | int | 1–8, assigned before draft starts |
| team_name | string | optional custom team name |
| is_admin | boolean | only admin can control draft + edit picks |
| has_pending_backfill | boolean | true if they have skipped turns to fill |

### 3.4 `players`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | string | |
| ipl_team | string | e.g. "MI", "CSK", "RCB" |
| role | enum | `BAT` / `BOWL` / `AR` / `WK` |
| api_player_id | string | CricketData.org player ID for scorecard mapping |

### 3.5 `draft_picks`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| league_id | uuid FK → leagues | |
| league_member_id | uuid FK → league_members | who owns this pick |
| player_id | uuid FK → players | |
| round_number | int | 1–11 |
| pick_number | int | absolute pick 1–88 |
| picked_by | enum | `participant` / `admin` |
| created_at | timestamp | |

### 3.6 `matches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| league_id | uuid FK → leagues | allows multiple leagues per season |
| team_a | string | |
| team_b | string | |
| match_date | date | |
| api_match_id | string | CricketData.org match ID |
| points_processed | boolean | cron job sets true after calculating points |

### 3.7 `player_match_points`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| match_id | uuid FK → matches | |
| player_id | uuid FK → players | |
| league_member_id | uuid FK → league_members | which team these points credit to |
| runs | int | |
| balls_faced | int | needed for strike rate calculation |
| fours | int | |
| sixes | int | |
| wickets | int | |
| lbw_bowled_count | int | for LBW/bowled bonus |
| maiden_overs | int | |
| overs_bowled | float | needed for economy rate calculation |
| runs_conceded | int | |
| catches | int | |
| stumpings | int | |
| runouts_direct | int | |
| runouts_indirect | int | |
| did_play | boolean | for +4 appearance points |
| fantasy_points | float | computed output, stored for performance |

---

## 4. Scoring Rules (My11Circle system)

All points calculated from end-of-match scorecard. No ball-by-ball data required.

### Batting
| Event | Points |
|---|---|
| Per run | +1 |
| Boundary bonus (per 4) | +4 |
| Six bonus (per 6) | +6 |
| 25 run bonus | +4 |
| Half-century bonus (50) | +8 |
| 75 run bonus | +12 |
| Century bonus (100) | +16 |
| Duck (BAT / WK / AR only) | −2 |

### Bowling
| Event | Points |
|---|---|
| Wicket (excl. run-out) | +30 |
| LBW / bowled bonus | +8 |
| 3 wicket bonus | +4 |
| 4 wicket bonus | +8 |
| 5 wicket bonus | +12 |
| Maiden over | +12 |

### Fielding
| Event | Points |
|---|---|
| Catch | +8 |
| 3 catch bonus | +4 |
| Stumping | +12 |
| Run-out (direct) | +12 |
| Run-out (indirect) | +6 |

### General
| Event | Points |
|---|---|
| Playing XI appearance | +4 |

### Economy Rate (min 2 overs bowled)
| Economy | Points |
|---|---|
| Below 5 | +6 |
| 5 – 5.99 | +4 |
| 6 – 7 | +2 |
| 7.01 – 9.99 | 0 |
| 10 – 11 | −2 |
| 11.01 – 12 | −4 |
| Above 12 | −6 |

### Strike Rate (min 10 balls faced — BAT / WK / AR only)
| Strike Rate | Points |
|---|---|
| Above 170 | +6 |
| 150.01 – 170 | +4 |
| 130 – 150 | +2 |
| 70.01 – 129.99 | 0 |
| 60 – 70 | −2 |
| 50 – 59.99 | −4 |
| Below 50 | −6 |

> No captain/VC multiplier. No POTM bonus. No dot ball points.
> Raw stats are always stored. Fantasy points are recomputable anytime if rules change.

---

## 5. Features

### 5.1 Setup phase
- Admin creates a league, gets a shareable invite link/code
- Participants join via link, set their display name
- Admin assigns draft order (random shuffle button available)
- Admin sets draft to `locked` until everyone is ready

### 5.2 Draft phase

**Live snake draft**
- Admin unlocks the room (`locked` → `active`) to start
- Snake order: Round 1 goes 1→8, Round 2 goes 8→1, alternating
- Advisory countdown timer shown on screen (not hard enforced)
- Active participant's turn is highlighted; Pick button only appears for them
- Picked players removed from pool in real-time for everyone
- All 8 participants see the room simultaneously via Supabase Realtime
- On timer expiry: turn is skipped, `has_pending_backfill` set to true
- Admin can lock/unlock room at any time (pause for disconnects, breaks)
- Admin can manually advance turn if someone is unresponsive

**Admin bulk entry**
- Admin can pick on behalf of any participant at any time before season starts
- Bypasses snake order entirely
- Same shared player pool enforced — no duplicates allowed
- Accessed via participant selector dropdown in admin panel: `[ Managing picks for: Rahul ▾ ]`

**Backfill**
- After main draft, admin opens backfill mode for participants with skipped turns
- Admin unlocks specific people to make their missed picks in any order
- Still uses shared pool

**Admin edit picks**
- Admin can swap any player out of any team before season starts
- Swapped-out player automatically returns to available pool
- Affected participant sees "your squad was updated by admin" notification

**Audit trail**
- Every pick records `picked_by`: `participant` or `admin`

### 5.3 Season phase
- Cloudflare Worker cron job runs nightly during IPL season
- Checks `matches` table for rows where `match_date` = yesterday AND `points_processed` = false
- Fetches scorecard from CricketData.org API (~3 hits per match)
- Maps players to `api_player_id`, calculates fantasy points using scoring rules
- Inserts rows into `player_match_points` for each player who played
- Sets `points_processed` = true on the match row
- Manual fallback: admin can enter scorecard stats directly in app if API fails

### 5.4 Leaderboard
- Live cumulative rankings: `SUM(fantasy_points) GROUP BY league_member_id`
- Per-match point history — see who had a great/bad match
- Player-level breakdown per team — which players are contributing
- Winner declared automatically when `season_status` = `completed`

---

## 6. App Screens

| Screen | Who sees it | Key actions |
|---|---|---|
| Join / login | Everyone | Sign up, enter invite code |
| Lobby | Everyone | See participants, draft order, wait for admin |
| Draft room | Everyone | Live draft, player pool, squad tracker |
| Admin panel | Admin only | Lock/unlock, bulk entry, edit picks, backfill |
| My squad | Everyone | View own 11 players post-draft |
| Leaderboard | Everyone | Rankings, match history, player breakdown |
| Match points | Everyone | Points earned per match, per player |

---

## 7. Deployment

### Supabase (database + auth + realtime)
- Create free project at supabase.com
- Run schema migrations to create all 7 tables
- Enable Row Level Security (RLS) — participants can only read/write their own data
- Set up Realtime on `draft_picks` and `leagues` tables for live draft sync
- Keep-alive: set up cron-job.org to ping Supabase REST endpoint every 5 days

### Cloudflare Pages (frontend)
- Connect GitHub repo to Cloudflare Pages
- Set environment variables: Supabase URL, Supabase anon key, CricketData.org API key
- Every push to `main` auto-deploys

### Cloudflare Workers (cron)
- Write a Worker that fetches scorecards and calculates points
- Set cron trigger: `0 6 * * *` (runs 6am daily, after most IPL matches finish)
- Set environment variables: Supabase service role key, CricketData.org API key

### CricketData.org
- Sign up for free account at cricketdata.org
- Get API key
- Pre-load IPL 2026 player list into `players` table at season start
- Pre-load match schedule into `matches` table at season start

---

## 8. Build Order (recommended sequence)

1. **Supabase setup** — create tables, RLS policies, auth
2. **Auth screens** — login, signup, join league via invite code
3. **Player pool seeding** — script to load IPL squads from API into `players` table
4. **Draft room** — this is the hardest screen, build it early while motivation is high
5. **Admin panel** — lock/unlock, bulk entry, edit picks
6. **Points calculation worker** — the Cloudflare Worker cron job
7. **Leaderboard + match history** — mostly read-only queries, straightforward
8. **PWA setup** — add manifest.json and service worker so friends can install to homescreen
9. **End-to-end test** — run a mock draft with real accounts before IPL starts

---

## 9. Key Constraints & Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| App type | PWA web app | No App Store cost, works on all phones |
| Fantasy points | Self-calculated | No paid API needed |
| Scoring system | My11Circle rules | Group preference |
| Dot balls | Dropped | Requires ball-by-ball API, not worth it |
| Captain/VC | Dropped | Keep it flat |
| POTM bonus | Dropped | API unreliable |
| Timer enforcement | Advisory only | Admin controls flow manually |
| Skipped turns | Manual backfill | Admin unlocks missed picks later |
| Draft editing | Admin can edit any pick pre-season | Full flexibility |
| Duplicate players | Not allowed | Same pool for all participants |
| Multi-league | Supported | `league_id` on matches and points tables |