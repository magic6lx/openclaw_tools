const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'openclaw-secret-key';
const users = [{ id: 1, username: 'admin', password: 'admin123', role: 'admin' }];

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token无效' });
  }
}

function login(req, res) {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
}

function verify(req, res) {
  res.json({ success: true, user: req.user });
}

module.exports = { login, verify, authMiddleware, JWT_SECRET };
