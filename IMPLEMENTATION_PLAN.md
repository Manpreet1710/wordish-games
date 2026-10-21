# Wordora — Implementation Plan

## Project Analysis
- **Existing stack**: Empty vanilla project with netlify-lambda skeleton
- **Framework decision**: Vanilla HTML/CSS/JS (no build step needed for frontend)
- **Backend**: Netlify Functions (Node.js), modernized from netlify-lambda to @netlify/functions

## Architecture

```
wordish-games/
├── index.html                      # Game UI
├── css/
│   └── style.css                   # All styles, dark mode, animations
├── js/
│   ├── app.js                      # Main game controller
│   ├── game.js                     # Core game logic (evaluation, state)
│   ├── storage.js                  # localStorage utilities
│   ├── ui.js                       # DOM manipulation, animations
│   ├── keyboard.js                 # On-screen + physical keyboard
│   ├── dialogs.js                  # Help, Stats, Settings modals
│   ├── share.js                    # Emoji share feature
│   └── api.js                      # API client (fetch wrappers)
├── data/
│   ├── answers.js                  # Curated answer list (deterministic)
│   └── valid-guesses.js            # Extended valid guess dictionary
├── functions/
│   ├── get-puzzle.js               # GET: current puzzle info
│   ├── submit-guess.js             # POST: validate & evaluate guess
│   ├── get-stats.js                # GET: aggregated daily stats
│   ├── publish-puzzle.js           # Scheduled: daily puzzle publisher (cron)
│   └── _shared/
│       ├── db.js                   # MongoDB connection utility
│       ├── evaluate.js             # Server-side evaluation logic
│       ├── rateLimiter.js          # Simple in-memory rate limiter
│       └── words.js                # Word list loader
├── scripts/
│   ├── seed-db.js                  # Database seeding script
│   └── validate-words.js           # Word list validation
├── tests/
│   ├── evaluate.test.js            # Unit tests: evaluation logic
│   ├── storage.test.js             # Unit tests: localStorage
│   ├── puzzle.test.js              # Unit tests: puzzle numbering/dates
│   └── api.test.js                 # Integration tests: API endpoints
├── netlify.toml                    # Updated Netlify config
├── package.json                    # Updated dependencies
├── .env.example                    # Environment variable template
└── README.md                       # Setup & deployment guide
```

## Implementation Order
1. Update netlify.toml and package.json
2. Word lists (answers + valid guesses)
3. Shared backend utilities (db, evaluate, words)
4. Netlify Functions (get-puzzle, submit-guess, get-stats, publish-puzzle)
5. Frontend CSS (design system, dark mode, animations)
6. Frontend JS (game logic, storage, UI, keyboard, dialogs, share, api)
7. index.html
8. Scripts (seed-db, validate-words)
9. Tests
10. README + .env.example
