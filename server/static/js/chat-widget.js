/* chat-widget.js — Chat panel with JSONL polling */

class ChatWidget {
  constructor(sessionId, config = {}) {
    this.sessionId = sessionId;
    this.pollInterval = config.pollInterval || 2000;
    this.apiBase = config.apiBase || '';
    this.lastTimestamp = null;
    this.polling = false;
    this._pollTimer = null;
    this.unreadCount = 0;
    this.isOpen = false;
    this._waiting = false;
    this._panel = null;
    this._messagesEl = null;
    this._inputEl = null;
    this._init();
  }

  _init() {
    const container = document.getElementById('chat-widget') || document.body;
    this._panel = document.createElement('div');
    this._panel.className = 'chat-widget';
    this._panel.innerHTML = this._buildHTML();
    container.appendChild(this._panel);

    this._messagesEl = this._panel.querySelector('.chat-messages');
    this._inputEl = this._panel.querySelector('.chat-input');
    const sendBtn = this._panel.querySelector('.chat-send-btn');
    const toggleBtn = this._panel.querySelector('.chat-toggle-btn');

    sendBtn.addEventListener('click', () => this._handleSend());
    this._inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
    });
    toggleBtn.addEventListener('click', () => this._toggle());

    this._injectStyles();
  }

  _buildHTML() {
    return `
      <div class="chat-toggle-btn" title="Toggle chat">
        <span class="chat-icon">💬</span>
        <span class="chat-unread" style="display:none">0</span>
      </div>
      <div class="chat-panel" style="display:none">
        <div class="chat-header">
          <span class="chat-header-title">Ask your teacher</span>
          <button class="chat-close-btn" aria-label="Close">✕</button>
        </div>
        <div class="chat-messages"></div>
        <div class="chat-footer">
          <textarea class="chat-input" placeholder="Ask a question..." rows="2"></textarea>
          <button class="chat-send-btn">Send</button>
        </div>
      </div>
    `;
  }

  _injectStyles() {
    if (document.getElementById('chat-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'chat-widget-styles';
    style.textContent = `
      .chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 1000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .chat-toggle-btn { width: 56px; height: 56px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(37,99,235,0.35); font-size: 1.4rem; position: relative; user-select: none; transition: transform 0.15s ease; }
      .chat-toggle-btn:hover { transform: scale(1.07); }
      .chat-unread { position: absolute; top: -4px; right: -4px; background: #dc2626; color: #fff; border-radius: 99px; font-size: 0.7rem; font-weight: 700; padding: 1px 6px; min-width: 18px; text-align: center; }
      .chat-panel { position: absolute; bottom: 68px; right: 0; width: 320px; background: #fff; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e5e7eb; animation: chatSlideUp 0.25s ease; }
      @keyframes chatSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      .chat-header { background: #2563eb; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
      .chat-header-title { color: #fff; font-weight: 600; font-size: 0.9rem; }
      .chat-close-btn { background: rgba(255,255,255,0.2); border: none; color: #fff; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
      .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 240px; max-height: 360px; }
      .chat-msg { max-width: 85%; padding: 9px 13px; border-radius: 12px; font-size: 0.875rem; line-height: 1.5; word-break: break-word; }
      .chat-msg.user { align-self: flex-end; background: #2563eb; color: #fff; border-bottom-right-radius: 4px; }
      .chat-msg.teacher { align-self: flex-start; background: #f3f4f6; color: #374151; border-bottom-left-radius: 4px; }
      .chat-msg.thinking { align-self: flex-start; background: #f3f4f6; color: #9ca3af; font-style: italic; font-size: 0.82rem; }
      .chat-footer { border-top: 1px solid #e5e7eb; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-end; }
      .chat-input { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; font-size: 0.875rem; font-family: inherit; resize: none; outline: none; line-height: 1.4; transition: border-color 0.15s ease; }
      .chat-input:focus { border-color: #2563eb; }
      .chat-send-btn { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease; white-space: nowrap; }
      .chat-send-btn:hover { background: #1d4ed8; }
      .chat-send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      @media (max-width: 480px) { .chat-panel { width: 290px; right: -8px; } }
    `;
    document.head.appendChild(style);

    const closeBtn = this._panel.querySelector('.chat-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this._toggle());
  }

  _toggle() {
    const chatPanel = this._panel.querySelector('.chat-panel');
    this.isOpen = !this.isOpen;
    chatPanel.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) {
      this.unreadCount = 0;
      this._updateUnread();
      this._scrollToBottom();
      this._inputEl.focus();
    }
  }

  _updateUnread() {
    const badge = this._panel.querySelector('.chat-unread');
    if (!badge) return;
    if (this.unreadCount > 0 && !this.isOpen) {
      badge.style.display = 'block';
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
    } else {
      badge.style.display = 'none';
    }
  }

  _addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${type}`;
    msg.innerHTML = type === 'teacher' ? this._renderMarkdown(text) : this._escapeHtml(text);
    if (this._messagesEl) {
      this._messagesEl.appendChild(msg);
      this._scrollToBottom();
    }
    return msg;
  }

  _scrollToBottom() {
    if (this._messagesEl) {
      this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    }
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _renderMarkdown(text) {
    return this._escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</code>')
      .replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }

  async _handleSend() {
    const text = this._inputEl.value.trim();
    if (!text) return;
    this._inputEl.value = '';
    this.send(text);
  }

  async send(message) {
    this._addMessage(message, 'user');
    if (!this.isOpen) { this.unreadCount++; this._updateUnread(); }

    const sendBtn = this._panel.querySelector('.chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    const thinkingMsg = this._addMessage('Teacher is thinking...', 'thinking');

    try {
      const res = await fetch(`${this.apiBase}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, message })
      });
      if (!res.ok) throw new Error('Send failed');
    } catch (err) {
      console.error('Chat send error:', err);
      if (thinkingMsg && thinkingMsg.parentNode) thinkingMsg.remove();
      this._addMessage('Failed to send message. Please try again.', 'thinking');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  startPolling() {
    if (this.polling) return;
    this.polling = true;
    this._poll();
  }

  async _poll() {
    if (!this.polling) return;
    try {
      const url = `${this.apiBase}/api/chat/response/${this.sessionId}` +
        (this.lastTimestamp ? `?since=${encodeURIComponent(this.lastTimestamp)}` : '');
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.messages && data.messages.length > 0) {
          data.messages.forEach(m => {
            this._removeThinking();
            const msgEl = this._addMessage(m.text, 'teacher');
            this.lastTimestamp = m.timestamp || new Date().toISOString();
            if (!this.isOpen) { this.unreadCount++; this._updateUnread(); }
            document.dispatchEvent(new CustomEvent('chat-message-received', {
              detail: { message: m.text, element: msgEl }
            }));
          });
        }
      }
    } catch (err) {
      // silent poll failure
    }
    this._pollTimer = setTimeout(() => this._poll(), this.pollInterval);
  }

  _removeThinking() {
    if (!this._messagesEl) return;
    this._messagesEl.querySelectorAll('.chat-msg.thinking').forEach(el => el.remove());
  }

  stop() {
    this.polling = false;
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
  }
}

window.ChatWidget = ChatWidget;
