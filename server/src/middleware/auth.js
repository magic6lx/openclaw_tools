const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'openclaw-secret-key';

const invitations = [
  { id: 1, code: 'ADMIN12345678', maxDevices: 10, usedDevices: 0, status: 'active', role: 'admin', createdAt: '2026-04-01' },
  { id: 2, code: 'USER98765432', maxDevices: 3, usedDevices: 1, status: 'active', role: 'user', createdAt: '2026-04-05' },
  { id: 3, code: 'TEST11111111', maxDevices: 1, usedDevices: 1, status: 'disabled', role: 'user', createdAt: '2026-04-10' },
];

let nextInvitationId = 4;

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
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: '请输入邀请码' });
  }

  const invitation = invitations.find(i => i.code === code.toUpperCase());
  
  if (!invitation) {
    return res.status(401).json({ error: '邀请码无效' });
  }
  
  if (invitation.status !== 'active') {
    return res.status(401).json({ error: '邀请码已禁用' });
  }
  
  if (invitation.usedDevices >= invitation.maxDevices) {
    return res.status(401).json({ error: '邀请码设备数已满' });
  }

  invitation.usedDevices++;
  
  const token = jwt.sign({ 
    id: invitation.id, 
    code: invitation.code, 
    role: invitation.role 
  }, JWT_SECRET, { expiresIn: '7d' });
  
  res.json({ 
    success: true, 
    token, 
    user: { 
      id: invitation.id, 
      code: invitation.code.slice(0, 4) + '****', 
      role: invitation.role,
      remainingDevices: invitation.maxDevices - invitation.usedDevices
    }
  });
}

function verify(req, res) {
  res.json({ success: true, user: req.user });
}

function getInvitations(req, res) {
  const list = invitations.map(i => ({
    code: i.code.slice(0, 4) + '****',
    maxDevices: i.maxDevices,
    usedDevices: i.usedDevices,
    status: i.status,
    role: i.role,
    createdAt: i.createdAt
  }));
  res.json({ success: true, invitations: list });
}

function createInvitation(req, res) {
  const { maxDevices = 3, role = 'user' } = req.body;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 11; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const newInvitation = {
    id: nextInvitationId++,
    code,
    maxDevices,
    usedDevices: 0,
    status: 'active',
    role,
    createdAt: new Date().toISOString().split('T')[0]
  };
  
  invitations.push(newInvitation);
  res.json({ success: true, invitation: newInvitation });
}

function toggleInvitation(req, res) {
  const { id } = req.params;
  const invitation = invitations.find(i => i.id === parseInt(id));
  if (!invitation) {
    return res.status(404).json({ error: '邀请码不存在' });
  }
  invitation.status = invitation.status === 'active' ? 'disabled' : 'active';
  res.json({ success: true, invitation });
}

function deleteInvitation(req, res) {
  const { id } = req.params;
  const index = invitations.findIndex(i => i.id === parseInt(id));
  if (index === -1) {
    return res.status(404).json({ error: '邀请码不存在' });
  }
  invitations.splice(index, 1);
  res.json({ success: true });
}

module.exports = { 
  login, 
  verify, 
  authMiddleware, 
  getInvitations,
  createInvitation,
  toggleInvitation,
  deleteInvitation,
  JWT_SECRET 
};
