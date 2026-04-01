/* buddy-engine.js — Buddy companion logic */

class BuddyEngine {
  constructor(messages) {
    this.messages = messages || {};
    this.xp = 0;
    this.level = 1;
    this.enabled = false;
    this._panel = null;
    this._characterEl = null;
    this._messageEl = null;
    this._xpFill = null;
    this._xpValues = null;
    this._msgTimer = null;
    this._idleTimer = null;
    this._storageKey = 'buddy_collapsed';

    this._loadProfile();
  }

  async _loadProfile() {
    try {
      const res = await fetch('/api/student/profile');
      if (!res.ok) throw new Error('No profile');
      const profile = await res.json();
      this.enabled = profile.buddy_enabled !== false;
      this.xp = profile.xp || 0;
      this.level = this._calcLevel(this.xp);
      this._character = profile.buddy_character || 'fox';
      this._buddyName = profile.buddy_name || 'Buddy';
      if (this.enabled) this._init();
    } catch {
      // If no profile endpoint, check for inline config
      const panel = document.getElementById('buddy-panel');
      if (panel && panel.dataset.enabled !== 'false') {
        this.enabled = true;
        this._character = 'fox';
        this._buddyName = 'Buddy';
        this._init();
      }
    }
  }

  _init() {
    const panel = document.getElementById('buddy-panel');
    if (!panel) return;
    this._panel = panel;

    panel.classList.remove('buddy-hidden');
    panel.dataset.character = this._character;

    panel.innerHTML = this._buildHTML();
    this._characterEl = panel.querySelector('.buddy-character');
    this._messageEl = panel.querySelector('.buddy-message');
    this._xpFill = panel.querySelector('.buddy-xp-fill');
    this._xpValues = panel.querySelector('.buddy-xp-values');

    panel.querySelector('.buddy-header').addEventListener('click', () => this._toggleCollapse());
    panel.querySelector('.buddy-toggle-btn').addEventListener('click', e => {
      e.stopPropagation();
      this._toggleCollapse();
    });

    // Restore collapsed state
    if (localStorage.getItem(this._storageKey) === 'true') {
      panel.classList.add('buddy-collapsed');
    }

    this._updateXPBar();
    this._listenForEvents();
    this._startIdleTimer();

    const greeting = this._pick('greeting') || `Hi! I'm ${this._buddyName}. Let's learn together!`;
    this.showMessage(greeting);
  }

  _buildHTML() {
    const xpForNext = this._xpForNextLevel();
    const xpInLevel = this._xpInCurrentLevel();
    const pct = xpForNext > 0 ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 100;
    const charEmoji = { fox: '🦊', robot: '🤖', fairy: '🧚' }[this._character] || '🦊';

    return `
      <div class="buddy-header">
        <div class="buddy-header-left">
          <span class="buddy-header-name">${this._escHtml(this._buddyName)}</span>
          <span class="buddy-header-level">L${this.level}</span>
        </div>
        <button class="buddy-toggle-btn" aria-label="Toggle buddy">▾</button>
      </div>
      <div class="buddy-body">
        <span class="buddy-character">${charEmoji}</span>
        <div class="buddy-name">${this._escHtml(this._buddyName)}</div>
        <div class="buddy-message">
          <span class="buddy-message-text">Hello!</span>
        </div>
        <div class="buddy-xp-section">
          <div class="buddy-xp-label">
            <span>XP</span>
            <span>Level ${this.level}</span>
          </div>
          <div class="buddy-xp-bar">
            <div class="buddy-xp-fill" style="width:${pct}%"></div>
          </div>
          <div class="buddy-xp-values">${xpInLevel} / ${xpForNext} XP</div>
        </div>
      </div>
    `;
  }

  _listenForEvents() {
    document.addEventListener('quiz-submitted', e => {
      const score = e.detail.score || 0;
      this._addXP(10);
      this._resetIdleTimer();
      if (score >= 0.8) {
        this._animateCharacter('celebration');
        this.showMessage(this._pick('quiz_high') || 'Fantastic! You nailed it! 🎉');
      } else if (score >= 0.5) {
        this._animateCharacter('nod');
        this.showMessage(this._pick('quiz_mid') || 'Good work! Keep it up, you\'re improving!');
      } else {
        this._animateCharacter('pat');
        this.showMessage(this._pick('quiz_low') || 'Don\'t worry, every attempt helps you learn more!');
      }
    });

    document.addEventListener('section-completed', e => {
      this._addXP(5);
      this._resetIdleTimer();
      this._animateCharacter('bounce');
      this.showMessage(this._pick('section_complete') || 'Section done! You\'re making great progress!');
    });

    document.addEventListener('chat-message-received', () => {
      this._addXP(2);
      this._resetIdleTimer();
      this._animateCharacter('bounce');
    });

    document.addEventListener('session-completed', () => {
      this._animateCharacter('celebration');
      this.showMessage('Amazing work completing this lesson! See you next time! 🌟');
    });
  }

