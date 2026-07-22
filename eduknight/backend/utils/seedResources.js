/**
 * One-time content seed for Module 9 (Resources). Run with:
 *   node utils/seedResources.js
 *
 * Same honesty approach as seedContent.js: real category structure and
 * realistic titles, but placeholder URLs (isSeedContent: true) — not
 * claims of real, working links to actual videos/PDFs. Swapping in real
 * curated links is Admin Panel (Module 10) work.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Resource = require('../models/Resource');

const EXAM_SUBJECTS = {
  NEET: ['physics', 'chemistry', 'botany', 'zoology'],
  JEE: ['physics', 'chemistry', 'mathematics'],
  'MHT-CET': ['physics', 'chemistry', 'mathematics', 'biology'],
};

const TYPES = [
  { type: 'youtube', emoji: '📺', titlePrefix: 'Complete', titleSuffix: 'Playlist', sourcePool: ['Physics Wallah', 'Unacademy', 'Vedantu', "Byju's Classes"] },
  { type: 'notes', emoji: '📝', titlePrefix: 'Handwritten Notes —', titleSuffix: '', sourcePool: ['Topper Notes', 'EduKnight Notes Team'] },
  { type: 'formula-sheet', emoji: '📐', titlePrefix: 'Formula Sheet —', titleSuffix: '', sourcePool: ['EduKnight Notes Team'] },
  { type: 'pyq-paper', emoji: '📄', titlePrefix: '', titleSuffix: '— Previous Year Paper', sourcePool: ['Official Archive'] },
];

function subjectLabel(code) {
  return code.charAt(0).toUpperCase() + code.slice(1);
}

async function seed() {
  await connectDB();
  console.log('[Seed] Connected. Clearing existing seed resources...');
  await Resource.deleteMany({ isSeedContent: true });

  const docs = [];

  for (const [examCode, subjects] of Object.entries(EXAM_SUBJECTS)) {
    for (const subjectCode of subjects) {
      const label = subjectLabel(subjectCode);
      for (const t of TYPES) {
        // 2 resources per (exam, subject, type) combo
        for (let i = 1; i <= 2; i++) {
          const source = t.sourcePool[i % t.sourcePool.length];
          const title = t.type === 'pyq-paper'
            ? `${examCode} ${label} ${2024 - i} ${t.titleSuffix}`
            : `[Demo] ${t.titlePrefix} ${label} ${t.titleSuffix}`.replace(/\s+/g, ' ').trim();

          docs.push({
            title,
            type: t.type,
            examCode,
            subjectCode,
            description: `Placeholder ${t.type.replace('-', ' ')} resource for ${examCode} ${label}, part ${i}. Replace with a real curated link via the Admin Panel.`,
            url: '#',
            thumbnailEmoji: t.emoji,
            source,
            tags: [examCode, label, t.type],
            isSeedContent: true,
          });
        }
      }
    }
  }

  await Resource.insertMany(docs);
  console.log(`[Seed] Done. Created ${docs.length} demo resources.`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
