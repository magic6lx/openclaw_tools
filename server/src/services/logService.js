const { query } = require('../db');

async function saveLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    let savedCount = 0;
    for (const log of logs) {
      const deviceId = log.deviceId || '';
      if (!deviceId) {
        continue;
      }
      await query(
        `INSERT INTO logs (device_id, level, source, message, client_timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [
          deviceId,
          log.level || 'info',
          log.source || '',
          log.message || '',
          log.timestamp ? new Date(log.timestamp) : null
        ]
      );
      savedCount++;
    }
    return { success: true, count: savedCount };
  } catch (err) {
    console.error('Save logs error:', err);
    throw err;
  }
}

async function getLogs(options = {}) {
  try {
    const { deviceId, level, source, startTime, endTime, limit = 100, offset = 0 } = options;

    let sql = 'SELECT l.*, i.code as invitation_code FROM logs l LEFT JOIN devices d ON l.device_id = d.device_id LEFT JOIN invitations i ON d.invitation_id = i.id WHERE 1=1';
    const params = [];

    if (deviceId) {
      sql += ' AND l.device_id = ?';
      params.push(deviceId);
    }
    if (level) {
      sql += ' AND l.level = ?';
      params.push(level);
    }
    if (source) {
      sql += ' AND l.source LIKE ?';
      params.push(`%${source}%`);
    }
    if (startTime) {
      sql += ' AND l.server_timestamp >= ?';
      params.push(new Date(startTime));
    }
    if (endTime) {
      sql += ' AND l.server_timestamp <= ?';
      params.push(new Date(endTime));
    }

    sql += ' ORDER BY l.server_timestamp DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);

    const logs = await query(sql, params);
    return logs;
  } catch (err) {
    console.error('Get logs error:', err);
    throw err;
  }
}

async function getLogsByDevice(deviceId, limit = 50) {
  try {
    const logs = await query(
      'SELECT * FROM logs WHERE device_id = ? ORDER BY server_timestamp DESC LIMIT ' + parseInt(limit),
      [deviceId]
    );
    return logs;
  } catch (err) {
    console.error('Get logs by device error:', err);
    throw err;
  }
}

async function getAllDevices() {
  try {
    const devices = await query(
      'SELECT d.*, i.code as invitation_code FROM devices d LEFT JOIN invitations i ON d.invitation_id = i.id ORDER BY d.last_seen DESC'
    );
    return devices;
  } catch (err) {
    console.error('Get all devices error:', err);
    throw err;
  }
}

async function deleteDeviceLogs(deviceId) {
  try {
    await query('DELETE FROM logs WHERE device_id = ?', [deviceId]);
    await query('DELETE FROM devices WHERE device_id = ?', [deviceId]);
    return { success: true };
  } catch (err) {
    console.error('Delete device logs error:', err);
    throw err;
  }
}

module.exports = {
  saveLogs,
  getLogs,
  getLogsByDevice,
  getAllDevices,
  deleteDeviceLogs
};
