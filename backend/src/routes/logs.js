const express = require('express');
const router = express.Router();
const logController = require('../controllers/LogController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: 创建日志
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - log_type
 *               - content
 *             properties:
 *               log_type:
 *                 type: string
 *                 enum: [operation, runtime, error, performance, session, channel, tool, model, config, security]
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 default: info
 *               content:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: 日志创建成功
 */
router.post('/', authMiddleware, logController.create.bind(logController));

/**
 * @swagger
 * /api/logs/batch:
 *   post:
 *     summary: 批量创建日志
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - logs
 *             properties:
 *               logs:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: 批量创建成功
 */
router.post('/batch', authMiddleware, logController.batchCreate.bind(logController));

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: 获取用户日志列表
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: log_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: 日志列表
 */
router.get('/', authMiddleware, logController.getList.bind(logController));

/**
 * @swagger
 * /api/logs/stats:
 *   get:
 *     summary: 获取日志统计
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: 统计数据
 */
router.get('/stats', authMiddleware, logController.getStats.bind(logController));

/**
 * @swagger
 * /api/logs/recent:
 *   get:
 *     summary: 获取最近日志
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 最近日志
 */
router.get('/recent', authMiddleware, logController.getRecent.bind(logController));

/**
 * @swagger
 * /api/logs/search/{query}:
 *   get:
 *     summary: 搜索日志
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: log_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 搜索结果
 */
router.get('/search/:query', authMiddleware, logController.search.bind(logController));

/**
 * @swagger
 * /api/logs:
 *   delete:
 *     summary: 删除日志
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: log_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *       - in: query
 *         name: before_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.delete('/', authMiddleware, logController.delete.bind(logController));

module.exports = router;