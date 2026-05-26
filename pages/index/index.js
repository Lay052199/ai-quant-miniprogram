// API_BASE_URL 统一放在文件顶部，便于后续切换到线上 HTTPS 地址。
// 当前为本地开发地址：http://127.0.0.1:8000
// 开发阶段如果使用本地 FastAPI 地址，需要在微信开发者工具中勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。
// 当前页面仅用于历史回测结果展示，不包含任何真实交易、下单、登录或支付功能。
const API_BASE_URL = 'http://127.0.0.1:8000';

Page({
  data: {
    symbol: '000001',
    startDate: '20200101',
    endDate: '20241231',
    strategyOptions: ['双均线策略', '动量策略', 'RSI策略'],
    strategyIndex: 0,
    initialCash: '100000',
    commissionRate: '0.0003',
    slippageRate: '0.0002',
    shortWindow: '5',
    longWindow: '20',
    loading: false,
    errorMessage: '',
    result: null
  },

  onInputSymbol: function (e) {
    this.setData({ symbol: e.detail.value.trim() });
  },

  onInputStartDate: function (e) {
    this.setData({ startDate: e.detail.value.trim() });
  },

  onInputEndDate: function (e) {
    this.setData({ endDate: e.detail.value.trim() });
  },

  onChangeStrategy: function (e) {
    this.setData({ strategyIndex: Number(e.detail.value) });
  },

  onInputInitialCash: function (e) {
    this.setData({ initialCash: e.detail.value.trim() });
  },

  onInputCommissionRate: function (e) {
    this.setData({ commissionRate: e.detail.value.trim() });
  },

  onInputSlippageRate: function (e) {
    this.setData({ slippageRate: e.detail.value.trim() });
  },

  onInputShortWindow: function (e) {
    this.setData({ shortWindow: e.detail.value.trim() });
  },

  onInputLongWindow: function (e) {
    this.setData({ longWindow: e.detail.value.trim() });
  },

  buildRequestPayload: function () {
    const strategy = this.data.strategyOptions[this.data.strategyIndex];
    const payload = {
      symbol: this.data.symbol || '000001',
      start_date: this.data.startDate || '20200101',
      end_date: this.data.endDate || '20241231',
      strategy: strategy,
      initial_cash: Number(this.data.initialCash || 100000),
      commission_rate: Number(this.data.commissionRate || 0.0003),
      slippage_rate: Number(this.data.slippageRate || 0.0002),
      strategy_params: {}
    };

    if (strategy === '双均线策略') {
      payload.strategy_params = {
        short_window: Number(this.data.shortWindow || 5),
        long_window: Number(this.data.longWindow || 20)
      };
    }

    return payload;
  },

  formatMetricValue: function (key, value) {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    if (['总收益率', '年化收益率', '最大回撤', '胜率', '基准收益率', '超额收益率', '年化波动率'].indexOf(key) > -1) {
      return (Number(value) * 100).toFixed(2) + '%';
    }

    if (key === '夏普比率') {
      return Number(value).toFixed(4);
    }

    if (key === '最终资产' || key === '初始资金') {
      return Number(value).toFixed(2);
    }

    return String(value);
  },

  buildMetricCards: function (metrics) {
    const targetKeys = ['总收益率', '年化收益率', '最大回撤', '夏普比率', '胜率', '交易次数', '最终资产'];
    return targetKeys.map((key) => {
      return {
        label: key,
        value: this.formatMetricValue(key, metrics[key])
      };
    });
  },

  startBacktest: function () {
    this.setData({
      loading: true,
      errorMessage: '',
      result: null
    });

    console.log('开始请求后端 health 接口：', API_BASE_URL + '/health');

    wx.request({
      url: API_BASE_URL + '/health',
      method: 'GET',
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        console.log('health 接口响应：', res);

        if (res.statusCode !== 200) {
          const detail = res.data && res.data.detail ? res.data.detail : 'health 接口返回异常。';
          this.setData({
            loading: false,
            errorMessage: detail
          });
          return;
        }

        wx.showToast({
          title: '后端连接成功',
          icon: 'success'
        });

        this.setData({
          loading: false,
          result: {
            metrics: {},
            metricCards: [],
            riskReport: [],
            report: 'health 接口测试成功，后端服务可访问。',
            trades: [],
            equityCurveCount: 0
          }
        });
      },
      fail: (err) => {
        console.error('health 接口请求失败：', err);

        const message = err && err.errMsg ? err.errMsg : 'health 接口请求失败。';
        this.setData({
          loading: false,
          errorMessage: message
        });

        wx.showToast({
          title: '请求失败',
          icon: 'none'
        });
      }
    });
  }
});
