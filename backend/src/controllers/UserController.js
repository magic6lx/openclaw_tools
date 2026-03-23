const { User, InvitationCode } = require('../models');

class UserController {
  async getAllUsers(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      
      const where = {};
      if (status && status !== 'all') {
        where.status = status;
      }

      const { count, rows: users } = await User.findAndCountAll({
        where,
        include: [
          {
            model: InvitationCode,
            as: 'invitationCode',
            attributes: ['id', 'code', 'status', 'max_devices', 'current_devices'],
          },
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        include: [
          {
            model: InvitationCode,
            as: 'invitationCode',
          },
        ],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
        });
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
        });
      }

      await user.update({ status });

      res.json({
        success: true,
        data: { user },
        message: '用户状态更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
        });
      }

      const invitationCode = await InvitationCode.findByPk(user.invitation_code_id);
      if (invitationCode) {
        await invitationCode.update({
          current_devices: Math.max(0, invitationCode.current_devices - 1),
        });
      }

      await user.destroy();

      res.json({
        success: true,
        message: '用户删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getUserStats(req, res) {
    try {
      const totalUsers = await User.count();
      const activeUsers = await User.count({ where: { status: 'active' } });
      const inactiveUsers = await User.count({ where: { status: 'inactive' } });

      const usersByOS = await User.findAll({
        attributes: ['os_type'],
        group: ['os_type'],
        raw: true,
      });

      const osDistribution = {};
      usersByOS.forEach(item => {
        if (item.os_type) {
          osDistribution[item.os_type] = (osDistribution[item.os_type] || 0) + 1;
        }
      });

      res.json({
        success: true,
        data: {
          total_users: totalUsers,
          active_users: activeUsers,
          inactive_users: inactiveUsers,
          os_distribution: osDistribution,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async setAdminRole(req, res) {
    try {
      const { code } = req.params;

      const invitationCode = await InvitationCode.findOne({ where: { code } });
      if (!invitationCode) {
        return res.status(404).json({
          success: false,
          message: '邀请码不存在',
        });
      }

      const users = await User.findAll({
        where: { invitation_code_id: invitationCode.id }
      });

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: '该邀请码下没有用户',
        });
      }

      for (const user of users) {
        await user.update({ role: 'admin' });
      }

      res.json({
        success: true,
        message: `已将 ${users.length} 个用户设置为管理员`,
        data: { count: users.length }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new UserController();