const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: 获取所有用户
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
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
 *         description: 用户列表
 */
router.get('/', userController.getAllUsers.bind(userController));

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: 获取用户详情
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 用户详情
 */
router.get('/:id', userController.getUserById.bind(userController));

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: 更新用户状态
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
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
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: 用户状态更新成功
 */
router.put('/:id/status', userController.updateUserStatus.bind(userController));

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: 删除用户
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 用户删除成功
 */
router.delete('/:id', userController.deleteUser.bind(userController));

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: 获取用户统计
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: 用户统计数据
 */
router.get('/stats', userController.getUserStats.bind(userController));

/**
 * @swagger
 * /api/users/set-admin/{code}:
 *   post:
 *     summary: 设置邀请码用户为管理员
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 设置成功
 */
router.post('/set-admin/:code', userController.setAdminRole.bind(userController));

module.exports = router;