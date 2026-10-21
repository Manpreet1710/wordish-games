/**
 * MongoDB connection utility for Netlify Functions.
 * 
 * Reuses a cached connection across warm Lambda invocations.
 * Handles connection errors gracefully with structured error objects.
 * 
 * Required environment variables:
 *   MONGODB_URI      — MongoDB Atlas connection string
 *   MONGODB_DB_NAME  — Target database name (default: "wordora")
 */

'use strict';

const { MongoClient } = require('mongodb');

// Module-level cache for serverless connection reuse
let cachedClient = null;
let cachedDb = null;

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'wordora';

// Connection options optimized for cserverless environments
const CLIENT_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

/**
 * Returns a connected MongoDB database instance.
 * Reuses cached connection if available and alive.
 * 
 * @returns {Promise<{db: Db, client: MongoClient}>}
 * @throws {Error} if MONGODB_URI is missing or connection fails
 */
async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
      'Configure it in Netlify environment variables or a local .env file.'
    );
  }

  // Return cached connection if still alive
  if (cachedClient && cachedDb) {
    try {
      // Quick ping to verify connection is alive
      await cachedDb.command({ ping: 1 });
      return { db: cachedDb, client: cachedClient };
    } catch {
      // Connection dropped — fall through to reconnect
      cachedClient = null;
      cachedDb = null;
    }
  }

  const client = new MongoClient(MONGODB_URI, CLIENT_OPTIONS);
  await client.connect();

  const db = client.db(MONGODB_DB_NAME);

  // Cache for subsequent warm invocations
  cachedClient = client;
  cachedDb = db;

  return { db, client };
}

/**
 * Ensures required MongoDB indexes exist.
 * Safe to run multiple times (idempotent).
 * 
 * @returns {Promise<void>}
 */
async function ensureIndexes() {
  const { db } = await connectToDatabase();

  // puzzles collection
  const puzzles = db.collection('puzzles');
  await puzzles.createIndex({ puzzleNumber: 1 }, { unique: true });
  await puzzles.createIndex({ date: 1 }, { unique: true });
  await puzzles.createIndex({ published: 1, date: 1 });

  // gameSessions collection
  const sessions = db.collection('gameSessions');
  await sessions.createIndex({ sessionId: 1, puzzleNumber: 1 }, { unique: true });
  await sessions.createIndex({ puzzleNumber: 1 });
  await sessions.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 } // TTL index — MongoDB removes docs when expiresAt passes
  );

  // dailyStats collection
  const stats = db.collection('dailyStats');
  await stats.createIndex({ date: 1 }, { unique: true });
}

module.exports = { connectToDatabase, ensureIndexes };
