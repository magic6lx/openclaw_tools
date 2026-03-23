const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvitationCode = sequelize.define('InvitationCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(11),
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    defaultValue: 'active'
  },
  max_devices: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  current_devices: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  tokens_used: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
    comment: '已使用的token数量'
  },
  tokens_limit: {
    type: DataTypes.BIGINT,
    defaultValue: 50000,
    comment: 'token使用上限，默认5W'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '过期时间，默认3个月'
  },
  api_key_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: '临时API密钥ID'
  },
  api_secret_key: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '临时API密钥Secret'
  },
  requests_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已使用的请求次数'
  },
  requests_limit: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: '请求次数上限'
  }
}, {
  tableName: 'invitation_codes',
  indexes: [
    { fields: ['code'] },
    { fields: ['status'] }
  ]
});

module.exports = InvitationCode;