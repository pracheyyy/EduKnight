/**
 * One-time content seed script. Run manually with:
 *   node utils/seedContent.js
 *
 * Populates real NEET/JEE/MHT-CET chapter names so the app's structure is
 * accurate, but the QUESTIONS themselves are clearly-flagged template/demo
 * content (isSeedContent: true) — not a real authored question bank.
 * Replacing these with genuine questions is Admin Panel (Module 10) work.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Chapter = require('../models/Chapter');
const Question = require('../models/Question');

const CHAPTER_DATA = {
  NEET: {
    physics: ['Physical World & Units', 'Kinematics', 'Laws of Motion', 'Work, Energy & Power', 'Gravitation', 'Thermodynamics', 'Optics', 'Electrostatics'],
    chemistry: ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Chemical Bonding', 'States of Matter', 'Thermodynamics', 'Equilibrium', 'Organic Chemistry Basics', 'Coordination Compounds'],
    botany: ['The Living World', 'Plant Kingdom', 'Morphology of Flowering Plants', 'Cell: The Unit of Life', 'Photosynthesis', 'Plant Growth & Development', 'Genetics & Evolution', 'Ecology & Environment'],
    zoology: ['Animal Kingdom', 'Structural Organisation in Animals', 'Digestion & Absorption', 'Breathing & Exchange of Gases', 'Body Fluids & Circulation', 'Neural Control & Coordination', 'Human Reproduction', 'Human Health & Disease'],
  },
  JEE: {
    physics: ['Units & Measurements', 'Kinematics', 'Laws of Motion', 'Work, Energy & Power', 'Rotational Motion', 'Gravitation', 'Thermodynamics', 'Electrostatics', 'Current Electricity', 'Optics'],
    chemistry: ['Mole Concept', 'Atomic Structure', 'Chemical Bonding', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'p-Block Elements', 'Organic Chemistry: GOC', 'Coordination Compounds'],
    mathematics: ['Sets, Relations & Functions', 'Complex Numbers', 'Quadratic Equations', 'Sequences & Series', 'Permutations & Combinations', 'Binomial Theorem', 'Limits & Continuity', 'Differentiation', 'Integration', 'Coordinate Geometry'],
  },
  'MHT-CET': {
    physics: ['Rotational Dynamics', 'Mechanical Properties of Fluids', 'Kinetic Theory of Gases', 'Thermodynamics', 'Oscillations', 'Electrostatics', 'Current Electricity', 'Magnetism'],
    chemistry: ['Solid State', 'Solutions', 'Chemical Thermodynamics', 'Electrochemistry', 'Chemical Kinetics', 'p-Block Elements', 'Alcohols, Phenols & Ethers', 'Biomolecules'],
    mathematics: ['Mathematical Logic', 'Matrices', 'Trigonometric Functions', 'Pair of Straight Lines', 'Circle', 'Conics', 'Vectors', 'Line & Plane', 'Differentiation', 'Integration'],
    biology: ['Genetic Basis of Inheritance', 'Reproduction in Organisms', 'Plant Physiology', 'Human Physiology', 'Ecology & Environment', 'Biotechnology', 'Origin & Evolution', 'Human Health & Disease'],
  },
};

const DIFFICULTIES = ['easy', 'medium', 'hard'];

function buildDemoQuestions(chapterName, chapterDoc) {
  const questions = [];
  // 6 template questions per chapter: 2 easy, 2 medium, 2 hard, one flagged as a PYQ.
  for (let i = 0; i < 6; i++) {
    const difficulty = DIFFICULTIES[i % 3];
    const isPYQ = i === 5;
    const correctIndex = i % 4;
    const options = ['Option A', 'Option B', 'Option C', 'Option D'];
    options[correctIndex] = `${options[correctIndex]} (correct)`;

    questions.push({
      chapter: chapterDoc._id,
      examCode: chapterDoc.examCode,
      subjectCode: chapterDoc.subjectCode,
      questionText: `[Demo] A ${difficulty}-difficulty question on ${chapterName} — replace with a real authored question via the Admin Panel.`,
      options,
      correctOptionIndex: correctIndex,
      explanation: `This is placeholder explanation text for a ${chapterName} question. Real explanations get authored in Module 10 (Admin Panel).`,
      difficulty,
      isPYQ,
      pyqYear: isPYQ ? 2023 - (i % 4) : null,
      isSeedContent: true,
    });
  }
  return questions;
}

async function seed() {
  await connectDB();
  console.log('[Seed] Connected. Clearing existing seed content...');

  await Question.deleteMany({ isSeedContent: true });
  await Chapter.deleteMany({});

  let chapterCount = 0;
  let questionCount = 0;

  for (const [examCode, subjects] of Object.entries(CHAPTER_DATA)) {
    for (const [subjectCode, chapterNames] of Object.entries(subjects)) {
      const subjectName = subjectCode.charAt(0).toUpperCase() + subjectCode.slice(1);

      for (let order = 0; order < chapterNames.length; order++) {
        const name = chapterNames[order];
        const chapterDoc = await Chapter.create({
          examCode,
          subjectCode,
          subjectName,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          order,
          totalQuestions: 6,
          difficultyBreakdown: { easy: 2, medium: 2, hard: 2 },
        });

        const questions = buildDemoQuestions(name, chapterDoc);
        await Question.insertMany(questions);

        chapterCount++;
        questionCount += questions.length;
      }
    }
  }

  console.log(`[Seed] Done. Created ${chapterCount} chapters and ${questionCount} demo questions.`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
