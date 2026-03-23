const express = require('express');
const router = express.Router();
const configValidatorController = require('../controllers/ConfigValidatorController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/config-validator/validate:
 *   post:
 *     summary: 验证配置
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *               options:
 *                 type: object
 *                 properties:
 *                   schema:
 *                     type: object
 *                   environment:
 *                     type: object
 *                   checkSecurity:
 *                     type: boolean
 *                     default: true
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/validate', authMiddleware, configValidatorController.validate.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/structure:
 *   post:
 *     summary: 验证配置结构
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/structure', authMiddleware, configValidatorController.validateStructure.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/fields:
 *   post:
 *     summary: 验证配置字段
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *               schema:
 *                 type: object
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/fields', authMiddleware, configValidatorController.validateFields.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/values:
 *   post:
 *     summary: 验证配置值
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/values', authMiddleware, configValidatorController.validateValues.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/compatibility:
 *   post:
 *     summary: 验证配置兼容性
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *               environment:
 *                 type: object
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/compatibility', authMiddleware, configValidatorController.validateCompatibility.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/security:
 *   post:
 *     summary: 验证配置安全性
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: 验证结果
 */
router.post('/security', authMiddleware, configValidatorController.validateSecurity.bind(configValidatorController));

/**
 * @swagger
 * /api/config-validator/schema:
 *   get:
 *     summary: 获取默认配置Schema
 *     tags: [ConfigValidator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schema定义
 */
router.get('/schema', authMiddleware, configValidatorController.getDefaultSchema.bind(configValidatorController));

module.exports = router;