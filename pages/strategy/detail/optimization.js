const { runSensitivity } = require('../../../utils/api')
const {
  loadBacktestForm,
  loadLastStock,
  saveBacktestForm,
  saveSelectedStrategy,
  saveStrategyOptimization
} = require('../../../utils/storage')
const { findStrategyDetail } = require('../../../utils/strategy-detail')
const {
  buildStrategyPayload,
  hasCompleteBacktestContext,
  startStrategyFlow
} = require('../../../utils/strategy-flow')

function finiteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatPercent(value, signed) {
  const number = finiteNumber(value, null)
  if (number === null) return '--'
  return (signed && number > 0 ? '+' : '') + (number * 100).toFixed(2) + '%'
}

function buildRows(results, definitions) {
  const rows = (Array.isArray(results) ? results : []).map((item, index) => {
    const params = item.params || {}
    return {
      key: item.params_label || String(index),
      label: item.params_label || '组合 ' + (index + 1),
      params,
      parameterText: definitions.map(definition => (
        definition.label + ' ' + (params[definition.key] === undefined ? '--' : params[definition.key])
      )).join(' · '),
      totalReturn: finiteNumber(item.total_return, null),
      returnText: formatPercent(item.total_return, true),
      drawdownText: formatPercent(item.max_drawdown, false),
      sharpeText: finiteNumber(item.sharpe_ratio, null) === null ? '--' : Number(item.sharpe_ratio).toFixed(2),
      conclusion: item.conclusion || ''
    }
  })
  const maximum = rows.reduce((value, item) => Math.max(value, Math.abs(item.totalReturn || 0)), 0)
  return rows.map(item => ({
    ...item,
    barWidth: maximum ? Math.round(18 + Math.abs(item.totalReturn || 0) / maximum * 72) : 18
  }))
}

Page({
  data: {
    strategy: findStrategyDetail('ma'),
    currentParameters: [],
    state: 'idle',
    statusMessage: '需要完整的股票和回测区间后才能分析。',
    comparisonRows: [],
    best: null,
    loading: false,
    errorMessage: ''
  },

  onLoad(options) {
    const strategy = findStrategyDetail(options && options.strategy)
    const form = loadBacktestForm()
    const params = form && (form.strategyKey === strategy.key || form.strategyName === strategy.source.name)
      ? (form.strategyParams || strategy.defaultParams)
      : strategy.defaultParams
    const currentParameters = strategy.parameterDefinitions.map(item => ({
      ...item,
      value: params[item.key] === undefined ? '--' : params[item.key]
    }))
    this.setData({ strategy, currentParameters }, () => this.loadSensitivity())
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  goToBacktest() {
    saveSelectedStrategy(this.data.strategy.source)
    wx.switchTab({ url: '/pages/backtest/backtest' })
  },

  async loadSensitivity() {
    const context = { form: loadBacktestForm(), stock: loadLastStock() }
    if (!hasCompleteBacktestContext(context)) {
      this.setData({
        state: 'idle',
        statusMessage: '请先在回测页确认有效个股、日期和资金参数。'
      })
      return
    }
    this.setData({ state: 'loading', loading: true, errorMessage: '' })
    try {
      const payload = buildStrategyPayload(context, this.data.strategy)
      const data = await runSensitivity(payload)
      if (data.success === false) throw new Error(data.message || '参数分析未成功')
      const comparisonRows = buildRows(data.sensitivity_results, this.data.strategy.parameterDefinitions)
      const ranked = comparisonRows.filter(item => item.totalReturn !== null).sort((a, b) => b.totalReturn - a.totalReturn)
      const best = ranked.length ? ranked[0] : null
      const state = comparisonRows.length ? 'success' : 'empty'
      this.setData({
        state,
        comparisonRows,
        best,
        statusMessage: state === 'empty' ? '接口没有返回可用的参数组合。' : ''
      })
      saveStrategyOptimization({
        strategyKey: this.data.strategy.key,
        savedAt: new Date().toISOString(),
        results: data.sensitivity_results || [],
        summary: data.sensitivity_summary || null
      })
    } catch (error) {
      this.setData({
        state: 'error',
        errorMessage: error.message || '参数分析失败，请稍后重试',
        statusMessage: '真实行情或云端服务暂时不可用。'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyRecommendedParams() {
    const best = this.data.best
    if (!best || !best.params) {
      wx.showToast({ title: '暂无可用推荐', icon: 'none' })
      return
    }
    const form = loadBacktestForm() || {}
    const strategyParams = { ...(form.strategyParams || {}), ...best.params }
    saveBacktestForm({
      ...form,
      strategyKey: this.data.strategy.key,
      strategyName: this.data.strategy.source.name,
      strategyParams
    })
    saveSelectedStrategy({ ...this.data.strategy.source, defaultParams: strategyParams })
    this.setData({
      currentParameters: this.data.strategy.parameterDefinitions.map(item => ({
        ...item,
        value: strategyParams[item.key] === undefined ? '--' : strategyParams[item.key]
      }))
    })
    wx.showToast({ title: '推荐参数已应用', icon: 'success' })
  },

  useStrategy() {
    return startStrategyFlow(this, this.data.strategy)
  }
})

module.exports = { buildRows }
