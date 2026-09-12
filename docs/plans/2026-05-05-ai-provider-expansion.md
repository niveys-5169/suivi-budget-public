# AI Provider Expansion (OpenRouter & NVIDIA Build) Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the AI Assistant to support OpenRouter and NVIDIA Build (NIM) as providers, allowing users to choose from hundreds of models.

**Architecture:**

- Leverage the OpenAI-compatible nature of OpenRouter and NVIDIA Build.
- Update the settings UI to allow custom Model IDs and Base URLs.
- Consolidate OpenAI-compatible API calls into a single helper function.

**Tech Stack:** JavaScript (ESM), localStorage, standard Fetch API.

---

### Task 1: Update Constants and Storage Keys

**Files:**

- Modify: `public/src/finance-qa.js`

**Step 1: Add new storage keys and default models**

```javascript
// public/src/finance-qa.js

// Add after existing constants
const AI_MODEL_KEY = 'ai_model';
const AI_BASE_URL_KEY = 'ai_base_url';

const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
const NVIDIA_DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';
const NVIDIA_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
```

**Step 2: Commit**

```bash
git add public/src/finance-qa.js
git commit -m "chore: add constants for new AI providers"
```

---

### Task 2: Update Settings UI (HTML Injection)

**Files:**

- Modify: `public/src/finance-qa.js`

**Step 1: Update `initQAPanel` to include Model ID and Base URL fields**

Modify the `modal-ai-settings` innerHTML to add:

- `openrouter` and `nvidia` options in the provider select.
- A "Modèle (ID)" field.
- A "URL de base (Optionnel)" field.

```javascript
// public/src/finance-qa.js - Inside initQAPanel

// Update provider select options
// <option value="gemini">Google Gemini (Recommandé)</option>
// <option value="openai">OpenAI (GPT-4o-mini)</option>
// <option value="openrouter">OpenRouter (Claude, Llama, etc.)</option>
// <option value="nvidia">NVIDIA Build (NIM)</option>

// Add after API Key field
/*
<div id="ai-model-container" class="space-y-2">
  <label class="text-[10px] font-black uppercase tracking-widest text-zinc-500">Modèle (ID)</label>
  <input type="text" id="ai-model" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold" placeholder="ex: anthropic/claude-3.5-sonnet">
</div>

<div id="ai-base-url-container" class="space-y-2">
  <label class="text-[10px] font-black uppercase tracking-widest text-zinc-500">URL de base (Optionnel)</label>
  <input type="text" id="ai-base-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold" placeholder="https://...">
</div>
*/
```

**Step 2: Commit**

```bash
git add public/src/finance-qa.js
git commit -m "feat: add model and base url fields to AI settings"
```

---

### Task 3: Implement UI Logic (Visibility and Persistence)

**Files:**

- Modify: `public/src/finance-qa.js`

**Step 1: Update `updateAISettingsHint` to handle new providers and toggle visibility of fields**

```javascript
// public/src/finance-qa.js

export function updateAISettingsHint(provider) {
  const hint = document.getElementById('ai-key-hint');
  const modelContainer = document.getElementById('ai-model-container');
  const baseUrlContainer = document.getElementById('ai-base-url-container');

  if (!hint) return;

  // Show/Hide fields based on provider
  if (modelContainer) modelContainer.style.display = provider === 'gemini' ? 'none' : 'block';
  if (baseUrlContainer)
    baseUrlContainer.style.display =
      provider === 'nvidia' || provider === 'openai' ? 'block' : 'none';

  if (provider === 'gemini') {
    hint.innerHTML = '...'; // Keep existing Gemini hint
  } else if (provider === 'openrouter') {
    hint.innerHTML = 'Clé sur <strong>openrouter.ai</strong>. Accès à Claude, GPT-4, Llama 3, etc.';
  } else if (provider === 'nvidia') {
    hint.innerHTML = 'Clé sur <strong>build.nvidia.com</strong>. Modèles optimisés par NVIDIA.';
  } else {
    hint.innerHTML = '...'; // Keep existing OpenAI hint
  }
}
```

**Step 2: Update `openAISettings` and `saveAISettings`**

```javascript
export function openAISettings() {
  // ... existing code ...
  const model = localStorage.getItem(AI_MODEL_KEY) || '';
  const base = localStorage.getItem(AI_BASE_URL_KEY) || '';

  const modelInput = document.getElementById('ai-model');
  const baseInput = document.getElementById('ai-base-url');

  if (modelInput) modelInput.value = model;
  if (baseInput) baseInput.value = base;

  updateAISettingsHint(provider);
}

export function saveAISettings() {
  // ... existing code ...
  const model = document.getElementById('ai-model')?.value || '';
  const base = document.getElementById('ai-base-url')?.value || '';

  localStorage.setItem(AI_MODEL_KEY, model);
  localStorage.setItem(AI_BASE_URL_KEY, base);
  // ... rest of save logic ...
}
```

**Step 3: Commit**

```bash
git add public/src/finance-qa.js
git commit -m "feat: implement settings persistence for new AI fields"
```

---

### Task 4: Implement Multi-Provider API Call Logic

**Files:**

- Modify: `public/src/finance-qa.js`

**Step 1: Refactor `callOpenAI` into a generic `callOpenAICompatible` function**

```javascript
// public/src/finance-qa.js

async function callOpenAICompatible(
  apiKey,
  systemPrompt,
  conversationHistory,
  userQuestion,
  options = {},
) {
  const {
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini',
    extraHeaders = {},
  } = options;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: 'user', content: userQuestion });

  const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erreur API (${resp.status})`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Réponse vide de l'IA.");
  return text;
}
```

**Step 2: Update `sendQuestion` to use the new helper**

```javascript
// public/src/finance-qa.js

async function sendQuestion(userQuestion) {
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
  const apiKey = localStorage.getItem(AI_API_KEY_KEY) || '';
  const customModel = localStorage.getItem(AI_MODEL_KEY);
  const customBase = localStorage.getItem(AI_BASE_URL_KEY);

  // ... error checks ...

  if (provider === 'gemini') {
    return callGemini(apiKey, systemPrompt, recentHistory, userQuestion);
  }

  let options = {
    model: customModel,
    baseUrl: customBase,
  };

  if (provider === 'openrouter') {
    options.baseUrl = 'https://openrouter.ai/api/v1';
    options.model = customModel || OPENROUTER_DEFAULT_MODEL;
    options.extraHeaders = {
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Suivi Budget',
    };
  } else if (provider === 'nvidia') {
    options.baseUrl = customBase || NVIDIA_DEFAULT_BASE_URL;
    options.model = customModel || NVIDIA_DEFAULT_MODEL;
  } else if (provider === 'openai') {
    options.baseUrl = customBase || 'https://api.openai.com/v1';
    options.model = customModel || OPENAI_MODEL;
  }

  return callOpenAICompatible(apiKey, systemPrompt, recentHistory, userQuestion, options);
}
```

**Step 3: Commit**

```bash
git add public/src/finance-qa.js
git commit -m "feat: implement unified OpenAI-compatible API caller"
```

---

### Task 5: Validation

**Manual Test:**

1. Open the application and go to AI settings.
2. Select "OpenRouter".
3. Verify that the "Model ID" field appears and the "Base URL" field is hidden.
4. Input an OpenRouter API key and a model ID (e.g., `google/gemini-2.0-flash-001`).
5. Save and send a message.
6. Repeat for "NVIDIA Build" (verify Base URL field appearance).

**Final Commit:**

```bash
git commit --allow-empty -m "docs: AI provider expansion implementation complete"
```
