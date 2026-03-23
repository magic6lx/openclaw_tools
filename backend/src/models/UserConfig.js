const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserConfig = sequelize.define('UserConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  template_id: {
    type: DataTypes.INTEGER
  },
  config_content: {
    type: DataTypes.JSON,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING(50)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'user_configs',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['template_id'] },
    { fields: ['is_active'] }
  ]
});

module.exports = UserConfig;