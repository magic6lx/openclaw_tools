const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - device_id
 *             properties:
 *               code:
 *                 type: string
 *                 description: 邀请码
 *               device_id:
 *                 type: string
 *                 description: 设备ID
 *               device_info:
 *                 type: object
 *                 description: 设备信息
 *     responses:
 *       200:
 *         description: 登录成功
 *       401:
 *         description: 登录失败
 */
router.post('/login', authController.login.bind(authController));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: 获取当前用户信息
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 用户信息
 *       401:
 *         description: 未授权
 */
router.get('/me', authMiddleware, authController.getUserInfo.bind(authController));

/**
 * @swagger
 * /api/auth/me:
 *   put:
 *     summary: 更新用户信息
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 更新成功
 *       401:
 *         description: 未授权
 */
router.put('/me', authMiddleware, authController.updateUserInfo.bind(authController));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: 用户登出
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登出成功
 */
router.post('/logout', authMiddleware, authController.logout.bind(authController));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: 刷新Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token刷新成功
 *       401:
 *         description: Token无效
 */
router.post('/refresh', authController.refreshToken.bind(authController));

module.exports = router;