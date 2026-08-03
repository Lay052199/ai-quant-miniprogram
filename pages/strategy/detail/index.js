const { findStrategyDetail } = require('../../../utils/strategy-detail')
const { startStrategyFlow } = require('../../../utils/strategy-flow')
const { touchRecentStrategyView } = require('../../../utils/storage')

Page({
  data: {
    strategy: findStrategyDetail('ma'),
    parameterRows: [],
    fallbackNotice: '',
    loading: false,
    errorMessage: ''
  },

  onLoad(options) {
    const strategy = findStrategyDetail(options && options.strategy)
    touchRecentStrategyView(strategy)
    const parameterRows = strategy.parameterDefinitions.map(item => ({
      ...item,
      value: strategy.defaultParams[item.key]
    }))
    this.setData({
      strategy,
      parameterRows,
      fallbackNotice: strategy.fallback ? '未识别该策略，已展示双均线策略。' : ''
    })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  openSection(e) {
    const page = e.currentTarget.dataset.page
    if (!page) return
    wx.navigateTo({
      url: '/pages/strategy/detail/' + page + '?strategy=' + this.data.strategy.key
    })
  },

  useStrategy() {
    return startStrategyFlow(this, this.data.strategy)
  }
})
