/**
 * API代理路由
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// 延迟加载控制器，避免循环依赖问题
const getController = () => {
  return require('../controllers/ApiProxyController');
};

// 创建临时API密钥
router.post('/create-temp-key', authMiddleware, (req, res) => {
  getController().createTempKey(req, res);
});

// 代理API请求（不需要认证，使用密钥验证）
router.post('/proxy', (req, res) => {
  getController().proxyRequest(req, res);
});

// 获取密钥使用情况
router.get('/usage/:keyId', (req, res) => {
  getController().getUsageStats(req, res);
});

// 吊销API密钥
router.post('/revoke/:keyId', authMiddleware, (req, res) => {
  getController().revokeKey(req, res);
});

// 通过邀请码代理API请求（不需要认证，使用密钥验证）
router.post('/proxy-by-code', (req, res) => {
  getController().proxyRequestByInvitationCode(req, res);
});

// 获取邀请码API使用情况
router.get('/invitation-code-usage/:keyId', (req, res) => {
  getController().getInvitationCodeUsageStats(req, res);
});

module.exports = router;
