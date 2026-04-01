/* progress-tracker.js — Client-side progress indicators */

class ProgressTracker {
  constructor(contentId, progressBarId) {
    this.contentId = contentId;
    this.progressBarId = progressBarId;
    this.sections = [];
    this.sectionTimers = {};
    this.completedSections = new Set();
    this._init();
  }

  _init() {
    const content = document.getElementById(this.contentId);
    if (!content) return;

    this.sections = Array.from(content.querySelectorAll('.lesson-section'));
    if (this.sections.length === 0) return;

    this._buildProgressBar();
    this._setupIntersectionObserver();
  }

  _buildProgressBar() {
    const container = document.getElementById(this.progressBarId);
    if (!container) return;

    container.innerHTML = `
      <div class="progress-bar-fill" id="progress-fill" style="width:0%"></div>
    `;

    const label = document.createElement('div');
    label.className = 'progress-label';
    label.id = 'progress-label';
    label.textContent = `0 / ${this.sections.length} sections`;
    container.parentElement && container.parentElement.appendChild(label);
  }

  _setupIntersectionObserver() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const section = entry.target;
        const idx = this.sections.indexOf(section);
        if (idx === -1) return;

        if (entry.isIntersecting) {
          section.classList.add('section-active');
          this._startTimer(section, idx);
        } else {
          section.classList.remove('section-active');
          this._clearTimer(idx);
        }
      });
    }, { threshold: 0.3 });

    this.sections.forEach(section => observer.observe(section));
    this._observer = observer;
  }

  _startTimer(section, idx) {
    if (this.completedSections.has(idx)) return;
    if (this.sectionTimers[idx]) return;

    this.sectionTimers[idx] = setTimeout(() => {
      this._markComplete(section, idx);
    }, 10000); // 10 seconds of visibility
  }

  _clearTimer(idx) {
    if (this.sectionTimers[idx]) {
      clearTimeout(this.sectionTimers[idx]);
      delete this.sectionTimers[idx];
    }
  }

  _markComplete(section, idx) {
    if (this.completedSections.has(idx)) return;
    this.completedSections.add(idx);

    section.classList.remove('section-active');
    section.classList.add('section-complete');

    let badge = section.querySelector('.section-badge');
    if (!badge) {
      const h2 = section.querySelector('h2');
      if (h2) {
        badge = document.createElement('span');
        badge.className = 'section-badge complete';
        badge.textContent = '✓ Done';
        h2.appendChild(badge);
      }
    }

    this._updateProgress();

    const sectionName = section.dataset.section || `section-${idx}`;
    document.dispatchEvent(new CustomEvent('section-completed', {
      detail: { sectionIndex: idx, sectionName, total: this.sections.length }
    }));
  }

  _updateProgress() {
    const done = this.completedSections.size;
    const total = this.sections.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    const label = document.getElementById('progress-label');
    if (label) label.textContent = `${done} / ${total} sections`;
  }

  getProgress() {
    return {
      completed: this.completedSections.size,
      total: this.sections.length,
      percentage: this.sections.length > 0
        ? Math.round((this.completedSections.size / this.sections.length) * 100)
        : 0
    };
  }
}

window.ProgressTracker = ProgressTracker;
