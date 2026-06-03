const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askGemini(prompt) {
  const result = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama3-8b-8192',
    max_tokens: 1000,
  });
  const text = result.choices[0]?.message?.content || '';
  return text.replace(/```json|```/g, '').trim();
}

module.exports = { askGemini };
