const logService = require('../services/LogService');
const { authMiddleware } = require('../middleware/auth');

class LogController {
  async create(req, res) {
    try {
      const userId = req.user.userId;
      const logData = req.body;

      const log = await logService.createLog(userId, logData);
      res.status(201).json({
        success: true,
        data: log
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async batchCreate(req, res) {
    try {
      const userId = req.user.userId;
      const { logs } = req.body;

      if (!Array.isArray(logs)) {
        return res.status(400).json({
          success: false,
          message: 'logs必须是数组'
        });
      }

      const validLogs = logs.map(log => ({
        ...log,
        user_id: userId
      }));

      const createdLogs = await logService.batchCreateLogs(validLogs);
      res.status(201).json({
        success: true,
        data: createdLogs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getList(req, res) {
    try {
      const userId = req.user.userId;
      const filters = req.query;
      const result = await logService.getUserLogs(userId, filters);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getStats(req, res) {
    try {
      const userId = req.user.userId;
      const filters = req.query;
      const stats = await logService.getLogStats(userId, filters);
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const userId = req.user.userId;
      const filters = req.query;
      const result = await logService.deleteLogs(userId, filters);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async search(req, res) {
    try {
      const userId = req.user.userId;
      const { query } = req.params;
      const filters = req.query;
      const logs = await logService.searchLogs(userId, query, filters);
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getRecent(req, res) {
    try {
      const userId = req.user.userId;
      const { limit } = req.query;
      const logs = await logService.getRecentLogs(userId, limit);
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new LogController();