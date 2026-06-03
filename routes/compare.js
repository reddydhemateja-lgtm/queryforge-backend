const express = require('express');
const router = express.Router();
const multer = require('multer');
const { compareFiles, getAIFileSummary } = require('../services/compareService');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['text/plain', 'text/csv', 'application/json',
      'application/sql', 'text/x-sql', 'application/octet-stream'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExt = ['txt', 'csv', 'json', 'sql', 'md', 'xml', 'yaml', 'yml', 'log'];
    if (allowedExt.includes(ext)) return cb(null, true);
    cb(new Error(`File type .${ext} not supported`));
  }
});

// Compare two uploaded files
router.post('/files', upload.fields([{ name: 'file1' }, { name: 'file2' }]), async (req, res, next) => {
  try {
    const { file1, file2 } = req.files || {};
    if (!file1 || !file2) {
      return res.status(400).json({ error: 'Both file1 and file2 are required' });
    }
    const mode = req.body.mode || 'line'; // line | word | char
    const result = await compareFiles(file1[0], file2[0], mode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Compare two text strings directly
router.post('/text', async (req, res, next) => {
  try {
    const { text1, text2, mode = 'line', name1 = 'File 1', name2 = 'File 2' } = req.body;
    if (!text1 || !text2) {
      return res.status(400).json({ error: 'Both text1 and text2 are required' });
    }
    const result = await compareFiles(
      { buffer: Buffer.from(text1), originalname: name1 },
      { buffer: Buffer.from(text2), originalname: name2 },
      mode
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI summary of diff
router.post('/ai-summary', async (req, res, next) => {
  try {
    const { diff, name1, name2 } = req.body;
    if (!diff) return res.status(400).json({ error: 'Diff data required' });
    const result = await getAIFileSummary(diff, name1, name2);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
