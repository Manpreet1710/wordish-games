# Wordora

> **One word. Six tries. Every day.**

A production-ready daily five-letter word guessing game built with vanilla HTML/CSS/JS, Netlify Functions, and MongoDB Atlas.

---

## Architecture

```
Frontend:    Vanilla HTML + CSS + JavaScript (ES Modules, no build step)
Backend:     Netlify Functions (Node.js 18+)
Database:    MongoDB Atlas (optional — stateless fallback if unavailable)
Scheduler:   Netlify Scheduled Function (publish-puzzle, runs 0 0 * * * UTC)
Storage:     Browser localStorage for progress, streaks, settings
```

### How the Daily Puzzle Works

1. A deterministic puzzle number is computed from UTC date — no randomness.
2. **Epoch**: `2024-01-01` UTC = Puzzle #1.
3. The answer is `ANSWERS[(puzzleNumber - 1) % ANSWERS.length]` — cycles if needed.
4. The server **never returns the answer** until the game is over.
5. A scheduled function at UTC midnight publishes puzzles and creates an audit trail.
6. If the scheduler fails, the game continues using the word list fallback.

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and other values
```

### 3. Run locally

```bash
netlify dev
# Game available at http://localhost:8888
```

Without MongoDB, the game runs in **stateless mode** — guesses are still evaluated server-side but sessions are not persisted across requests.

---

## MongoDB Atlas Setup

### 1. Create a free cluster

- Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Create a free M0 cluster
- Create a database user with read/write access
- Whitelist `0.0.0.0/0` for Netlify IPs (or use Netlify IP ranges)

### 2. Get your connection string

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

### 3. Initialize indexes and seed data

```bash
MONGODB_URI="your-connection-string" MONGODB_DB_NAME=wordora node scripts/seed-db.js
```

This creates required indexes and pre-publishes 30 days of puzzles.

**Dry run first:**
```bash
MONGODB_URI="..." DRY_RUN=true node scripts/seed-db.js
```

---

## Netlify Deployment

### 1. Connect your repo to Netlify

```bash
netlify login
netlify link  # or netlify init for a new site
```

### 2. Set environment variables

In **Netlify → Site Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name (default: `wordora`) |
| `SESSION_SECRET` | Random 32-byte hex string for session signing |
| `SITE_URL` | Production URL, e.g. `https://wordora.netlify.app` |

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy

```bash
netlify deploy --prod
```

### 4. Update the canonical URL

After your site is live, update the canonical URLs in `index.html`:
- `<link rel="canonical" href="https://YOUR-DOMAIN.COM/">`
- `og:url`, `og:image`, etc.

---

## Scheduled Function

The `functions/publish-puzzle.js` runs every day at **00:00 UTC** (`0 0 * * *`).

It:
1. Computes today's puzzle number from UTC date
2. Validates the answer exists in the word list
3. Marks the puzzle as `published: true` in MongoDB
4. Logs execution for audit purposes

**The game does NOT depend on this function running.** It's an audit/override mechanism.

### Verify the schedule

In **Netlify → Functions → publish-puzzle** you'll see scheduled invocations.

### Manual invocation (recovery)

```bash
netlify functions:invoke publish-puzzle --no-identity
```

### If the scheduled function fails

The game continues working — it resolves the answer from the word list using the UTC date. Check Netlify Function logs, fix the issue, and invoke manually if needed.

---

## Running Tests

```bash
# All tests
npm test

# Individual test suites
npm run test:evaluate   # Guess evaluation algorithm
npm run test:puzzle     # Puzzle numbering and dates
npm run test:storage    # Word list utilities  
npm run test:api        # API endpoint integration tests
```

### Validate word lists

```bash
npm run validate-words
```

---

## Adding Future Answer Words

1. Open `data/answers.js`
2. Append new 5-letter uppercase words to the `ANSWERS` array
3. Run `npm run validate-words` to check for errors
4. Commit and deploy

