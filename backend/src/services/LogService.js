const { Log } = require('../models');
const { Op } = require('sequelize');

class LogService {
  async createLog(userId, logData) {
    try {
      const { operation_stage, level, content, metadata, invitation_code, device_id } = logData;

      if (!this.validateOperationStage(operation_stage)) {
        throw new Error('无效的操作阶段');
      }

      if (level && !this.validateLogLevel(level)) {
        throw new Error('无效的日志级别');
      }

      const log = await Log.create({
        user_id: userId,
        invitation_code,
        device_id,
        operation_stage: operation_stage || 'runtime',
        level: level || 'info',
        content,
        metadata: metadata || {}
      });

      return log;
    } catch (error) {
      throw new Error(`创建日志失败: ${error.message}`);
    }
  }

  async batchCreateLogs(logs) {
    try {
      const validLogs = logs.map(log => {
        if (!this.validateOperationStage(log.operation_stage)) {
          log.operation_stage = 'runtime';
        }
        return log;
      });
      
      const createdLogs = await Log.bulkCreate(validLogs);
      return createdLogs;
    } catch (error) {
      throw new Error(`批量创建日志失败: ${error.message}`);
    }
  }

  async getUserLogs(userId, filters = {}) {
    try {
      const { operation_stage, level, page = 1, limit = 50, start_date, end_date, content } = filters;
      
      const where = { user_id: userId };
      
      if (operation_stage) where.operation_stage = operation_stage;
      if (level) where.level = level;
      if (content) where.content = { [Op.like]: `%${content}%` };
      
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at[Op.gte] = new Date(start_date);
        if (end_date) where.created_at[Op.lte] = new Date(end_date);
      }

      const { count, rows } = await Log.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']],
        attributes: [
          'id',
          'user_id',
          'invitation_code',
          'device_id',
          'operation_stage',
          'level',
          'content',
          'metadata',
          'created_at',
          'updated_at'
        ]
      });

      return {
        logs: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      };
    } catch (error) {
      throw new Error(`获取用户日志失败: ${error.message}`);
    }
  }

  async getLogStats(userId, filters = {}) {
    try {
      const { start_date, end_date } = filters;
      
      const where = { user_id: userId };
      
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at[Op.gte] = new Date(start_date);
        if (end_date) where.created_at[Op.lte] = new Date(end_date);
      }

      const totalLogs = await Log.count({ where });
      
      const logsByStage = await Log.findAll({
        where,
        attributes: ['operation_stage', [Log.sequelize.fn('COUNT', '*'), 'count']],
        group: ['operation_stage'],
        raw: true
      });

      const logsByLevel = await Log.findAll({
        where,
        attributes: ['level', [Log.sequelize.fn('COUNT', '*'), 'count']],
        group: ['level'],
        raw: true
      });

      const errorLogs = await Log.findAll({
        where: { ...where, level: 'error' },
        order: [['created_at', 'DESC']],
        limit: 10
      });

      return {
        total_logs: totalLogs,
        logs_by_stage: logsByStage,
        logs_by_level: logsByLevel,
        recent_errors: errorLogs
      };
    } catch (error) {
      throw new Error(`获取日志统计失败: ${error.message}`);
    }
  }

  async deleteLogs(userId, filters = {}) {
    try {
      const { operation_stage, level, before_date } = filters;
      
      const where = { user_id: userId };
      
      if (operation_stage) where.operation_stage = operation_stage;
      if (level) where.level = level;
      if (before_date) where.created_at = { [Op.lt]: new Date(before_date) };

      const deletedCount = await Log.destroy({ where });

      return { message: `成功删除 ${deletedCount} 条日志` };
    } catch (error) {
      throw new Error(`删除日志失败: ${error.message}`);
    }
  }

  async searchLogs(userId, query, filters = {}) {
    try {
      const { operation_stage, level, start_date, end_date } = filters;
      
      const where = {
        user_id: userId,
        content: { [Op.like]: `%${query}%` }
      };
      
      if (operation_stage) where.operation_stage = operation_stage;
      if (level) where.level = level;
      
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at[Op.gte] = new Date(start_date);
        if (end_date) where.created_at[Op.lte] = new Date(end_date);
      }

      const logs = await Log.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 100
      });

      return logs;
    } catch (error) {
      throw new Error(`搜索日志失败: ${error.message}`);
    }
  }

  async getRecentLogs(userId, limit = 20) {
    try {
      const logs = await Log.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });

      return logs;
    } catch (error) {
      throw new Error(`获取最近日志失败: ${error.message}`);
    }
  }

  validateOperationStage(operationStage) {
    const validStages = ['installation', 'configuration', 'runtime'];
    return validStages.includes(operationStage);
  }

  validateLogLevel(level) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    return validLevels.includes(level);
  }
}

module.exports = new LogService();