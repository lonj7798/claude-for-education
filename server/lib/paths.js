'use strict';

const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEACHING = path.join(PROJECT_ROOT, 'teaching_process');

module.exports = {
  PROJECT_ROOT,
  TEACHING,
  settings: () => path.join(TEACHING, 'settings.json'),
  studentProfile: () => path.join(TEACHING, 'student_profile.json'),
  coursePlan: () => path.join(TEACHING, 'course_plan.json'),
  sessionMeta: (id) => path.join(TEACHING, 'sessions', `${id}.meta.json`),
  studentJsonl: (id) => path.join(TEACHING, 'sessions', `${id}.student.jsonl`),
  teacherJsonl: (id) => path.join(TEACHING, 'sessions', `${id}.teacher.jsonl`),
  completedSignal: (id) => path.join(TEACHING, 'sessions', `${id}.completed`),
  htmlMaterials: (chapterId) => path.join(TEACHING, 'html_materials', chapterId),
  evaluations: () => path.join(TEACHING, 'evaluations'),
  progressSummary: () => path.join(TEACHING, 'history', 'progress_summary.json'),
  rawData: () => path.join(TEACHING, 'history', 'raw_data.json'),
  loopState: () => path.join(TEACHING, 'loop_state.json'),
  currentStatus: () => path.join(TEACHING, 'current_status.json'),
  activeAgents: () => path.join(TEACHING, 'active_agents.json'),
  materialsIndex: () => path.join(TEACHING, 'materials_index.json'),
  plans: (filename) => path.join(TEACHING, 'plans', filename || ''),
  researchBriefs: (filename) => path.join(TEACHING, 'research_briefs', filename || ''),
};
