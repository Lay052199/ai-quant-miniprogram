const { runBacktest } = require('./api')
const {
  loadBacktestForm,
  loadLastStock,
  saveLastResult,
  saveSelectedStrategy,
  touchRecentStrategyBacktest
} = require('./storage')

function hasCompleteBacktestContext(context) {
  const value = context || {}
  const form = value.form || {}
  const stock = value.stock
  return Boolean(
    stock &&
    stock.asset_type === 'stock' &&
    /^\d{6}$/.test(String(form.symbol || '')) &&
    String(stock.symbol) === String(form.symbol) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(form.startDate || '')) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(form.endDate || '')) &&
    Number(form.initialCash) > 0 &&
    Number(form.commissionRate) >= 0 &&
    Number(form.slippageRate) >= 0
  )
}

function numericParams(params) {
  return Object.keys(params || {}).reduce((result, key) => {
    const raw = params[key]
    result[key] = raw === '' ? raw : Number(raw)
    return result
  }, {})
}

function buildStrategyPayload(context, strategy) {
  const form = context.form
  const params = (form.strategyKey === strategy.key || form.strategyName === strategy.source.name)
    ? (form.strategyParams || strategy.defaultParams)
    : strategy.defaultParams
  return {
    symbol: String(form.symbol),
    start_date: String(form.startDate).replace(/-/g, ''),
    end_date: String(form.endDate).replace(/-/g, ''),
    strategy: strategy.source.name,
    initial_cash: Number(form.initialCash),
    commission_rate: Number(form.commissionRate),
    slippage_rate: Number(form.slippageRate),
    strategy_params: numericParams(params),
    demo_mode: false,
    allow_mock: true
  }
}

async function startStrategyFlow(page, strategy) {
  saveSelectedStrategy(strategy.source)
  const context = { form: loadBacktestForm(), stock: loadLastStock() }
  if (!hasCompleteBacktestContext(context)) {
    wx.showToast({ title: '请先补全股票和回测参数', icon: 'none' })
    wx.switchTab({ url: '/pages/backtest/backtest' })
    return { status: 'needs-input' }
  }

  const payload = buildStrategyPayload(context, strategy)
  if (page && page.setData) page.setData({ loading: true, errorMessage: '' })
  try {
    const data = await runBacktest(payload)
    if (data.success === false) throw new Error(data.message || '回测未成功')
    saveLastResult(data, payload, context.stock)
    touchRecentStrategyBacktest(strategy, data)
    wx.switchTab({ url: '/pages/results/results' })
    return { status: 'success', data }
  } catch (error) {
    const message = error.message || '回测失败，请稍后重试'
    if (page && page.setData) page.setData({ errorMessage: message })
    return { status: 'error', error }
  } finally {
    if (page && page.setData) page.setData({ loading: false })
  }
}

module.exports = {
  buildStrategyPayload,
  hasCompleteBacktestContext,
  startStrategyFlow
}
