#!/usr/bin/env node
/**
 * Wordora — Database Seeder
 * 
 * Initializes MongoDB with:
 * 1. Required indexes (idempotent)
 * 2. Backfill of past puzzles from the legacy word-list formula (one-time migration)
 * 3. Future puzzle schedule (answers assigned ahead of time)
 * 
 * Usage:
 *   MONGODB_URI=... MONGODB_DB_NAME=wordora node scripts/seed-db.js
 *   
 * Options (env vars):
 *   SEED_DAYS=30         — Number of future days to schedule (default: 30)
 *   DRY_RUN=true         — Preview changes without writing to DB
 * 
 * Safe to run multiple times (idempotent — uses upsert).
 * Never overwrites existing puzzle answers.
 * Answers are never printed (the schedule is secret).
 */

'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore error loading env file
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');


const { connectToDatabase, ensureIndexes } = require('../functions/_shared/db');
const { getPuzzleNumberForDate, getTodayUTC } = require('../functions/_shared/words');
const { backfillHistory, scheduleUpcoming } = require('../functions/_shared/puzzles');
const { getTrustedNow } = require('../functions/_shared/time');

const SEED_DAYS = parseInt(process.env.SEED_DAYS || '30', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║   Wordora Database Seeder          ║');
  console.log('╚════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE — no changes will be written\n');
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  const { db, client } = await connectToDatabase();
  console.log('✓ Connected\n');

  if (!DRY_RUN) {
    console.log('Creating indexes...');
    await ensureIndexes();
    console.log('✓ Indexes created/verified\n');
  }

  const now = await getTrustedNow();
  const today = getTodayUTC(now);
  const todayPuzzleNumber = getPuzzleNumberForDate(now);

  // 1. Past + today: keep the answers players already saw (legacy formula)
  console.log(`Backfilling history up to today (${today}, puzzle #${todayPuzzleNumber})...`);
  const backfill = await backfillHistory(db, todayPuzzleNumber, { dryRun: DRY_RUN });
  console.log(`✓ Missing: ${backfill.missing}, inserted: ${backfill.inserted}\n`);

  // 2. Future: assign answers ahead of time (never-used words first)
  console.log(`Scheduling the next ${SEED_DAYS} days...`);
  const { scheduled, unusedWordsRemaining } = await scheduleUpcoming(db, todayPuzzleNumber + 1, SEED_DAYS, { dryRun: DRY_RUN });
  for (const { puzzleNumber, date } of scheduled) {
    console.log(`  ✓ Puzzle #${puzzleNumber} (${date}): ${DRY_RUN ? 'would be scheduled' : 'scheduled'}`);
  }

  console.log('\n══════════════════════════════════════');
  console.log(`History backfilled: ${backfill.inserted}${DRY_RUN ? ` (would insert ${backfill.missing})` : ''}`);
  console.log(`Newly scheduled:    ${scheduled.length}`);
  console.log(`Never-used words:   ${unusedWordsRemaining}`);
  console.log('══════════════════════════════════════\n');

  await client.close();

  console.log('✅ Seeding complete\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
