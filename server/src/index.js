require('dotenv').config({ path: require('path').join(__dirname, '../../config/.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./routes/api');
const { testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', apiRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`OpenClaw Server running on port ${PORT}`);
  });
}

start().catch(console.error);
