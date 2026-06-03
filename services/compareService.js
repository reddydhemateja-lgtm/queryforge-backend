const Diff = require('diff');
const { askGemini } = require('./gemini');

async function compareFiles(file1, file2, mode = 'line') {
  const text1 = file1.buffer.toString('utf-8');
  const text2 = file2.buffer.toString('utf-8');
  const name1 = file1.originalname || 'File 1';
  const name2 = file2.originalname || 'File 2';

  let diffResult;
  switch (mode) {
    case 'word': diffResult = Diff.diffWords(text1, text2); break;
    case 'char': diffResult = Diff.diffChars(text1, text2); break;
    case 'json':
      try { diffResult = Diff.diffJson(JSON.parse(text1), JSON.parse(text2)); }
      catch { diffResult = Diff.diffLines(text1, text2); }
      break;
    default: diffResult = Diff.diffLines(text1, text2);
  }

  const hunks = diffResult.map((part, idx) => ({
    id: idx,
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
    value: part.value,
    lines: part.count || part.value.split('\n').length,
  }));

  const added     = hunks.filter(h => h.type === 'added').reduce((a, h) => a + h.lines, 0);
  const removed   = hunks.filter(h => h.type === 'removed').reduce((a, h) => a + h.lines, 0);
  const unchanged = hunks.filter(h => h.type === 'unchanged').reduce((a, h) => a + h.lines, 0);
  const similarity = unchanged / Math.max(added + removed + unchanged, 1);

  return {
    name1, name2, mode,
    stats: {
      added, removed, unchanged,
      similarityPercent: Math.round(similarity * 100),
      totalLines1: text1.split('\n').length,
      totalLines2: text2.split('\n').length,
    },
    hunks,
    sideBySide: buildSideBySide(text1, text2),
    rawDiff: Diff.createPatch(name1, text1, text2, name1, name2),
    timestamp: new Date().toISOString(),
  };
}

function buildSideBySide(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const maxLen = Math.max(lines1.length, lines2.length);
  const result = [];
  for (let i = 0; i < maxLen; i++) {
    const l1 = lines1[i] !== undefined ? lines1[i] : null;
    const l2 = lines2[i] !== undefined ? lines2[i] : null;
    let status = 'unchanged';
    if (l1 === null) status = 'added';
    else if (l2 === null) status = 'removed';
    else if (l1 !== l2) status = 'modified';
    result.push({ lineNum: i + 1, left: l1, right: l2, status });
  }
  return result;
}

async function getAIFileSummary(diffData, name1, name2) {
  const text = await askGemini(`You are a data analyst. Summarize key differences between "${name1 || 'File 1'}" and "${name2 || 'File 2'}".

Diff stats: ${JSON.stringify(diffData.stats || diffData)}

Respond ONLY in valid JSON (no markdown):
{
  "summary": "<2-3 sentence overview>",
  "keyChanges": ["<change 1>", "<change 2>"],
  "impact": "low|medium|high",
  "recommendation": "<what the user should do next>",
  "patterns": ["<any patterns noticed>"]
}`);

  let result = {};
  try { result = JSON.parse(text); }
  catch (e) { result = { summary: text, keyChanges: [], impact: 'medium' }; }
  return result;
}

module.exports = { compareFiles, getAIFileSummary };
