const { findStrategyDetail } = require('../../../utils/strategy-detail')
const { findStrategyData } = require('../../../utils/strategyData')
const { startStrategyFlow } = require('../../../utils/strategy-flow')
const {
  loadLastResult,
  loadStrategyOptimization,
  touchRecentStrategyView,
} = require('../../../utils/storage')
const {
  buildSensitivityRows,
  buildTeachingPerformance,
} = require('../../../utils/strategy-analysis')

function teachingView(strategy) {
  return {
    ...findStrategyData(strategy.key),
    icon: strategy.icon,
  }
}

Page({
  data: {
    strategy: findStrategyDetail('ma'),
    teaching: teachingView(findStrategyDetail('ma')),
    performance: {},
    hasPerformance: false,
    sensitivityRows: [],
    loading: false,
    errorMessage: '',
  },

  onLoad(options) {
    const strategy = findStrategyDetail(options && options.strategy)
    touchRecentStrategyView(strategy)
    this.setData({
      strategy,
      teaching: teachingView(strategy),
    })
  },

  onReady() {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    })
  },

  onShow() {
    this.refreshRealData()
  },

  refreshRealData() {
    const performance = buildTeachingPerformance(loadLastResult(), this.data.teaching)
    const sensitivityRows = buildSensitivityRows(
      loadStrategyOptimization(),
      this.data.teaching
    )
    this.setData({
      performance: performance || {},
      hasPerformance: Boolean(performance),
      sensitivityRows,
    })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  useStrategy() {
    return startStrategyFlow(this, this.data.strategy)
  },
})

module.exports = { teachingView }
