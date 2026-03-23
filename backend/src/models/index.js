const User = require('./User');
const InvitationCode = require('./InvitationCode');
const ConfigTemplate = require('./ConfigTemplate');
const UserConfig = require('./UserConfig');
const Log = require('./Log');
const TemplateReview = require('./TemplateReview');
const ApiKey = require('./ApiKey');
const ApiUsageLog = require('./ApiUsageLog');

User.belongsTo(InvitationCode, { foreignKey: 'invitation_code_id', as: 'invitationCode' });
InvitationCode.hasMany(User, { foreignKey: 'invitation_code_id', as: 'users' });

UserConfig.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(UserConfig, { foreignKey: 'user_id', as: 'configs' });

UserConfig.belongsTo(ConfigTemplate, { foreignKey: 'template_id', as: 'template' });
ConfigTemplate.hasMany(UserConfig, { foreignKey: 'template_id', as: 'userConfigs' });

ConfigTemplate.belongsTo(ConfigTemplate, { foreignKey: 'parent_id', as: 'parent' });
ConfigTemplate.hasMany(ConfigTemplate, { foreignKey: 'parent_id', as: 'children' });

ConfigTemplate.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
ConfigTemplate.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

Log.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Log, { foreignKey: 'user_id', as: 'logs' });

TemplateReview.belongsTo(ConfigTemplate, { foreignKey: 'template_id', as: 'template' });
ConfigTemplate.hasMany(TemplateReview, { foreignKey: 'template_id', as: 'reviews' });

TemplateReview.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

// API密钥关联
ApiKey.belongsTo(ConfigTemplate, { foreignKey: 'template_id', as: 'template' });
ConfigTemplate.hasMany(ApiKey, { foreignKey: 'template_id', as: 'apiKeys' });

ApiUsageLog.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });
ApiKey.hasMany(ApiUsageLog, { foreignKey: 'api_key_id', as: 'usageLogs' });

module.exports = {
  User,
  InvitationCode,
  ConfigTemplate,
  UserConfig,
  Log,
  TemplateReview,
  ApiKey,
  ApiUsageLog
};