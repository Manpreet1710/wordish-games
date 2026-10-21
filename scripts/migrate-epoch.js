#!/usr/bin/env node
/**
 * Wordora — Renumber puzzles and sessions after an EPOCH_DATE change.
 *
 * A day's answer is permanent: this script NEVER changes `date` or `answer`.
 * It only rewrites `puzzleNumber` so it matches the current EPOCH_DATE:
 *   puzzleNumber = days since EPOCH_DATE + 1   (days before the epoch get <= 0)
 *
 * gameSessions are renumbered the same way. Sessions created while numbers and
 * dates disagreed were evaluated against the wrong answer, so sessions already on
 * the new numbering are re-evaluated against the date's real answer. If a player
 * has both an old- and new-numbered session for the same day, the old one is kept.
 *
 * Writes a JSON backup of both collections to backups/ before changing anything.
 * Safe to run more than once.
 *
 * Usage:
 *   DRY_RUN=true node scripts/migrate-epoch.js
 *   node scripts/migrate-epoch.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      for (const line of fs.readFileSync(fullPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore error loading env file
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const { connectToDatabase } = require('../functions/_shared/db');
const { EPOCH_DATE } = require('../functions/_shared/words');

const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_ATTEMPTS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
// Parking offset for the two-phase renumber, far away from any real puzzle number
const PARK = -10000000;

/** Unclamped puzzle number for a YYYY-MM-DD date under the current epoch. */
function numberForDate(date) {
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(EPOCH_DATE + 'T00:00:00Z')) / DAY_MS) + 1;
}

/** Recomputes a session's outcome from its guesses against the real answer. */
function reevaluate(session, answer) {
  const winIndex = session.guesses.indexOf(answer);
  const guesses = winIndex === -1 ? session.guesses.slice(0, MAX_ATTEMPTS) : session.guesses.slice(0, winIndex + 1);
  let status = 'playing';
  if (winIndex !== -1) status = 'won';
  else if (guesses.length >= MAX_ATTEMPTS) status = 'lost';
  return { guesses, attemptsUsed: guesses.length, status };
}

/** Moves docs to their target numbers in two passes so unique indexes never collide. */
async function renumber(collection, moves) {
  if (!moves.length) return;
  await collection.bulkWrite(moves.map((m, i) => ({
    updateOne: { filter: { _id: m._id }, update: { $set: { puzzleNumber: PARK - i } } },
  })), { ordered: true });
  await collection.bulkWrite(moves.map(m => ({
    updateOne: { filter: { _id: m._id }, update: { $set: { puzzleNumber: m.to } } },
  })), { ordered: true });
}

async function main() {
  console.log(`\nWordora epoch migration -> puzzle #1 = ${EPOCH_DATE}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  const { db, client } = await connectToDatabase();
  const puzzles = db.collection('puzzles');
  const sessions = db.collection('gameSessions');

  const allPuzzles = await puzzles.find().toArray();
  const allSessions = await sessions.find().toArray();

  if (!DRY_RUN) {
    const dir = path.resolve(process.cwd(), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `pre-epoch-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ puzzles: allPuzzles, gameSessions: allSessions }, null, 2));
    console.log(`✓ Backup written: ${file}\n`);
  }

  // ── puzzles ──
  const answerByDate = new Map(allPuzzles.map(p => [p.date, p.answer]));
  const puzzleMoves = allPuzzles
    .map(p => ({ _id: p._id, from: p.puzzleNumber, to: numberForDate(p.date), date: p.date, answer: p.answer }))
    .filter(m => m.from !== m.to);

  console.log(`puzzles: ${allPuzzles.length} total, ${puzzleMoves.length} to renumber`);
  for (const m of puzzleMoves.filter(m => m.to >= 1).slice(0, 25)) {
    console.log(`  ${m.date}  #${m.from} -> #${m.to}  (${m.answer}, unchanged)`);
  }

  // ── gameSessions ──
  const sessionMoves = [];
  const sessionFixes = [];
  const sessionDeletes = [];
  const oldNumbered = new Set(
    allSessions.filter(s => s.puzzleNumber !== numberForDate(s.date)).map(s => `${s.sessionId}|${s.date}`)
  );

  for (const s of allSessions) {
    const to = numberForDate(s.date);
    if (s.puzzleNumber !== to) {
      sessionMoves.push({ _id: s._id, from: s.puzzleNumber, to });
      continue;
    }
    // Already on the new numbering: created while lookups used the wrong answer
    if (oldNumbered.has(`${s.sessionId}|${s.date}`)) {
      sessionDeletes.push(s);
      continue;
    }
    const answer = answerByDate.get(s.date);
    if (!answer) continue;
    const fixed = reevaluate(s, answer);
    if (fixed.status !== s.status || fixed.attemptsUsed !== s.attemptsUsed) {
      sessionFixes.push({ s, fixed });
    }
  }

  console.log(`\ngameSessions: ${allSessions.length} total, ${sessionMoves.length} to renumber, ` +
    `${sessionFixes.length} to re-evaluate, ${sessionDeletes.length} duplicate(s) to remove`);
  for (const { s, fixed } of sessionFixes) {
    console.log(`  re-evaluate ${s.date} [${s.guesses.join(',')}]: ${s.status} -> ${fixed.status}`);
  }
  for (const s of sessionDeletes) {
    console.log(`  remove duplicate ${s.date} [${s.guesses.join(',')}] (older session for that day is kept)`);
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written.\n');
    await client.close();
    return;
  }

  if (sessionDeletes.length) {
    await sessions.deleteMany({ _id: { $in: sessionDeletes.map(s => s._id) } });
  }
  for (const { s, fixed } of sessionFixes) {
    await sessions.updateOne({ _id: s._id }, { $set: fixed });
  }
  await renumber(puzzles, puzzleMoves);
  await renumber(sessions, sessionMoves);

  // Verify: every date still has exactly the answer it had before
  const after = await puzzles.find().toArray();
  const changed = after.filter(p => answerByDate.get(p.date) !== p.answer);
  const misnumbered = after.filter(p => p.puzzleNumber !== numberForDate(p.date));
  if (changed.length || after.length !== allPuzzles.length || misnumbered.length) {
    console.error(`❌ Verification failed: ${changed.length} answers changed, ${misnumbered.length} misnumbered, ` +
      `${after.length}/${allPuzzles.length} docs. Restore from the backup.`);
    process.exit(1);
  }

  console.log('\n✅ Migration complete — all answers unchanged, numbering matches EPOCH_DATE\n');
  await client.close();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
