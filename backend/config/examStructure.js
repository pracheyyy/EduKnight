/**
 * Fixed exam -> subject structure (matches the brief exactly).
 * Subjects aren't a DB collection since this list never needs runtime CRUD —
 * only chapters and questions underneath each subject do.
 */
const EXAM_STRUCTURE = {
  NEET: {
    label: 'NEET',
    subjects: [
      { code: 'physics', name: 'Physics', emoji: '⚛️' },
      { code: 'chemistry', name: 'Chemistry', emoji: '🧪' },
      { code: 'botany', name: 'Botany', emoji: '🌿' },
      { code: 'zoology', name: 'Zoology', emoji: '🐾' },
    ],
  },
  JEE: {
    label: 'JEE',
    subjects: [
      { code: 'physics', name: 'Physics', emoji: '⚛️' },
      { code: 'chemistry', name: 'Chemistry', emoji: '🧪' },
      { code: 'mathematics', name: 'Mathematics', emoji: '📐' },
    ],
  },
  'MHT-CET': {
    label: 'MHT-CET',
    subjects: [
      { code: 'physics', name: 'Physics', emoji: '⚛️' },
      { code: 'chemistry', name: 'Chemistry', emoji: '🧪' },
      { code: 'mathematics', name: 'Mathematics', emoji: '📐' },
      { code: 'biology', name: 'Biology', emoji: '🧬' },
    ],
  },
};

function getSubject(examCode, subjectCode) {
  const exam = EXAM_STRUCTURE[examCode];
  if (!exam) return null;
  return exam.subjects.find((s) => s.code === subjectCode) || null;
}

module.exports = { EXAM_STRUCTURE, getSubject };