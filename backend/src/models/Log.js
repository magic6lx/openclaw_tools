const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER
  },
  invitation_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '邀请码'
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '设备ID'
  },
  operation_stage: {
    type: DataTypes.ENUM('installation', 'configuration', 'runtime'),
    allowNull: false,
    defaultValue: 'runtime',
    comment: '操作阶段：安装过程、配置过程、运行过程'
  },
  level: {
    type: DataTypes.ENUM('debug', 'info', 'warn', 'error'),
    defaultValue: 'info'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'logs',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['invitation_code'] },
    { fields: ['device_id'] },
    { fields: ['operation_stage'] },
    { fields: ['level'] },
    { fields: ['created_at'] },
    { fields: ['created_at', 'operation_stage'] }
  ]
});

module.exports = Log;