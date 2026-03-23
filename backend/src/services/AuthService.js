const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthService {
  generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'your_jwt_secret_key_here', {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    } catch (error) {
      throw new Error('Token无效或已过期');
    }
  }

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error('Token解码失败');
    }
  }
}

module.exports = new AuthService();