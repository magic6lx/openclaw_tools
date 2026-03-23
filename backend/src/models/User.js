const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invitation_code_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  device_name: {
    type: DataTypes.STRING(255)
  },
  os_type: {
    type: DataTypes.STRING(50)
  },
  os_version: {
    type: DataTypes.STRING(50)
  },
  hardware_info: {
    type: DataTypes.TEXT
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  last_login_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['invitation_code_id'] },
    { fields: ['status'] },
    { fields: ['role'] }
  ]
});

module.exports = User;