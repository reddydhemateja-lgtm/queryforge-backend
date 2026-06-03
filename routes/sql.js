const express = require('express');
const router = express.Router();
const { analyzeSQL, optimizeSQL, buildQueryFromNL } = require('../services/sqlService');

// Analyze SQL query - lint, parse, score
router.post('/analyze', async (req, res, next) => {
  try {
    const { query, dialect = 'MySQL' } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    const result = await analyzeSQL(query.trim(), dialect);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Optimize SQL query with AI
router.post('/optimize', async (req, res, next) => {
  try {
    const { query, dialect = 'MySQL', context = '' } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    const result = await optimizeSQL(query.trim(), dialect, context);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Natural language to SQL
router.post('/nl-to-sql', async (req, res, next) => {
  try {
    const { prompt, schema = '', dialect = 'MySQL' } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const result = await buildQueryFromNL(prompt.trim(), schema, dialect);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
