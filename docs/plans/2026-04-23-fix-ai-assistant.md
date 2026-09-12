# Fix AI Assistant UI Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the AI Assistant interface by injecting the required HTML and CSS.

**Architecture:**

1. Create a dedicated CSS file for the AI Assistant.
2. Update `finance-qa.js` to inject the chat interface into `#qa-root` and the settings modal into `#modal-root`.
3. Link the new CSS in `main.js`.

**Tech Stack:** JavaScript (ESM), CSS, HTML.

---

### Task 1: Create Finance QA CSS

**Files:**

- Create: `public/src/finance-qa.css`

**Step 1: Write the CSS for chat bubbles and layout**

```css
/* public/src/finance-qa.css */
#qa-interface {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 250px);
  max-width: 900px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 2rem;
  overflow: hidden;
}

#qa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qa-msg {
  display: flex;
  max-width: 85%;
}

.qa-msg-user {
  align-self: flex-end;
}

.qa-msg-assistant {
  align-self: flex-start;
}

.qa-bubble {
  padding: 14px 20px;
  border-radius: 1.5rem;
  font-size: 14px;
  line-height: 1.6;
  position: relative;
}

.qa-msg-user .qa-bubble {
  background: var(--gold);
  color: #000;
  border-bottom-right-radius: 0.4rem;
}

.qa-msg-assistant .qa-bubble {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 0.4rem;
}

.qa-input-area {
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  gap: 12px;
  align-items: center;
}

#qa-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  padding: 12px 16px;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

#qa-input:focus {
  border-color: var(--gold);
}

#qa-send-btn,
#qa-settings-btn {
  background: transparent;
  border: none;
  color: var(--gold);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

#qa-send-btn:hover:not(:disabled) {
  transform: scale(1.1);
}

#qa-send-btn:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.qa-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.qa-suggestion {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.8rem;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-soft);
  cursor: pointer;
  transition: all 0.2s;
}

.qa-suggestion:hover {
  background: rgba(212, 175, 55, 0.1);
  border-color: var(--gold);
  color: #fff;
}

.qa-typing-dots {
  display: flex;
  gap: 4px;
  padding: 10px 15px !important;
}

.qa-typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
  animation: qa-typing 1.4s infinite both;
}

.qa-typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.qa-typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes qa-typing {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
```

**Step 2: Commit**

```bash
git add public/src/finance-qa.css
git commit -m "feat: add AI Assistant styles"
```

### Task 2: Update finance-qa.js with UI injection

**Files:**

- Modify: `public/src/finance-qa.js`

**Step 1: Update `initQAPanel` to inject HTML**

Modify `public/src/finance-qa.js` to include the HTML injection logic.

**Step 2: Add AI Settings Modal injection**

Modify `public/src/finance-qa.js` to inject the modal into `#modal-root`.

**Step 3: Commit**

```bash
git add public/src/finance-qa.js
git commit -m "feat: implement UI injection for AI Assistant"
```

### Task 3: Integration in main.js

**Files:**

- Modify: `public/src/main.js`

**Step 1: Import the new CSS**

Add `import './finance-qa.css';` to `public/src/main.js`.

**Step 2: Commit**

```bash
git add public/src/main.js
git commit -m "feat: integrate AI Assistant CSS"
```
