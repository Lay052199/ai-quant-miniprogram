App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d2gbzupit6360d77a',
      traceUser: true
    });

    // 当前小程序仅用于量化回测展示，不包含登录、支付或真实交易能力。
  }
});
