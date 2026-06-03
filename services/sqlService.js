const { Parser } = require('node-sql-parser');
const { askGemini } = require('./gemini');

const parser = new Parser();

async function analyzeSQL(query, dialect) {
  let parseResult = { valid: true, ast: null, parseError: null };
  try {
    const ast = parser.astify(query);
    parseResult.ast = ast;
  } catch (e) {
    parseResult.valid = false;
    parseResult.parseError = e.message;
  }

  const queryType = detectQueryType(query);
  const complexity = estimateComplexity(query);
  const issues = staticLint(query);

  const text = await askGemini(`You are a senior SQL expert. Analyze this ${dialect} SQL query and respond ONLY in valid JSON with no markdown.

Query:
${query}

Respond with this exact JSON structure:
{
  "score": <integer 0-100>,
  "summary": "<one sentence summary>",
  "issues": [{"severity": "error|warning|info", "message": "<issue>", "suggestion": "<fix>"}],
  "performance": {"rating": "excellent|good|fair|poor", "notes": "<performance notes>"},
  "security": {"safe": true|false, "risks": ["<risk>"]},
  "bestPractices": ["<tip>"],
  "explanation": "<plain English explanation of what this query does>"
}`);

  let aiAnalysis = {};
  try { aiAnalysis = JSON.parse(text); }
  catch (e) { aiAnalysis = { score: 50, summary: 'Analysis complete', issues: [], explanation: text }; }

  return { query, dialect, queryType, complexity, parseResult, staticIssues: issues, ai: aiAnalysis, timestamp: new Date().toISOString() };
}

async function optimizeSQL(query, dialect, context) {
  const text = await askGemini(`You are a SQL optimization expert. Optimize this ${dialect} query for best performance.
${context ? `Context: ${context}` : ''}

Original query:
${query}

Respond ONLY in valid JSON (no markdown):
{
  "optimizedQuery": "<the optimized SQL>",
  "changes": [{"type": "<change type>", "description": "<what changed and why>"}],
  "expectedImprovement": "<expected performance gain>",
  "indexSuggestions": ["<CREATE INDEX ...>"],
  "explanation": "<overall optimization strategy>"
}`);

  let result = {};
  try { result = JSON.parse(text); }
  catch (e) { result = { optimizedQuery: query, changes: [], explanation: text }; }
  return result;
}

async function buildQueryFromNL(prompt, schema, dialect) {
  const text = await askGemini(`You are a SQL expert. Convert this natural language request to a ${dialect} SQL query.
${schema ? `Database schema:\n${schema}` : ''}

Request: "${prompt}"

Respond ONLY in valid JSON (no markdown):
{
  "query": "<the SQL query>",
  "explanation": "<plain English explanation>",
  "tables": ["<tables used>"],
  "assumptions": ["<any assumptions made>"],
  "alternatives": ["<alternative query approaches>"]
}`);

  let result = {};
  try { result = JSON.parse(text); }
  catch (e) { result = { query: '', explanation: text }; }
  return result;
}

function detectQueryType(query) {
  const q = query.trim().toUpperCase();
  if (q.startsWith('SELECT')) return 'SELECT';
  if (q.startsWith('INSERT')) return 'INSERT';
  if (q.startsWith('UPDATE')) return 'UPDATE';
  if (q.startsWith('DELETE')) return 'DELETE';
  if (q.startsWith('CREATE')) return 'CREATE';
  if (q.startsWith('ALTER'))  return 'ALTER';
  if (q.startsWith('DROP'))   return 'DROP';
  if (q.startsWith('WITH'))   return 'CTE';
  return 'UNKNOWN';
}

function estimateComplexity(query) {
  const q = query.toUpperCase();
  let score = 0;
  score += (q.match(/JOIN/g) || []).length * 2;
  score += (q.match(/GROUP BY/g) || []).length * 1;
  score += (q.match(/HAVING/g) || []).length * 1;
  score += (q.match(/UNION/g) || []).length * 2;
  score += (q.match(/WITH /g) || []).length * 2;
  score += Math.floor(query.length / 200);
  if (score <= 2) return 'Simple';
  if (score <= 6) return 'Moderate';
  if (score <= 12) return 'Complex';
  return 'Very Complex';
}

function staticLint(query) {
  const issues = [];
  const q = query.toUpperCase();
  if (q.includes('SELECT *')) issues.push({ severity: 'warning', message: 'Avoid SELECT * in production', suggestion: 'Specify column names explicitly' });
  if (q.includes('DELETE') && !q.includes('WHERE')) issues.push({ severity: 'error', message: 'DELETE without WHERE will delete all rows', suggestion: 'Add a WHERE clause' });
  if (q.includes('UPDATE') && !q.includes('WHERE')) issues.push({ severity: 'error', message: 'UPDATE without WHERE will update all rows', suggestion: 'Add a WHERE clause' });
  if (q.includes('DROP TABLE') && !q.includes('IF EXISTS')) issues.push({ severity: 'warning', message: 'DROP TABLE without IF EXISTS may cause errors', suggestion: 'Use DROP TABLE IF EXISTS' });
  if (!query.trim().endsWith(';')) issues.push({ severity: 'info', message: 'Query does not end with semicolon', suggestion: 'Add ; at the end' });
  return issues;
}

module.exports = { analyzeSQL, optimizeSQL, buildQueryFromNL };
