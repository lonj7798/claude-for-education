'use strict';

/* ── Chart.js color palette matching education.css ── */
const PALETTE = {
  primary:      '#2563eb',
  primaryLight: 'rgba(37, 99, 235, 0.15)',
  success:      '#16a34a',
  successLight: 'rgba(22, 163, 74, 0.15)',
  warning:      '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  error:        '#dc2626',
  errorLight:   'rgba(220, 38, 38, 0.15)',
  purple:       '#7c3aed',
  purpleLight:  'rgba(124, 58, 237, 0.15)',
  gray:         '#6b7280',
  grayLight:    'rgba(107, 114, 128, 0.15)',
};

/* Colors used to distinguish chapters on progression chart */
const CHAPTER_COLORS = [
  '#2563eb', '#7c3aed', '#16a34a', '#f59e0b',
  '#dc2626', '#0891b2', '#be185d', '#ea580c',
];

/* XP required per level (simple formula: level * 100) */
function xpForLevel(level) {
  return level * 100;
}

class Dashboard {
  constructor() {
    this.profile    = null;
    this.coursePlan = null;
    this.progress   = null;
    this.rawData    = [];
    this.charts     = {};
  }

  async init() {
    try {
      const [profileRes, planRes, progressRes, rawRes] = await Promise.all([
        fetch('/api/student/profile').then(r => r.json()).catch(() => ({})),
        fetch('/api/course/plan').then(r => r.json()).catch(() => ({})),
        fetch('/api/progress').then(r => r.json()).catch(() => ({})),
        fetch('/api/progress/raw').then(r => r.json()).catch(() => ({})),
      ]);

      this.profile    = profileRes.profile    || null;
      this.coursePlan = planRes.plan          || null;
      this.progress   = progressRes.summary   || null;
      // raw endpoint returns { success, data: [...] }
      const rawPayload = rawRes.data;
      this.rawData = Array.isArray(rawPayload) ? rawPayload : [];

      this.renderStudentInfo();
      this.renderCourseOverview();
      this.renderLearningProgression();
      this.renderPerformanceTrends();
      this.renderSessionHistory();
      this.renderCurrentStatus();
      this.renderBuddyStatus();

      // Trigger fade-in after all sections are populated
      requestAnimationFrame(() => {
        document.querySelectorAll('.dashboard-card').forEach((card, i) => {
          card.style.animationDelay = `${i * 60}ms`;
          card.classList.add('card-visible');
        });
      });
    } catch (err) {
      console.error('[Dashboard] init error:', err);
    }
  }

  /* ── Student Info Header ── */
  renderStudentInfo() {
    const el = document.getElementById('student-info');
    if (!this.profile) {
      el.textContent = 'No student profile loaded yet.';
      return;
    }
    const name  = this.profile.name  || 'Student';
    const topic = this.profile.topic || this.profile.sub_topic || null;
    const level = this.profile.education_level || null;
    let parts = [name];
    if (topic) parts.push(topic);
    if (level) parts.push(level);
    el.textContent = parts.join(' · ');
    document.title = `${name}'s Learning Dashboard`;
  }

