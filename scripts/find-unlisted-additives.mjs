#!/usr/bin/env node
// Diffs the Open Food Facts additives taxonomy against data/eu-additives.json
// to find E-numbers OFF knows about that we haven't classified yet.
// Does NOT write banned/restricted/approved status automatically — that
// requires checking the actual EC 1333/2008 text, not OFF metadata.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OFF_TAXONOMY_URL = 'https://world.openfoodfacts.org/data/taxonomies/additives.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'eu-additives.json');

function normalizeENumber(raw) {
  // OFF's e_number.en is a bare number/suffix, e.g. "500", "101i", "500(ii)"
  const cleaned = raw
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\(.*\)$/, '');
  return cleaned.startsWith('e') ? cleaned : `e${cleaned}`;
}

async function main() {
  const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
  const knownKeys = new Set(Object.keys(db.additives));

  const res = await fetch(OFF_TAXONOMY_URL);
  if (!res.ok) {
    console.error(`Failed to fetch OFF taxonomy: HTTP ${res.status}`);
    process.exit(1);
  }
  const taxonomy = await res.json();

  const missing = [];

  for (const [id, entry] of Object.entries(taxonomy)) {
    const eNumber = entry.e_number?.en;
    if (!eNumber) continue;

    const key = normalizeENumber(eNumber);
    if (knownKeys.has(key)) continue;

    missing.push({
      key,
      eNumber: `E${eNumber}`,
      name: entry.name?.en ?? id,
      classes: entry.additives_classes?.en ?? null,
    });
  }

  missing.sort((a, b) => a.key.localeCompare(b.key));

  console.log(`OFF taxonomy entries: ${Object.keys(taxonomy).length}`);
  console.log(`Known in data/eu-additives.json: ${knownKeys.size}`);
  console.log(`Unlisted E-numbers found: ${missing.length}\n`);

  for (const item of missing) {
    console.log(
      `${item.eNumber.padEnd(10)} ${item.name.padEnd(45)} ${item.classes ?? '(no class info)'}`
    );
  }

  if (missing.length > 0) {
    console.log(
      '\nThese need manual classification (banned/restricted/warning/approved) against EC Regulation No 1333/2008 before adding to data/eu-additives.json.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
