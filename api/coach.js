const OPENAI_URL = 'https://api.openai.com/v1/responses';

const SYSTEM_PROMPT = `You are the AI Coach inside openGym, a strength and fitness tracking app.
Use only the training context provided by the app plus the user's message. Be concise, practical and specific.
Prioritize sustainable progression, good technique, recovery and adherence. Distinguish clearly between facts from the log and your interpretation.
The app already has a deterministic progression engine. Do not pretend you changed weights, routines or history. You may recommend changes, but say they are recommendations until the user explicitly applies them in the app.
If data is missing, say what is missing instead of inventing it. Do not diagnose injuries or medical conditions. If the user reports severe pain, neurological symptoms, chest pain, fainting or another urgent symptom, advise them to stop training and seek appropriate medical care.
Reply in the same language as the user's question unless they ask otherwise.`;

function outputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const c of item?.content || []) {
      if (c?.type === 'output_text' && c.text) parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}

export async function runCoach({ message, context, history = [] }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error('AI Coach is not configured on this server');
    err.status = 503;
    throw err;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const trimmedHistory = Array.isArray(history) ? history.slice(-8) : [];
  const input = [
    'TRAINING CONTEXT (JSON):',
    JSON.stringify(context || {}),
    '',
    'RECENT COACH CONVERSATION:',
    trimmedHistory.map(x => `${x?.role === 'assistant' ? 'Coach' : 'User'}: ${String(x?.text || '').slice(0, 3000)}`).join('\n') || '(none)',
    '',
    'USER QUESTION:',
    String(message || '').trim()
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT,
        input,
        max_output_tokens: 1200
      })
    });
  } catch (e) {
    const err = new Error(e?.name === 'AbortError' ? 'AI Coach timed out' : 'Could not reach OpenAI');
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
    err.status = response.status === 429 ? 429 : 502;
    throw err;
  }

  const text = outputText(data);
  if (!text) {
    const err = new Error('AI Coach returned an empty response');
    err.status = 502;
    throw err;
  }
  return { text, model, responseId: data.id || null };
}
