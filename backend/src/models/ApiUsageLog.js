const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ApiUsageLog = sequelize.define('ApiUsageLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  api_key_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'api_keys',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  endpoint: {
    type: DataTypes.STRING(255)
  },
  model: {
    type: DataTypes.STRING(100)
  },
  tokens_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  duration_ms: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('success', 'error'),
    defaultValue: 'success'
  },
  error_message: {
    type: DataTypes.TEXT
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_usage_logs',
  timestamps: false
});

module.exports = ApiUsageLog;
