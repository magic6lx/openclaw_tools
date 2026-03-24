const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientSystemInfo = sequelize.define('ClientSystemInfo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '用户ID'
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
  platform: {
    type: DataTypes.STRING(50),
    comment: '平台：Win32, MacOS, Linux等'
  },
  userAgent: {
    type: DataTypes.STRING(500),
    comment: '浏览器User-Agent'
  },
  browserName: {
    type: DataTypes.STRING(100),
    comment: '浏览器名称'
  },
  browserVersion: {
    type: DataTypes.STRING(50),
    comment: '浏览器版本'
  },
  osName: {
    type: DataTypes.STRING(100),
    comment: '操作系统名称'
  },
  osVersion: {
    type: DataTypes.STRING(50),
    comment: '操作系统版本'
  },
  deviceType: {
    type: DataTypes.STRING(50),
    comment: '设备类型：desktop, mobile, tablet'
  },
  language: {
    type: DataTypes.STRING(20),
    comment: '浏览器语言'
  },
  screenResolution: {
    type: DataTypes.STRING(50),
    comment: '屏幕分辨率如1920x1080'
  },
  colorDepth: {
    type: DataTypes.INTEGER,
    comment: '颜色深度'
  },
  hardwareConcurrency: {
    type: DataTypes.INTEGER,
    comment: 'CPU核心数'
  },
  deviceMemory: {
    type: DataTypes.FLOAT,
    comment: '设备内存(GB)'
  },
  timezone: {
    type: DataTypes.STRING(50),
    comment: '时区'
  },
  timezoneOffset: {
    type: DataTypes.INTEGER,
    comment: '时区偏移量(分钟)'
  },
  cookieEnabled: {
    type: DataTypes.BOOLEAN,
    comment: 'Cookie是否启用'
  },
  doNotTrack: {
    type: DataTypes.STRING(20),
    comment: 'Do Not Track设置'
  },
  javaEnabled: {
    type: DataTypes.BOOLEAN,
    comment: 'Java是否启用'
  },
  plugins: {
    type: DataTypes.TEXT,
    comment: '浏览器插件列表(JSON)'
  },
  connectionType: {
    type: DataTypes.STRING(50),
    comment: '网络连接类型'
  },
  referrer: {
    type: DataTypes.STRING(500),
    comment: '来源页面'
  },
  currentUrl: {
    type: DataTypes.STRING(500),
    comment: '当前页面URL'
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    comment: '最后心跳时间'
  }
}, {
  tableName: 'client_system_info',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['invitation_code'] },
    { fields: ['device_id'] },
    { fields: ['lastHeartbeat'] }
  ]
});

module.exports = ClientSystemInfo;