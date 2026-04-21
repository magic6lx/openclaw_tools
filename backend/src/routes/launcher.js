const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/changelog', (req, res) => {
  const changelogPath = path.join(__dirname, '../../openclaw-launcher/CHANGELOG.md');

  try {
    const content = fs.readFileSync(changelogPath, 'utf-8');

    const lines = content.split('\n');
    const versions = [];
    let currentVersion = null;

    for (const line of lines) {
      const versionMatch = line.match(/^## v?(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        currentVersion = {
          version: versionMatch[1],
          date: '',
          changes: []
        };
        versions.push(currentVersion);
      } else if (line.match(/^\(\d{4}-\d{2}-\d{2}\)/) && currentVersion) {
        currentVersion.date = line.match(/\((\d{4}-\d{2}-\d{2})\)/)[1];
      } else if (line.startsWith('### ') && currentVersion) {
        const type = line.replace('### ', '').trim().toLowerCase();
        currentVersion.changes.push({ type, items: [] });
      } else if (line.startsWith('- ') && currentVersion && currentVersion.changes.length > 0) {
        currentVersion.changes[currentVersion.changes.length - 1].items.push(line.replace('- ', ''));
      }
    }

    res.json({
      success: true,
      versions: versions.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to read changelog'
    });
  }
});

module.exports = router;
