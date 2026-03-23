class InvitationCodeGenerator {
  static generate(length = 11) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  static async generateUnique(InvitationCodeModel) {
    let code;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!isUnique && attempts < maxAttempts) {
      code = this.generate();
      const existing = await InvitationCodeModel.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('无法生成唯一的邀请码，请重试');
    }

    return code;
  }

  static validate(code) {
    if (!code) {
      return { valid: false, message: '邀请码不能为空' };
    }
    if (typeof code !== 'string') {
      return { valid: false, message: '邀请码格式错误' };
    }
    if (code.length !== 11) {
      return { valid: false, message: '邀请码长度必须为11位' };
    }
    if (!/^[A-Z]+$/.test(code)) {
      return { valid: false, message: '邀请码只能包含大写字母' };
    }
    return { valid: true, message: '格式正确' };
  }
}

module.exports = InvitationCodeGenerator;