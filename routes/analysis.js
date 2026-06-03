const express = require('express');
const router = express.Router();
const multer = require('multer');
const { analyzeDataFile, detectSchema, cleaningsuggestions } = require('../services/analysisService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Analyze uploaded data file (CSV/JSON) for insights
router.post('/data', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const result = await analyzeDataFile(req.file);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Detect schema from raw data
router.post('/schema', async (req, res, next) => {
  try {
    const { data, format = 'csv' } = req.body;
    if (!data) return res.status(400).json({ error: 'Data is required' });
    const result = await detectSchema(data, format);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI-powered data cleaning suggestions
router.post('/clean', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const result = await cleaningsuggestions(req.file);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
