# IFASCON 2026 - Real-Time Conference Operations & Digital Signage Platform

A lightweight, zero-build, real-time conference schedule management, audience engagement, and digital signage system built with vanilla JavaScript, Tailwind CSS, PapaParse, and Supabase.

---

## 📌 Architecture Overview

```
                          ┌────────────────────────┐
                          │ Google Sheets (CSV)    │
                          │ - Schedule Feeds       │
                          │ - Quiz Questions Bank  │
                          └───────────┬────────────┘
                                      │
                                      ▼ (Fetch & Cache)
    ┌─────────────────────────────────┴─────────────────────────────────┐
    │                                                                   │
    ▼                                 ▼                                 ▼
┌──────────────────┐        ┌──────────────────┐              ┌──────────────────┐
│    live.html     │        │delegate_live.html│              │  tv-output.html  │
│ (AV Control Deck)│        │(Delegate Mobile) │              │ (Door TV Kiosks) │
└────────┬─────────┘        └────────▲─────────┘              └────────▲─────────┘
         │                           │                                 │
         │ Realtime Broadcast        │ Live Sync & Quiz Answers        │ Realtime Display
         └───────────────────────────┼─────────────────────────────────┘
                                     ▼
                          ┌────────────────────────┐
                          │   Supabase Realtime    │
                          │ - hall_states          │
                          │ - quiz_responses       │
                          │ - audit_logs           │
                          │ - event_managers       │
                          └────────────────────────┘

```

---

## 📁 System Components

| File | Purpose | Target Device | Key Features |
| --- | --- | --- | --- |
| `index.html` | Delegate Schedule Viewer | Mobile & Desktop Web | Search by speaker/topic, workshop track switcher, personal itinerary export (`.txt`), local cache fallback. |
| `live.html` | AV Command Center & Stage Deck | AV Laptop / iPad | Timeline step navigation, manual index jumps, live audience quiz launcher, sponsor media player, multi-hall leaderboard broadcast. |
| `delegate_live.html` | Delegate Live Companion | Mobile Web | Real-time session tracker, phone-token login, synchronized trivia participation, live hall standings. |
| `tv-output.html` | Hallway & Doorway Digital Signage | Kiosk Displays / Smart TVs | Adaptive single/dual-split screen layout, door navigation arrows, dynamic full-screen quiz takeover, auto QR code generator. |

---

## 🚀 Key Features

* **Zero-Build Deployment:** Pure HTML5/JavaScript; deploy directly to Vercel, Netlify, GitHub Pages, or any static web host.
* **Instant Fallback Caching:** LocalStorage caches Google Sheet schedule data so displays remain active during venue network hiccups.
* **Supabase Realtime Engine:** Sub-second sync across stage monitors, delegate smartphones, and corridor displays without WebSockets boilerplate.
* **Hall C Streamlined Parsing:** Built-in parser adjustments to handle 3-column schedules (`From`, `To`, `Session Topic`) alongside standard multi-column formats.
* **Live Gamification & Leaderboards:**
* Room-level scoring ("Force This Hall").
* Multi-hall cumulative daily leaderboards.
* Lifetime Grand Conference Leaderboard.
* First-come, highest-point decay score calculation ($10, 9, 8 \dots 1\text{ pt}$).



---

## 🗄️ Database Schema & Supabase Setup

Create the following tables in your Supabase project:

### 1. `hall_states`

Tracks current timeline positions, active quiz questions, and display modes for each room.

```sql
CREATE TABLE public.hall_states (
    hall_id TEXT PRIMARY KEY,
    override_index INT DEFAULT NULL,
    quiz_start_time TIMESTAMPTZ DEFAULT NULL,
    force_leaderboard TEXT DEFAULT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Hall Rows
INSERT INTO public.hall_states (hall_id) VALUES
('ao_seminar'), ('workshop_diabetic'), ('workshop_mis'),
('22a'), ('22b'), ('22c'),
('23a'), ('23b'), ('23c');

```

### 2. `quiz_responses`

Stores delegate answers submitted during live quiz sessions.

```sql
CREATE TABLE public.quiz_responses (
    id BIGSERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    hall_id TEXT NOT NULL,
    question TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

```

### 3. `audit_logs`

Logs manual timeline adjustments and AV commands.

```sql
CREATE TABLE public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    manager_name TEXT NOT NULL,
    action TEXT NOT NULL,
    hall_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

```

### 4. `event_managers`

Controls role-based authentication PINs for `live.html`.

```sql
CREATE TABLE public.event_managers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'floor_manager')),
    assigned_hall TEXT NOT NULL
);

-- Seed Administrator Account
INSERT INTO public.event_managers (name, pin, role, assigned_hall)
VALUES ('AV Lead', '1234', 'admin', 'ALL');

```

> **Important:** Enable **Realtime** replication on `hall_states`, `quiz_responses`, and `audit_logs` via the Supabase Dashboard under **Database → Replication**.

---

## 📺 URL Parameters & Screen Launch Cheatsheet

### `tv-output.html` (Door Kiosks)

```bash
# Single Hall Display (Full Screen)
tv-output.html?hall=22a

# Single Hall with Door Direction Arrow & Custom Name
tv-output.html?hall=22a&arrow=left&name=Hall+A

# Dual-Hall Split Screen (Side-by-Side)
tv-output.html?halls=22a,22b&arrows=left,right

# Dual-Hall Split Screen with Custom Room Names
tv-output.html?halls=22a,22b&arrows=left,right&names=Jasper+Hall,Hall+A

# Interactive On-Screen Setup Wizard
tv-output.html

```

### `delegate_live.html` (Mobile Dashboard)

```bash
# Direct Hall Link (Used in QR codes & attendee links)
delegate_live.html?hall=22a
delegate_live.html?hall=22c

```

### `index.html` (Full Agenda)

```bash
# Standard Schedule
index.html

# Smart Redirect to Live Kiosk
index.html?mode=live

```

---

## ⚙️ Configuration & Data Sources

Google Sheet publish links and hall IDs are configured inside each file under `sheetLinks` and `configTitles`:

```javascript
const sheetLinks = {
    'quizzes': 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv',
    'ao':      'https://docs.google.com/spreadsheets/d/e/.../pub?gid=189655281&single=true&output=csv',
    '22a':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=0&single=true&output=csv',
    '22b':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=660947078&single=true&output=csv',
    '22c':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=127806642&single=true&output=csv',
    '23a':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=1579973346&single=true&output=csv',
    '23b':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=239334255&single=true&output=csv',
    '23c':     'https://docs.google.com/spreadsheets/d/e/.../pub?gid=1095375546&single=true&output=csv'
};

```

---

## 🛠️ Deployment

1. Clone or copy the project files to your web root or Git repository.
2. Ensure the conference logo image (`IFASCON chd logo.jpg`) is in the same directory as the HTML files.
3. Verify your Supabase URL and anonymous key inside each HTML file.
4. Deploy to any web server or static CDN host (Vercel, Netlify, Cloudflare Pages, S3).
