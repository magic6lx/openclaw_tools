const clientMonitorService = {
  getClientSystemInfo: () => {
    return {
      platform: 'unknown',
      arch: 'unknown',
      osVersion: 'unknown',
      hostname: 'unknown',
    };
  },
};

export default clientMonitorService;