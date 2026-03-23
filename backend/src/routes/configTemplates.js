const express = require('express');
const router = express.Router();
const configTemplateController = require('../controllers/ConfigTemplateController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/config-templates:
 *   post:
 *     summary: 创建配置模版
 *     tags: [ConfigTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - config_content
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               config_content:
 *                 type: object
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.post('/', authMiddleware, configTemplateController.create.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates:
 *   get:
 *     summary: 获取配置模版列表
 *     tags: [ConfigTemplates]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: author_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 模版列表
 */
router.get('/', configTemplateController.getList.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}:
 *   get:
 *     summary: 获取配置模版详情
 *     tags: [ConfigTemplates]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 模版详情
 */
router.get('/:templateId', configTemplateController.getOne.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}:
 *   put:
 *     summary: 更新配置模版
 *     tags: [ConfigTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
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
router.put('/:templateId', authMiddleware, configTemplateController.update.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}:
 *   delete:
 *     summary: 删除配置模版
 *     tags: [ConfigTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/:templateId', authMiddleware, configTemplateController.delete.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}/submit:
 *   post:
 *     summary: 提交模版审核
 *     tags: [ConfigTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 提交成功
 */
router.post('/:templateId/submit', authMiddleware, configTemplateController.submitReview.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}/review:
 *   post:
 *     summary: 审核模版
 *     tags: [ConfigTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: 审核完成
 */
router.post('/:templateId/review', authMiddleware, configTemplateController.review.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}/versions:
 *   get:
 *     summary: 获取模版版本历史
 *     tags: [ConfigTemplates]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 版本列表
 */
router.get('/:templateId/versions', configTemplateController.getVersions.bind(configTemplateController));

/**
 * @swagger
 * /api/config-templates/{templateId}/reviews:
 *   get:
 *     summary: 获取模版审核记录
 *     tags: [ConfigTemplates]
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 审核记录
 */
router.get('/:templateId/reviews', configTemplateController.getReviews.bind(configTemplateController));

module.exports = router;