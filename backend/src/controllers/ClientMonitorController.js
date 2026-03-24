const ClientSystemInfo = require('../models/ClientSystemInfo');
const LogService = require('../services/LogService');

class ClientMonitorController {
  async submitClientInfo(req, res) {
    try {
      const clientData = req.body;
      const userId = req.user?.userId || null;
      const invitationCode = req.user?.invitationCode || null;
      const deviceId = req.user?.deviceId || clientData.deviceId || null;

      const updateData = {
        user_id: userId,
        invitation_code: invitationCode,
        device_id: deviceId,
        platform: clientData.platform,
        userAgent: clientData.userAgent,
        browserName: clientData.browserName,
        browserVersion: clientData.browserVersion,
        osName: clientData.osName,
        osVersion: clientData.osVersion,
        deviceType: clientData.deviceType,
        language: clientData.language,
        screenResolution: clientData.screenResolution,
        colorDepth: clientData.colorDepth,
        hardwareConcurrency: clientData.hardwareConcurrency,
        deviceMemory: clientData.deviceMemory,
        timezone: clientData.timezone,
        timezoneOffset: clientData.timezoneOffset,
        cookieEnabled: clientData.cookieEnabled,
        doNotTrack: clientData.doNotTrack,
        javaEnabled: clientData.javaEnabled,
        plugins: typeof clientData.plugins === 'object' ? JSON.stringify(clientData.plugins) : clientData.plugins,
        connectionType: clientData.connectionType,
        referrer: clientData.referrer,
        currentUrl: clientData.currentUrl,
        lastHeartbeat: new Date()
      };

      const [record, created] = await ClientSystemInfo.findOrCreate({
        where: { device_id: deviceId },
        defaults: updateData
      });

      if (!created) {
        await record.update(updateData);
      }

      await LogService.createLog(userId, {
        operation_stage: 'runtime',
        level: 'info',
        content: `客户端系统信息更新`,
        metadata: {
          deviceId,
          platform: clientData.platform,
          browserName: clientData.browserName,
          osName: clientData.osName
        },
        invitation_code: invitationCode,
        device_id: deviceId
      });

      res.json({
        success: true,
        message: '客户端信息已更新',
        data: {
          deviceId: record.device_id,
          lastHeartbeat: record.lastHeartbeat
        }
      });
    } catch (error) {
      console.error('提交客户端信息失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getClientInfoList(req, res) {
    try {
      const { page = 1, pageSize = 20, invitationCode, deviceId } = req.query;
      const where = {};

      if (invitationCode) {
        where.invitation_code = invitationCode;
      }
      if (deviceId) {
        where.device_id = deviceId;
      }

      const { count, rows } = await ClientSystemInfo.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize),
        order: [['lastHeartbeat', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          list: rows,
          total: count,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      });
    } catch (error) {
      console.error('获取客户端列表失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getClientDetail(req, res) {
    try {
      const { deviceId } = req.params;

      const record = await ClientSystemInfo.findOne({
        where: { device_id: deviceId }
      });

      if (!record) {
        return res.status(404).json({
          success: false,
          message: '设备不存在'
        });
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      console.error('获取客户端详情失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ClientMonitorController();