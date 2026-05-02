require('dotenv').config({ path: require('path').join(__dirname, '../../config/.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./routes/api');
const { testConnection, initSchema } = require('./db');

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
  await initSchema();
  app.listen(PORT, () => {
    console.log(`OpenClaw Server running on port ${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.warn('DB connection error (auto-recovered):', err.code);
  } else {
    console.error('Uncaught exception:', err);
  }
});

process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'ECONNRESET' || reason?.code === 'PROTOCOL_CONNECTION_LOST') {
    console.warn('DB connection rejection (auto-recovered):', reason.code);
  } else {
    console.error('Unhandled rejection:', reason);
  }
});

start().catch(console.error);