  _startIdleTimer() {
    this._resetIdleTimer();
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt => {
      document.addEventListener(evt, () => this._resetIdleTimer(), { passive: true });
    });
  }

  _resetIdleTimer() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this.showMessage(this._pick('idle_nudge') || 'Still there? Take your time — no rush! 😊');
    }, 60000);
  }

  showMessage(text) {
    if (!this._messageEl) return;

    // Ensure panel is not collapsed to show message
    if (this._panel && this._panel.classList.contains('buddy-collapsed')) {
      this._panel.classList.remove('buddy-collapsed');
      localStorage.setItem(this._storageKey, 'false');
    }

    const textEl = this._messageEl.querySelector('.buddy-message-text');
    if (textEl) textEl.textContent = text;

    this._messageEl.classList.remove('fade-in');
    // Force reflow to restart animation
    void this._messageEl.offsetWidth;
    this._messageEl.classList.add('fade-in');

    if (this._msgTimer) clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      if (textEl) textEl.textContent = '...';
    }, 5000);
  }

  _animateCharacter(type) {
    if (!this._characterEl) return;
    this._characterEl.classList.remove('bounce', 'celebration', 'nod', 'pat');
    void this._characterEl.offsetWidth;
    this._characterEl.classList.add(type);
    setTimeout(() => this._characterEl && this._characterEl.classList.remove(type), 1000);
  }

  _addXP(amount) {
    const prevLevel = this.level;
    this.xp += amount;
    this.level = this._calcLevel(this.xp);
    this._updateXPBar();
    this._showXPGain(amount);

    if (this.level > prevLevel) {
      setTimeout(() => {
        this._animateCharacter('celebration');
        this.showMessage(`Level up! You're now Level ${this.level}! 🎊`);
      }, 600);
    }

    // Persist XP to server (fire and forget)
    fetch('/api/student/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp: this.xp })
    }).catch(() => {});
  }

  _updateXPBar() {
    if (!this._xpFill) return;
    const xpForNext = this._xpForNextLevel();
    const xpInLevel = this._xpInCurrentLevel();
    const pct = xpForNext > 0 ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 100;
    this._xpFill.style.width = `${pct}%`;
    if (this._xpValues) this._xpValues.textContent = `${xpInLevel} / ${xpForNext} XP`;

    const levelEl = this._panel && this._panel.querySelector('.buddy-header-level');
    if (levelEl) levelEl.textContent = `L${this.level}`;
  }

  _showXPGain(amount) {
    if (!this._panel) return;
    const xpSection = this._panel.querySelector('.buddy-xp-section');
    if (!xpSection) return;
    const gain = document.createElement('div');
    gain.className = 'buddy-xp-gain';
    gain.textContent = `+${amount} XP`;
    xpSection.style.position = 'relative';
    xpSection.appendChild(gain);
    setTimeout(() => gain.remove(), 1300);
  }

  _calcLevel(xp) {
    if (xp >= 300) return 3;
    if (xp >= 100) return 2;
    return 1;
  }

  _xpForNextLevel() {
    if (this.level === 1) return 100;
    if (this.level === 2) return 200;
    return 999;
  }

  _xpInCurrentLevel() {
    if (this.level === 1) return this.xp;
    if (this.level === 2) return this.xp - 100;
    return this.xp - 300;
  }

  _pick(key) {
    const val = this.messages[key];
    if (!val) return null;
    if (Array.isArray(val)) return val[Math.floor(Math.random() * val.length)];
    return val;
  }

  _toggleCollapse() {
    if (!this._panel) return;
    const collapsed = this._panel.classList.toggle('buddy-collapsed');
    localStorage.setItem(this._storageKey, String(collapsed));
    const btn = this._panel.querySelector('.buddy-toggle-btn');
    if (btn) btn.textContent = collapsed ? '▴' : '▾';
  }

  _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.BuddyEngine = BuddyEngine;
