/* completion.js — Session completion handler */

class CompletionHandler {
  constructor(sessionId, chapterId) {
    this.sessionId = sessionId;
    this.chapterId = chapterId;
    this.completed = false;
    this._container = null;
  }

  render(containerId) {
    this._container = document.getElementById(containerId);
    if (!this._container) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'text-align:center;padding:32px 20px;';

    const btn = document.createElement('button');
    btn.className = 'completion-btn';
    btn.innerHTML = '&#10003; I\'m done with this lesson';
    btn.addEventListener('click', () => this._onDoneClick(btn));
    this._btn = btn;

    wrapper.appendChild(btn);
    this._container.appendChild(wrapper);
  }

  _onDoneClick(btn) {
    if (this.completed) return;
    this._showConfirmDialog();
  }

  _showConfirmDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const box = document.createElement('div');
    box.className = 'dialog-box';
    box.innerHTML = `
      <h3>Finish this lesson?</h3>
      <p>Are you sure? The system will evaluate your progress and notify your teacher.</p>
      <div class="dialog-actions">
        <button class="btn-secondary" id="dialog-cancel">Not yet</button>
        <button class="completion-btn" id="dialog-confirm" style="margin:0">Yes, I'm done</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.querySelector('#dialog-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.querySelector('#dialog-confirm').addEventListener('click', () => {
      document.body.removeChild(overlay);
      this._complete();
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  async _complete() {
    this.completed = true;
    if (this._btn) {
      this._btn.disabled = true;
      this._btn.textContent = 'Submitting...';
    }

    try {
      await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, chapterId: this.chapterId })
      });
    } catch (err) {
      console.error('Completion error:', err);
    }

    this._showCompletionMessage();
    this._disableAll();

    document.dispatchEvent(new CustomEvent('session-completed', {
      detail: { sessionId: this.sessionId, chapterId: this.chapterId }
    }));
  }

  _showCompletionMessage() {
    if (!this._container) return;
    const msg = document.createElement('div');
    msg.className = 'completion-message';
    msg.innerHTML = `
      <strong>Session complete!</strong>
      Your teacher is reviewing your progress. Great work today!
    `;
    this._container.appendChild(msg);
  }

  _disableAll() {
    // Disable quiz inputs
    document.querySelectorAll('.quiz-section input, .quiz-section textarea, .quiz-submit-btn')
      .forEach(el => { el.disabled = true; });

    // Disable chat input
    document.querySelectorAll('.chat-input, .chat-send-btn')
      .forEach(el => { el.disabled = true; });

    // Hide buddy interactions
    const buddy = document.getElementById('buddy-panel');
    if (buddy) buddy.style.pointerEvents = 'none';
  }
}

window.CompletionHandler = CompletionHandler;
