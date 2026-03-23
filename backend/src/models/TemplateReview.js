const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TemplateReview = sequelize.define('TemplateReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  template_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewer_id: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  comment: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'template_reviews',
  indexes: [
    { fields: ['template_id'] },
    { fields: ['reviewer_id'] },
    { fields: ['status'] }
  ]
});

module.exports = TemplateReview;