  /* ── Course Overview ── */
  renderCourseOverview() {
    const p = this.progress;
    const plan = this.coursePlan;
    const profile = this.profile;

    // Topic
    const topic = (profile && (profile.topic || profile.sub_topic)) ||
                  (plan   && (plan.topic   || plan.sub_topic))     ||
                  '—';
    document.getElementById('stat-topic').textContent = topic;

    // Chapters
    const completed = (p && p.chapters_completed) || (plan && plan.chapters_completed) || 0;
    const total     = (plan && plan.total_chapters_planned) ||
                      (plan && plan.chapters && plan.chapters.length) || 0;
    document.getElementById('stat-chapters').textContent = `${completed} / ${total || '?'}`;

    // Sessions
    const sessions = (p && p.total_sessions) ||
                     (profile && profile.history_summary && profile.history_summary.total_sessions) || 0;
    document.getElementById('stat-sessions').textContent = sessions;

    // Time
    const mins = (p && p.total_time_minutes) || 0;
    document.getElementById('stat-time').textContent = mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m`
      : `${mins} min`;

    // Progress bar
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('course-progress-fill').style.width = `${pct}%`;
    document.getElementById('course-progress-label').textContent = `${pct}% complete`;
  }

  /* ── Learning Progression Line Chart ── */
  renderLearningProgression() {
    const canvas  = document.getElementById('progression-chart');
    const msgEl   = document.getElementById('progression-min-data');

    if (this.rawData.length < 3) {
      canvas.style.display = 'none';
      msgEl.style.display  = 'block';
      return;
    }

    // Build chapter color map
    const chapters = [...new Set(this.rawData.map(r => r.chapter_id || r.chapter_title || 'Unknown'))];
    const colorMap = {};
    chapters.forEach((ch, i) => { colorMap[ch] = CHAPTER_COLORS[i % CHAPTER_COLORS.length]; });

    const labels = this.rawData.map((r, i) => {
      if (r.completed_at || r.date) {
        const d = new Date(r.completed_at || r.date);
        return isNaN(d) ? `Session ${i + 1}` : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return `Session ${i + 1}`;
    });

    const overallScores = this.rawData.map(r =>
      r.overall_score != null ? Math.round(r.overall_score * 100) : null
    );

    const pointColors = this.rawData.map(r => {
      const key = r.chapter_id || r.chapter_title || 'Unknown';
      return colorMap[key] || PALETTE.primary;
    });

    this.charts.progression = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Overall Score (%)',
          data: overallScores,
          borderColor: PALETTE.primary,
          backgroundColor: PALETTE.primaryLight,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.35,
          spanGaps: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const r = this.rawData[ctx.dataIndex];
                const ch = r && (r.chapter_title || r.chapter_id);
                return ch ? `Chapter: ${ch}` : '';
              },
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: v => `${v}%` },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            grid: { display: false },
          },
        },
      },
    });
  }

  /* ── Performance Trends (bar + radar) ── */
  renderPerformanceTrends() {
    this._renderQuizScoresChart();
    this._renderSkillsRadarChart();
  }

  _renderQuizScoresChart() {
    const canvas = document.getElementById('quiz-scores-chart');
    const msgEl  = document.getElementById('quiz-min-data');

    if (this.rawData.length < 3) {
      canvas.style.display = 'none';
      msgEl.style.display  = 'block';
      return;
    }

    const labels = this.rawData.map((r, i) => `S${i + 1}`);
    const scores = this.rawData.map(r =>
      r.quiz_score != null ? Math.round(r.quiz_score * 100) : null
    );

    const barColors = scores.map(s => {
      if (s == null) return PALETTE.grayLight;
      if (s >= 80)  return PALETTE.success;
      if (s >= 50)  return PALETTE.warning;
      return PALETTE.error;
    });

    this.charts.quizScores = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quiz Score (%)',
          data: scores,
          backgroundColor: barColors,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.parsed.y ?? '—'}%` } },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: v => `${v}%` },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });
  }

  _renderSkillsRadarChart() {
    const canvas = document.getElementById('skills-radar-chart');
    const msgEl  = document.getElementById('radar-min-data');

    // Collect all strength/weakness labels from rawData
    const skillCounts = {};
    const skillScores = {};

    this.rawData.forEach(r => {
      const strengths  = r.strengths  || [];
      const weaknesses = r.weaknesses || [];
      strengths.forEach(s => {
        skillCounts[s] = (skillCounts[s] || 0) + 1;
        skillScores[s] = (skillScores[s] || []).concat(1);
      });
      weaknesses.forEach(w => {
        skillCounts[w] = (skillCounts[w] || 0) + 1;
        skillScores[w] = (skillScores[w] || []).concat(0);
      });
    });

    const skillLabels = Object.keys(skillCounts);

    // Also use progress summary strongest/weakest if rawData skills are sparse
    const hasSummaryData =
      this.progress &&
      ((this.progress.strongest_areas && this.progress.strongest_areas.length > 0) ||
       (this.progress.weakest_areas   && this.progress.weakest_areas.length   > 0));

    if (skillLabels.length < 3 && !hasSummaryData) {
      canvas.style.display = 'none';
      msgEl.style.display  = 'block';
      return;
    }

    let labels, data;

    if (skillLabels.length >= 3) {
      labels = skillLabels.slice(0, 8);
      data   = labels.map(lbl => {
        const scores = skillScores[lbl] || [];
        const avg    = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
        return Math.round(avg * 100);
      });
    } else {
      // Fallback: use strongest (100) + weakest (40) from summary
      const strong  = (this.progress.strongest_areas || []).slice(0, 4);
      const weak    = (this.progress.weakest_areas   || []).slice(0, 4);
      labels = [...strong, ...weak].slice(0, 8);
      data   = [
        ...strong.map(() => 85),
        ...weak.map(() => 40),
      ].slice(0, 8);
    }

    this.charts.radar = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Skill Level (%)',
          data,
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          borderColor: PALETTE.primary,
          pointBackgroundColor: PALETTE.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25, callback: v => `${v}%`, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.08)' },
            pointLabels: { font: { size: 11 } },
          },
        },
      },
    });
  }

  /* ── Session History Table ── */
  renderSessionHistory() {
    const tbody  = document.getElementById('history-body');
    const noSess = document.getElementById('no-sessions');
    const table  = document.getElementById('history-table');

    if (!this.rawData.length) {
      table.style.display  = 'none';
      noSess.style.display = 'block';
      return;
    }

    this.rawData.forEach((r, i) => {
      // Main row
      const tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'row-even' : 'row-odd';

      const date = r.completed_at || r.date
        ? new Date(r.completed_at || r.date).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
          })
        : '—';

      const chapter  = r.chapter_title || r.chapter_id || '—';
      const duration = r.duration_minutes != null ? `${r.duration_minutes} min` : '—';

      const quizPct   = r.quiz_score    != null ? Math.round(r.quiz_score    * 100) : null;
      const overallPct= r.overall_score != null ? Math.round(r.overall_score * 100) : null;

      const quizClass = quizPct == null ? '' :
        quizPct >= 80 ? 'score-green' : quizPct >= 50 ? 'score-amber' : 'score-red';

      const overallClass = overallPct == null ? '' :
        overallPct >= 80 ? 'score-green' : overallPct >= 50 ? 'score-amber' : 'score-red';

      const rowId = `detail-row-${i}`;

      tr.innerHTML = `
        <td class="col-num">${i + 1}</td>
        <td class="col-date">${date}</td>
        <td class="col-chapter">${this._esc(chapter)}</td>
        <td class="col-dur">${duration}</td>
        <td class="col-score"><span class="score-badge ${quizClass}">${quizPct != null ? quizPct + '%' : '—'}</span></td>
        <td class="col-score"><span class="score-badge ${overallClass}">${overallPct != null ? overallPct + '%' : '—'}</span></td>
        <td class="col-action"><button class="detail-btn" data-target="${rowId}" aria-expanded="false">Details</button></td>
      `;

      tbody.appendChild(tr);

      // Detail row (hidden)
      const detailTr = document.createElement('tr');
      detailTr.id        = rowId;
      detailTr.className = 'detail-row';
      detailTr.style.display = 'none';

      const evalSummary  = r.evaluation_summary  || r.summary  || null;
      const strengths    = r.strengths  || [];
      const weaknesses   = r.weaknesses || [];
      const nextFocus    = r.next_focus || r.recommended_focus || null;

      let detailHTML = '<td colspan="7"><div class="detail-content">';
      if (evalSummary) detailHTML += `<p class="detail-summary">${this._esc(evalSummary)}</p>`;
      if (strengths.length) {
        detailHTML += `<div class="detail-section"><strong>Strengths:</strong> <span class="tag-list">${
          strengths.map(s => `<span class="tag tag-green">${this._esc(s)}</span>`).join('')
        }</span></div>`;
      }
      if (weaknesses.length) {
        detailHTML += `<div class="detail-section"><strong>Areas to improve:</strong> <span class="tag-list">${
          weaknesses.map(w => `<span class="tag tag-amber">${this._esc(w)}</span>`).join('')
        }</span></div>`;
      }
      if (nextFocus) {
        detailHTML += `<div class="detail-section"><strong>Next focus:</strong> ${this._esc(nextFocus)}</div>`;
      }
      if (!evalSummary && !strengths.length && !weaknesses.length) {
        detailHTML += '<p class="detail-empty">No evaluation details available for this session.</p>';
      }
      detailHTML += '</div></td>';
      detailTr.innerHTML = detailHTML;
      tbody.appendChild(detailTr);
    });

    // Toggle detail rows
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.detail-btn');
      if (!btn) return;
      const target  = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isOpen  = target.style.display !== 'none';
      target.style.display = isOpen ? 'none' : 'table-row';
      btn.textContent = isOpen ? 'Details' : 'Hide';
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  /* ── Current Status ── */
  renderCurrentStatus() {
    const el = document.getElementById('status-content');

    // Current chapter from course plan
    let currentChapter = null;
    if (this.coursePlan && this.coursePlan.current_chapter_id && this.coursePlan.chapters) {
      currentChapter = this.coursePlan.chapters.find(
        c => c.chapter_id === this.coursePlan.current_chapter_id
      ) || null;
    }

    // Latest evaluation info from last rawData entry
    const latest = this.rawData.length ? this.rawData[this.rawData.length - 1] : null;

    // Understanding level
    const understanding =
      (this.profile && this.profile.history_summary && this.profile.history_summary.overall_understanding_level) ||
      (this.progress && this.progress.score_progression && this.progress.score_progression.length
        ? this._lastOf(this.progress.score_progression)
        : null);

    const courseStatus = (this.coursePlan && this.coursePlan.status) || 'not_started';

    let html = '';

    html += `<div class="status-item">
      <span class="status-label">Course Status</span>
      <span class="status-value status-badge-${courseStatus}">${this._formatStatus(courseStatus)}</span>
    </div>`;

    if (currentChapter) {
      html += `<div class="status-item">
        <span class="status-label">Current Chapter</span>
        <span class="status-value">${this._esc(currentChapter.title || currentChapter.chapter_id)}</span>
      </div>`;
      if (currentChapter.difficulty) {
        html += `<div class="status-item">
          <span class="status-label">Difficulty</span>
          <span class="status-value">${this._esc(currentChapter.difficulty)}</span>
        </div>`;
      }
    }

    if (understanding != null) {
      const pct = typeof understanding === 'number' && understanding <= 1
        ? Math.round(understanding * 100) + '%'
        : String(understanding);
      html += `<div class="status-item">
        <span class="status-label">Overall Understanding</span>
        <span class="status-value">${pct}</span>
      </div>`;
    }

    if (latest) {
      const nextFocus = latest.next_focus || latest.recommended_focus;
      if (nextFocus) {
        html += `<div class="status-item status-item-wide">
          <span class="status-label">Recommended Next Focus</span>
          <span class="status-value">${this._esc(nextFocus)}</span>
        </div>`;
      }
    }

    if (this.progress) {
      const strong = this.progress.strongest_areas || [];
      const weak   = this.progress.weakest_areas   || [];
      if (strong.length) {
        html += `<div class="status-item status-item-wide">
          <span class="status-label">Strongest Areas</span>
          <span class="status-value tag-list">${strong.map(s => `<span class="tag tag-green">${this._esc(s)}</span>`).join('')}</span>
        </div>`;
      }
      if (weak.length) {
        html += `<div class="status-item status-item-wide">
          <span class="status-label">Areas to Improve</span>
          <span class="status-value tag-list">${weak.map(w => `<span class="tag tag-amber">${this._esc(w)}</span>`).join('')}</span>
        </div>`;
      }
    }

    if (!html) {
      html = '<p class="empty-state">Start your first session to see your status here!</p>';
    }

    el.innerHTML = html;
  }

  /* ── Buddy Status ── */
  renderBuddyStatus() {
    const profile = this.profile;
    if (!profile) return;

    const config = profile.buddy_config || {};
    const state  = profile.buddy_state  || {};

    if (!config.buddy_enabled) return;

    document.getElementById('buddy-status').style.display = 'block';

    // Character emoji
    const charMap = { fox: '🦊', robot: '🤖', fairy: '🧚' };
    const emoji   = charMap[config.buddy_character] || '🌟';
    document.getElementById('buddy-char').textContent = emoji;

    // Name
    const name = config.buddy_name || 'Buddy';
    document.getElementById('buddy-name-display').textContent = name;

    // Level + XP
    const level   = state.buddy_level || 1;
    const xp      = state.buddy_xp    || 0;
    const xpNeeded= xpForLevel(level);
    const xpPct   = Math.min(100, Math.round((xp / xpNeeded) * 100));

    document.getElementById('buddy-level-display').textContent = `Level ${level}`;
    document.getElementById('buddy-xp-fill').style.width       = `${xpPct}%`;
    document.getElementById('buddy-xp-current').textContent    = `${xp} XP`;
    document.getElementById('buddy-xp-next').textContent       = `${xpNeeded} XP to next level`;
  }

  /* ── Utilities ── */
  _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _lastOf(arr) {
    return arr && arr.length ? arr[arr.length - 1] : null;
  }

  _formatStatus(status) {
    const map = {
      not_started:     'Not Started',
      waiting:         'Ready',
      teaching:        'In Session',
      course_complete: 'Completed',
    };
    return map[status] || status;
  }
}

/* Boot */
document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new Dashboard();
  dashboard.init();
});
