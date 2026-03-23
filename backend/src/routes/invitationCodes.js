const express = require('express');
const router = express.Router();
const invitationCodeController = require('../controllers/InvitationCodeController');

/**
 * @swagger
 * /api/invitation-codes:
 *   get:
 *     summary: 获取邀请码列表
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 邀请码列表
 */
router.get('/', invitationCodeController.getAll.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/generate:
 *   post:
 *     summary: 生成邀请码
 *     tags: [InvitationCodes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               max_devices:
 *                 type: integer
 *                 default: 3
 *               tokens_limit:
 *                 type: integer
 *                 default: 50000
 *                 description: token使用上限，默认5W
 *               expires_in_months:
 *                 type: integer
 *                 default: 3
 *                 description: 过期时间（月），默认3个月
 *               api_key:
 *                 type: string
 *                 description: API密钥，用于共享token
 *     responses:
 *       201:
 *         description: 邀请码生成成功
 */
router.post('/generate', invitationCodeController.generate.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/validate:
 *   get:
 *     summary: 验证邀请码
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.get('/:code/validate', invitationCodeController.validate.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/bind:
 *   post:
 *     summary: 绑定设备
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *             properties:
 *               device_id:
 *                 type: string
 *               device_info:
 *                 type: object
 *     responses:
 *       201:
 *         description: 设备绑定成功
 */
router.post('/:code/bind', invitationCodeController.bindDevice.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/devices/{userId}:
 *   delete:
 *     summary: 解绑设备
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 设备解绑成功
 */
router.delete('/devices/:userId', invitationCodeController.unbindDevice.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/disable:
 *   put:
 *     summary: 禁用邀请码
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 邀请码已禁用
 */
router.put('/:code/disable', invitationCodeController.disableCode.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/enable:
 *   put:
 *     summary: 启用邀请码
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 邀请码已启用
 */
router.put('/:code/enable', invitationCodeController.enableCode.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/devices:
 *   get:
 *     summary: 获取邀请码绑定的设备列表
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 设备列表
 */
router.get('/:code/devices', invitationCodeController.getDevices.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/devices/{userId}/status:
 *   get:
 *     summary: 获取设备状态
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 设备状态
 */
router.get('/devices/:userId/status', invitationCodeController.getDeviceStatus.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/tokens:
 *   put:
 *     summary: 更新token限制
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens_limit
 *             properties:
 *               tokens_limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: token限制更新成功
 */
router.put('/:code/tokens', invitationCodeController.updateTokens.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/expiry:
 *   put:
 *     summary: 更新过期时间
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - expires_in_months
 *             properties:
 *               expires_in_months:
 *                 type: integer
 *                 description: 过期时间（月）
 *     responses:
 *       200:
 *         description: 过期时间更新成功
 */
router.put('/:code/expiry', invitationCodeController.updateExpiry.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/consume:
 *   post:
 *     summary: 消耗token
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tokens
 *             properties:
 *               tokens:
 *                 type: integer
 *                 description: 要消耗的token数量
 *     responses:
 *       200:
 *         description: token消耗成功
 */
router.post('/:code/consume', invitationCodeController.consumeTokens.bind(invitationCodeController));

/**
 * @swagger
 * /api/invitation-codes/{code}/config:
 *   get:
 *     summary: 通过邀请码获取API配置
 *     tags: [InvitationCodes]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API配置信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     proxy_url:
 *                       type: string
 *                     api_key_id:
 *                       type: string
 *                     api_secret_key:
 *                       type: string
 *                     tokens_limit:
 *                       type: integer
 *                     tokens_used:
 *                       type: integer
 *                     requests_limit:
 *                       type: integer
 *                     requests_used:
 *                       type: integer
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 */
router.get('/:code/config', invitationCodeController.getConfigByCode.bind(invitationCodeController));

module.exports = router;