**Rules:**
- Exactly 5 alphabetic letters
- Uppercase
- No duplicates
- No proper nouns, offensive words, or abbreviations
- If the word isn't already a common English word, also add it to `data/valid-guesses.js`

The puzzle sequence is **deterministic** — do not reorder existing entries, only append.

---

## API Endpoints

### `GET /.netlify/functions/get-puzzle`

Returns current puzzle metadata. **Never returns the answer.**

```json
{
  "puzzleNumber": 1023,
  "date": "2026-10-23",
  "rulesVersion": 1,
  "maxAttempts": 6,
  "wordLength": 5,
  "nextPuzzleAt": "2026-10-24T00:00:00.000Z"
}
```

### `POST /.netlify/functions/submit-guess`

Validates and evaluates a guess.

**Request:**
```json
{
  "sessionId": "uuid-string",
  "guess": "CRANE",
  "puzzleNumber": 1023,
  "date": "2026-10-23"
}
```

**Response:**
```json
{
  "results": [
    {"letter": "C", "result": "absent"},
    {"letter": "R", "result": "present"},
    {"letter": "A", "result": "correct"},
    {"letter": "N", "result": "absent"},
    {"letter": "E", "result": "absent"}
  ],
  "attemptsUsed": 1,
  "status": "playing",
  "answer": null,
  "message": null
}
```

**Error codes:**
- `400` — Invalid input
- `409` — Game already over / duplicate guess
- `422` — Word not in dictionary (`code: "INVALID_WORD"`)
- `429` — Rate limited

### `GET /.netlify/functions/get-stats`

Returns aggregated public statistics (no personal data).

---

## Database Schema

### `puzzles` collection

| Field | Type | Description |
|---|---|---|
| `puzzleNumber` | number | Unique puzzle ID |
| `date` | string | YYYY-MM-DD UTC |
| `answer` | string | 5-letter answer (never exposed via API) |
| `published` | boolean | Whether the puzzle is active |
| `publishedAt` | Date | When it was published |
| `createdAt` | Date | |
| `updatedAt` | Date | |

**Indexes:** `puzzleNumber` (unique), `date` (unique), `{published, date}`

### `gameSessions` collection

| Field | Type | Description |
|---|---|---|
| `sessionId` | string | Client-generated UUID |
| `puzzleNumber` | number | |
| `date` | string | |
| `guesses` | string[] | Submitted guesses (uppercase) |
| `status` | string | `playing` \| `won` \| `lost` |
| `attemptsUsed` | number | |
| `createdAt` | Date | |
| `expiresAt` | Date | TTL index — expires after 48h |

**Indexes:** `sessionId` (unique), `puzzleNumber`, `expiresAt` (TTL)

### `dailyStats` collection

| Field | Type | Description |
|---|---|---|
| `date` | string | YYYY-MM-DD UTC |
| `gamesStarted` | number | |
| `gamesCompleted` | number | |
| `gamesWon` | number | |
| `attemptsDistribution` | number[6] | Wins per attempt count |
| `updatedAt` | Date | |

**Indexes:** `date` (unique)

---

## Security Notes

- The answer is **never sent to the browser** until the game is over
- Server-side validation for all guesses
- Rate limiting: 30 guesses per IP per 10 minutes
- No personal data collection — sessions are ephemeral
- localStorage-based anti-cheat is **casual only** (transparent in docs)
- All secrets are environment variables — never in source code

---

## Inspecting Function Logs

```bash
netlify functions:log
# or
netlify functions:log publish-puzzle
```

In the Netlify dashboard: **Functions → [function name] → Logs**

---

## AdSense / Monetization

Ad containers are reserved but hidden by default:

```html
<div class="ad-zone" id="ad-top" aria-hidden="true"></div>
<div class="ad-zone" id="ad-bottom" aria-hidden="true"></div>
```

To enable ads:
1. Get AdSense approval
2. Add the AdSense script to `index.html`
3. Update `.ad-zone` CSS to `display: flex` with appropriate dimensions
4. Follow Google's placement policies

---

## License

ISC — See LICENSE for details.
