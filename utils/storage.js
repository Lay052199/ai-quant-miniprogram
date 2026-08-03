const KEYS = {
  strategy: 'quant:selected-strategy',
  result: 'quant:last-result',
  resultTime: 'quant:last-result-time',
  stock: 'quant:last-stock',
  recentStrategies: 'quant:recent-strategies',
  backtestForm: 'quant:backtest-form',
  strategyOptimization: 'quant:strategy-optimization'
}

function loadObject(key) {
  try {
    const value = wx.getStorageSync(key)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value
  } catch (error) {
    wx.removeStorageSync(key)
    return null
  }
}

function saveSelectedStrategy(strategy) {
  wx.setStorageSync(KEYS.strategy, strategy)
}

function loadSelectedStrategy() {
  return loadObject(KEYS.strategy)
}

function saveLastResult(result, payload, stock) {
  const savedAt = new Date().toISOString()
  wx.setStorageSync(KEYS.result, { result, payload, stock, savedAt })
  wx.setStorageSync(KEYS.resultTime, savedAt)
}

function loadLastResult() {
  return loadObject(KEYS.result)
}

function loadLastResultTime() {
  try {
    return wx.getStorageSync(KEYS.resultTime) || ''
  } catch (error) {
    return ''
  }
}

function saveLastStock(stock) {
  wx.setStorageSync(KEYS.stock, stock)
}

function loadLastStock() {
  return loadObject(KEYS.stock)
}

function saveBacktestForm(form) {
  wx.setStorageSync(KEYS.backtestForm, form && typeof form === 'object' ? form : {})
}

function loadBacktestForm() {
  return loadObject(KEYS.backtestForm)
}

function saveStrategyOptimization(value) {
  wx.setStorageSync(KEYS.strategyOptimization, value && typeof value === 'object' ? value : {})
}

function loadStrategyOptimization() {
  return loadObject(KEYS.strategyOptimization)
}

function loadRecentStrategies() {
  try {
    const value = wx.getStorageSync(KEYS.recentStrategies)
    if (value === '' || value === null || typeof value === 'undefined') return null
    return Array.isArray(value) ? value : null
  } catch (error) {
    return null
  }
}

function saveRecentStrategies(records) {
  wx.setStorageSync(KEYS.recentStrategies, Array.isArray(records) ? records : [])
}

function clearRecentStrategies() {
  wx.setStorageSync(KEYS.recentStrategies, [])
}

function currentClock(date) {
  const pad = value => String(value).padStart(2, '0')
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

function recentRecordFromDetail(detail, previous) {
  const now = new Date()
  const source = detail.source || {}
  return {
    ...(previous || {}),
    id: (previous && previous.id) || detail.key + '-recent',
    key: detail.key,
    sourceName: source.name || detail.name,
    name: detail.name,
    risk: detail.risk,
    riskTone: detail.riskTone,
    description: detail.summary,
    tags: (detail.tags || []).slice(0, 3),
    icon: detail.icon,
    groupKey: 'today',
    groupLabel: '今天',
    lastView: currentClock(now),
    lastBacktest: (previous && previous.lastBacktest) || '--',
    sortTime: now.getTime(),
    usageCount: Number((previous && previous.usageCount) || 0),
    returnValue: Number((previous && previous.returnValue) || 0),
    periods: ['all', 'today', 'week', 'month']
  }
}

function touchRecentStrategyView(detail) {
  if (!detail || !detail.key) return null
  const records = loadRecentStrategies() || []
  const previous = records.find(item => item.key === detail.key)
  const next = recentRecordFromDetail(detail, previous)
  saveRecentStrategies([next].concat(records.filter(item => item.key !== detail.key)).slice(0, 30))
  return next
}

function touchRecentStrategyBacktest(detail, result) {
  const viewed = touchRecentStrategyView(detail)
  if (!viewed) return null
  const records = loadRecentStrategies() || []
  const metrics = (result && result.metrics) || {}
  const totalReturn = Number(
    metrics['策略收益'] === undefined ? metrics['总收益率'] : metrics['策略收益']
  )
  const now = new Date()
  const updated = {
    ...viewed,
    lastBacktest: currentClock(now),
    usageCount: Number(viewed.usageCount || 0) + 1,
    returnValue: Number.isFinite(totalReturn) ? totalReturn : Number(viewed.returnValue || 0),
    sortTime: now.getTime()
  }
  saveRecentStrategies([updated].concat(records.filter(item => item.key !== detail.key)).slice(0, 30))
  return updated
}

module.exports = {
  KEYS,
  loadLastResult,
  loadLastResultTime,
  loadLastStock,
  loadBacktestForm,
  loadRecentStrategies,
  loadSelectedStrategy,
  loadStrategyOptimization,
  clearRecentStrategies,
  saveLastResult,
  saveLastStock,
  saveBacktestForm,
  saveRecentStrategies,
  saveSelectedStrategy,
  saveStrategyOptimization,
  touchRecentStrategyBacktest,
  touchRecentStrategyView
}
