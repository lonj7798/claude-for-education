/* quiz-engine.js — Quiz renderer and submission */

class QuizEngine {
  constructor(quizData) {
    this.data = quizData || { questions: [] };
    this.answers = {};
    this.submitted = false;
    this.attempts = {};
  }

  render(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !this.data.questions || this.data.questions.length === 0) return;

    const section = document.createElement('div');
    section.className = 'quiz-section';
    section.innerHTML = `<h2>${this.data.title || 'Quiz'}</h2>`;

    this.data.questions.forEach((q, idx) => {
      const qEl = this._renderQuestion(q, idx);
      section.appendChild(qEl);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'quiz-submit-btn';
    submitBtn.textContent = 'Submit Quiz';
    submitBtn.addEventListener('click', () => this.submit());
    section.appendChild(submitBtn);
    this._submitBtn = submitBtn;

    this._resultsEl = document.createElement('div');
    this._resultsEl.className = 'quiz-results';
    this._resultsEl.style.display = 'none';
    section.appendChild(this._resultsEl);

    container.appendChild(section);
  }

  _renderQuestion(q, idx) {
    const wrapper = document.createElement('div');
    wrapper.className = 'quiz-question';
    wrapper.dataset.id = q.id || idx;

    const header = document.createElement('div');
    header.className = 'question-header';
    header.innerHTML = `<span class="question-number">${idx + 1}</span>`;

    const text = document.createElement('span');
    text.className = 'question-text';
    text.textContent = q.question;
    header.appendChild(text);
    wrapper.appendChild(header);

    let inputEl;
    switch (q.type) {
      case 'multiple_choice':
        inputEl = this._renderMultipleChoice(q, idx);
        break;
      case 'multiple_select':
        inputEl = this._renderMultipleSelect(q, idx);
        break;
      case 'free_text':
        inputEl = this._renderFreeText(q, idx);
        break;
      case 'code_input':
        inputEl = this._renderCodeInput(q, idx);
        break;
      case 'numeric_input':
        inputEl = this._renderNumericInput(q, idx);
        break;
      default:
        inputEl = this._renderFreeText(q, idx);
    }
    wrapper.appendChild(inputEl);

    if (q.hint) {
      const hint = document.createElement('div');
      hint.className = 'quiz-hint';
      hint.id = `hint-${idx}`;
      hint.textContent = `Hint: ${q.hint}`;
      wrapper.appendChild(hint);
    }

    return wrapper;
  }

  _renderMultipleChoice(q, idx) {
    const group = document.createElement('div');
    group.className = 'quiz-options';
    (q.options || []).forEach((opt, oi) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q_${idx}`;
      input.value = opt;
      input.addEventListener('change', () => {
        this.answers[idx] = opt;
        group.querySelectorAll('.quiz-option').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
      });
      const span = document.createElement('span');
      span.className = 'option-label';
      span.textContent = opt;
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    });
    return group;
  }

  _renderMultipleSelect(q, idx) {
    const group = document.createElement('div');
    group.className = 'quiz-options';
    this.answers[idx] = [];
    (q.options || []).forEach((opt, oi) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = opt;
      input.addEventListener('change', () => {
        if (input.checked) {
          this.answers[idx].push(opt);
          label.classList.add('selected');
        } else {
          this.answers[idx] = this.answers[idx].filter(v => v !== opt);
          label.classList.remove('selected');
        }
      });
      const span = document.createElement('span');
      span.className = 'option-label';
      span.textContent = opt;
      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);
    });
    return group;
  }

  _renderFreeText(q, idx) {
    const textarea = document.createElement('textarea');
    textarea.className = 'quiz-textarea';
    textarea.placeholder = 'Type your answer here...';
    textarea.rows = 4;
    textarea.addEventListener('input', () => { this.answers[idx] = textarea.value; });
    return textarea;
  }

  _renderCodeInput(q, idx) {
    const textarea = document.createElement('textarea');
    textarea.className = 'quiz-code-input';
    textarea.placeholder = '// Write your code here...';
    textarea.rows = 8;
    textarea.spellcheck = false;
    textarea.addEventListener('input', () => { this.answers[idx] = textarea.value; });
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        this.answers[idx] = textarea.value;
      }
    });
    return textarea;
  }

  _renderNumericInput(q, idx) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'quiz-number-input';
    input.placeholder = '0';
    if (q.step) input.step = q.step;
    input.addEventListener('input', () => { this.answers[idx] = parseFloat(input.value); });
    return input;
  }

  async submit() {
    if (this.submitted) return;
    this.submitted = true;
    this._submitBtn.disabled = true;
    this._submitBtn.textContent = 'Submitting...';

    const payload = {
      sessionId: window.__SESSION_ID__,
      chapterId: window.__CHAPTER_ID__,
      quizId: this.data.id || this.data.quizId,
      answers: this.data.questions.map((q, idx) => ({
        questionId: q.id || idx,
        answer: this.answers[idx] ?? null
      }))
    };

    let score = 0;
    let total = this.data.questions.length;

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result = await res.json();
        score = result.score ?? 0;
        total = result.total ?? total;
        this._showResults(score, total, result.feedback);
      } else {
        this._showResults(null, total, null);
      }
    } catch (err) {
      console.error('Quiz submit error:', err);
      this._showResults(null, total, null);
    }

    this._disableInputs();

    document.dispatchEvent(new CustomEvent('quiz-submitted', {
      detail: { score: total > 0 ? score / total : 0, raw: score, total }
    }));
  }

  _showResults(score, total, feedback) {
    this._resultsEl.style.display = 'block';
    if (score === null) {
      this._resultsEl.className = 'quiz-results mid';
      this._resultsEl.textContent = 'Submitted! Your teacher will review your answers.';
      return;
    }
    const pct = total > 0 ? score / total : 0;
    if (pct >= 0.8) {
      this._resultsEl.className = 'quiz-results high';
      this._resultsEl.textContent = `Great job! You scored ${score}/${total}. ${feedback || ''}`;
    } else if (pct >= 0.5) {
      this._resultsEl.className = 'quiz-results mid';
      this._resultsEl.textContent = `Good effort! You scored ${score}/${total}. ${feedback || 'Keep practicing!'}`;
    } else {
      this._resultsEl.className = 'quiz-results low';
      this._resultsEl.textContent = `You scored ${score}/${total}. ${feedback || "Don't worry — review the material and try again!"}`;
    }
  }

  _disableInputs() {
    const section = this._submitBtn.closest('.quiz-section');
    if (!section) return;
    section.querySelectorAll('input, textarea').forEach(el => { el.disabled = true; });
  }
}

window.QuizEngine = QuizEngine;
