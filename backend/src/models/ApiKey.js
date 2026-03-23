const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ApiKey = sequelize.define('ApiKey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  secret_key: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  template_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'config_templates',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('temp', 'permanent'),
    defaultValue: 'temp'
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'revoked'),
    defaultValue: 'active'
  },
  max_requests: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  max_tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 10000
  },
  used_requests: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  used_tokens: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  allowed_models: {
    type: DataTypes.TEXT,
    defaultValue: '[]'
  },
  expires_at: {
    type: DataTypes.DATE
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'api_keys',
  timestamps: false
});

module.exports = ApiKey;
