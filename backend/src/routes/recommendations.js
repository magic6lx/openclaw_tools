const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/RecommendationController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * /api/recommendations:
 *   post:
 *     summary: 获取智能推荐配置
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               os_type:
 *                 type: string
 *                 example: Windows
 *               os_version:
 *                 type: string
 *                 example: 10.0.19041
 *               hardware_info:
 *                 type: object
 *                 properties:
 *                   cpu:
 *                     type: object
 *                     properties:
 *                       cores:
 *                         type: integer
 *                       frequency:
 *                         type: number
 *                   memory:
 *                     type: integer
 *                   storage:
 *                     type: integer
 *               network_info:
 *                 type: object
 *                 properties:
 *                   bandwidth:
 *                     type: number
 *                   latency:
 *                     type: integer
 *     responses:
 *       200:
 *         description: 推荐结果
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
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           recommendation_score:
 *                             type: number
 *                           match_reason:
 *                             type: string
 *                     environment_info:
 *                       type: object
 */
router.post('/', authMiddleware, recommendationController.getRecommendations.bind(recommendationController));

/**
 * @swagger
 * /api/recommendations/templates:
 *   get:
 *     summary: 获取推荐模版列表
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 推荐模版列表
 */
router.get('/templates', authMiddleware, recommendationController.getRecommendedTemplates.bind(recommendationController));

module.exports = router;