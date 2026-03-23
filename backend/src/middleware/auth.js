const authService = require('../services/AuthService');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证Token'
      });
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token无效或已过期'
    });
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authMiddleware, optionalAuthMiddleware };