#!/usr/bin/env node
// Merges researched E-number classifications (scripts/find-unlisted-additives.mjs output,
// classified by parallel research agents against EU regulation sources) into
// data/eu-additives.json. Only high/medium-confidence entries are merged automatically;
// low-confidence and "unknown" entries are written to a separate review file instead of
// being guessed into the live database.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'eu-additives.json');
const scratchDir = process.argv[2];

if (!scratchDir) {
  console.error('Usage: node merge-classified-additives.mjs <scratchpad-dir>');
  process.exit(1);
}

const db = JSON.parse(readFileSync(dbPath, 'utf-8'));

const merged = [];
const needsReview = [];

for (let i = 1; i <= 6; i++) {
  const batch = JSON.parse(readFileSync(path.join(scratchDir, `classified${i}.json`), 'utf-8'));
  for (const entry of batch) {
    if (entry.status === 'unknown' || entry.confidence === 'low') {
      needsReview.push(entry);
      continue;
    }
    if (db.additives[entry.key]) {
      needsReview.push({ ...entry, notes: `[KEY COLLISION with existing entry] ${entry.notes ?? ''}` });
      continue;
    }
    const record = {
      name: entry.name,
      status: entry.status,
      category: entry.category,
    };
    if (entry.notes) record.notes = entry.notes;
    if (entry.bannedSince) record.bannedSince = entry.bannedSince;
    db.additives[entry.key] = record;
    merged.push({ key: entry.key, ...record, source: entry.source, confidence: entry.confidence });
  }
}

db._meta.lastUpdated = new Date().toISOString().slice(0, 10);

writeFileSync(dbPath, JSON.stringify(db, null, 2) + '\n');
writeFileSync(
  path.join(scratchDir, 'needs-review.json'),
  JSON.stringify(needsReview, null, 2) + '\n'
);
writeFileSync(
  path.join(scratchDir, 'merged.json'),
  JSON.stringify(merged, null, 2) + '\n'
);

console.log(`Merged ${merged.length} entries into data/eu-additives.json`);
console.log(`${needsReview.length} entries need manual review (written to needs-review.json)`);

const statusCounts = {};
for (const m of merged) statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
console.log('Merged by status:', statusCounts);
