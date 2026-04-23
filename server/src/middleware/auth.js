const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'openclaw_jwt_secret_key_2024';

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

function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

async function login(req, res) {
  try {
    const { code, deviceId, deviceInfo } = req.body;

    if (!code) {
      return res.status(400).json({ error: '请输入邀请码' });
    }

    const invitations = await query(
      'SELECT * FROM invitations WHERE code = ?',
      [code.toUpperCase()]
    );

    if (invitations.length === 0) {
      return res.status(401).json({ error: '邀请码无效' });
    }

    const invitation = invitations[0];

    if (invitation.status !== 'active') {
      return res.status(401).json({ error: '邀请码已禁用' });
    }

    if (invitation.used_devices >= invitation.max_devices) {
      return res.status(401).json({ error: '邀请码设备数已满' });
    }

    await query(
      'UPDATE invitations SET used_devices = used_devices + 1 WHERE id = ?',
      [invitation.id]
    );

    if (deviceId && deviceInfo) {
      await query(
        `INSERT INTO devices (device_id, invitation_id, device_name, os_type, os_version)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_seen = CURRENT_TIMESTAMP`,
        [deviceId, invitation.id, deviceInfo.deviceName || '', deviceInfo.osType || '', deviceInfo.osVersion || '']
      );
    }

    const token = jwt.sign({
      id: invitation.id,
      code: invitation.code,
      role: invitation.role,
      deviceId: deviceId || null
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: invitation.id,
        code: invitation.code.slice(0, 4) + '****',
        role: invitation.role,
        remainingDevices: invitation.max_devices - invitation.used_devices - 1
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function getInvitations(req, res) {
  try {
    const invitations = await query('SELECT * FROM invitations ORDER BY created_at DESC');
    res.json({ success: true, data: invitations });
  } catch (err) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function createInvitation(req, res) {
  try {
    const { maxDevices, role } = req.body;
    const code = generateCode();
    await query(
      'INSERT INTO invitations (code, max_devices, used_devices, status, role) VALUES (?, ?, 0, "active", ?)',
      [code, maxDevices || 3, role || 'user']
    );
    const [invitation] = await query('SELECT * FROM invitations WHERE code = ?', [code]);
    res.json({ success: true, data: invitation });
  } catch (err) {
    console.error('Create invitation error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function updateInvitation(req, res) {
  try {
    const { id } = req.params;
    const { status, maxDevices } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (maxDevices) { updates.push('max_devices = ?'); params.push(maxDevices); }
    if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    params.push(id);
    await query(`UPDATE invitations SET ${updates.join(', ')} WHERE id = ?`, params);
    const [invitation] = await query('SELECT * FROM invitations WHERE id = ?', [id]);
    res.json({ success: true, data: invitation });
  } catch (err) {
    console.error('Update invitation error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function deleteInvitation(req, res) {
  try {
    const { id } = req.params;
    await query('DELETE FROM invitations WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete invitation error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  login,
  getInvitations,
  createInvitation,
  updateInvitation,
  deleteInvitation
};
