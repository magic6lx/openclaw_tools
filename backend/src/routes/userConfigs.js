const express = require('express');
const router = express.Router();
const userConfigController = require('../controllers/UserConfigController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/user-configs/apply/{templateId}:
 *   post:
 *     summary: 应用配置模版
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               custom_config:
 *                 type: object
 *     responses:
 *       201:
 *         description: 应用成功
 */
router.post('/apply/:templateId', authMiddleware, userConfigController.applyTemplate.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs:
 *   get:
 *     summary: 获取用户配置列表
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 配置列表
 */
router.get('/', authMiddleware, userConfigController.getList.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/active:
 *   get:
 *     summary: 获取当前激活的配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 当前配置
 */
router.get('/active', authMiddleware, userConfigController.getActive.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/{configId}:
 *   put:
 *     summary: 更新用户配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/:configId', authMiddleware, userConfigController.update.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/{configId}/activate:
 *   put:
 *     summary: 激活配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 激活成功
 */
router.put('/:configId/activate', authMiddleware, userConfigController.activate.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/{configId}:
 *   delete:
 *     summary: 删除用户配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/:configId', authMiddleware, userConfigController.delete.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/{configId}/export:
 *   get:
 *     summary: 导出配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 导出成功
 */
router.get('/:configId/export', authMiddleware, userConfigController.export.bind(userConfigController));

/**
 * @swagger
 * /api/user-configs/import:
 *   post:
 *     summary: 导入配置
 *     tags: [UserConfigs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config_content
 *             properties:
 *               config_content:
 *                 type: object
 *               template_name:
 *                 type: string
 *               version:
 *                 type: string
 *     responses:
 *       201:
 *         description: 导入成功
 */
router.post('/import', authMiddleware, userConfigController.import.bind(userConfigController));

module.exports = router;