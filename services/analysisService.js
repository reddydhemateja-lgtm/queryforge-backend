const { askGemini } = require('./gemini');

async function analyzeDataFile(file) {
  const content = file.buffer.toString('utf-8');
  const ext = file.originalname.split('.').pop().toLowerCase();
  let rowCount = 0, columnCount = 0, columns = [], preview = '', parseError = null;

  if (ext === 'csv') {
    const lines = content.split('\n').filter(l => l.trim());
    rowCount = lines.length - 1;
    columns = lines[0] ? lines[0].split(',').map(c => c.trim().replace(/"/g, '')) : [];
    columnCount = columns.length;
    preview = lines.slice(0, 5).join('\n');
  } else if (ext === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        rowCount = parsed.length;
        columns = parsed[0] ? Object.keys(parsed[0]) : [];
        columnCount = columns.length;
        preview = JSON.stringify(parsed.slice(0, 3), null, 2);
      } else {
        columns = Object.keys(parsed);
        columnCount = columns.length;
        preview = JSON.stringify(parsed, null, 2).slice(0, 500);
      }
    } catch (e) { parseError = e.message; preview = content.slice(0, 500); }
  } else {
    preview = content.slice(0, 1000);
    rowCount = content.split('\n').length;
  }

  const text = await askGemini(`You are a data scientist. Analyze this ${ext.toUpperCase()} data file.

File: ${file.originalname}
Rows: ${rowCount}, Columns: ${columnCount}
Columns: ${columns.join(', ')}

Data preview:
${preview}

Respond ONLY in valid JSON (no markdown):
{
  "overview": "<what this dataset contains>",
  "dataQuality": {"score": <0-100>, "issues": ["<issue>"]},
  "columnInsights": [{"column": "<name>", "type": "<inferred type>", "notes": "<observation>"}],
  "patterns": ["<interesting pattern>"],
  "suggestedQueries": ["<useful SQL query>"],
  "cleaningSteps": ["<data cleaning recommendation>"],
  "useCases": ["<potential use case>"]
}`);

  let aiInsights = {};
  try { aiInsights = JSON.parse(text); }
  catch (e) { aiInsights = { overview: text }; }

  return { filename: file.originalname, format: ext, size: file.size, rowCount, columnCount, columns, parseError, preview: preview.slice(0, 500), ai: aiInsights, timestamp: new Date().toISOString() };
}

async function detectSchema(data, format) {
  const text = await askGemini(`Detect the schema from this ${format} data and generate a CREATE TABLE statement.

Data:
${data.slice(0, 2000)}

Respond ONLY in valid JSON (no markdown):
{
  "tableName": "<suggested table name>",
  "columns": [{"name": "<col>", "type": "<SQL type>", "nullable": true, "notes": "<observation>"}],
  "createStatement": "<full CREATE TABLE SQL>",
  "primaryKeyGuess": "<likely primary key>",
  "foreignKeyGuesses": ["<table.column relationships>"]
}`);

  let result = {};
  try { result = JSON.parse(text); }
  catch (e) { result = { createStatement: '', columns: [] }; }
  return result;
}

async function cleaningsuggestions(file) {
  const content = file.buffer.toString('utf-8').slice(0, 3000);
  const text = await askGemini(`Analyze this data for quality issues and provide cleaning recommendations.

Data from ${file.originalname}:
${content}

Respond ONLY in valid JSON (no markdown):
{
  "overallQuality": "excellent|good|fair|poor",
  "issues": [{"type": "<issue type>", "severity": "critical|major|minor", "description": "<what's wrong>", "affectedColumns": ["<col>"], "fix": "<how to fix>"}],
  "duplicateRisk": "none|low|medium|high",
  "missingDataPercent": <estimated %>,
  "sqlCleaningQueries": ["<SQL to clean this data>"],
  "priority": ["<most important fix first>"]
}`);

  let result = {};
  try { result = JSON.parse(text); }
  catch (e) { result = { overallQuality: 'unknown', issues: [] }; }
  return { filename: file.originalname, ...result };
}

module.exports = { analyzeDataFile, detectSchema, cleaningsuggestions };
