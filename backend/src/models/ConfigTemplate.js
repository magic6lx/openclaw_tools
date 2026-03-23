const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConfigTemplate = sequelize.define('ConfigTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.STRING(100)
  },
  tags: {
    type: DataTypes.JSON
  },
  config_content: {
    type: DataTypes.JSON,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING(50),
    defaultValue: '1.0'
  },
  parent_id: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
    defaultValue: 'draft'
  },
  author_id: {
    type: DataTypes.INTEGER
  },
  reviewer_id: {
    type: DataTypes.INTEGER
  },
  review_comment: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'config_templates',
  indexes: [
    { fields: ['category'] },
    { fields: ['status'] },
    { fields: ['author_id'] },
    { fields: ['parent_id'] }
  ]
});

module.exports = ConfigTemplate;