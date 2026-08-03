const { findStrategyDetail } = require('./strategy-detail')

function finiteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function formatPercent(value, signed) {
  const number = finiteNumber(value, null)
  if (number === null) return '--'
  const prefix = signed && number > 0 ? '+' : ''
  return prefix + (number * 100).toFixed(2) + '%'
}

function resultCurve(result) {
  const analytics = (result && result.analytics) || {}
  if (Array.isArray(analytics.net_curve) && analytics.net_curve.length) {
    return analytics.net_curve.map(item => finiteNumber(item.strategy_nav, null)).filter(value => value !== null)
  }
  const equity = Array.isArray(result && result.equity_curve) ? result.equity_curve : []
  return equity.map(item => finiteNumber(item.net_value, null)).filter(value => value !== null)
}

function buildSparklinePoints(values) {
  const series = Array.isArray(values) ? values : []
  if (!series.length) return ''
  if (series.length === 1) return '0,25 220,25'
  const minimum = Math.min(...series)
  const maximum = Math.max(...series)
  const range = maximum - minimum || 1
  return series.map((value, index) => {
    const x = index / (series.length - 1) * 220
    const y = 44 - (value - minimum) / range * 38
    return x.toFixed(1) + ',' + y.toFixed(1)
  }).join(' ')
}

function buildTeachingPerformance(saved, strategy) {
  if (!saved || !saved.result || !strategy) return null
  const resultName = saved.result.strategy || (saved.payload && saved.payload.strategy)
  if (!resultName) return null
  const resultDetail = findStrategyDetail(resultName)
  if (resultDetail.fallback || resultDetail.key !== strategy.businessKey) return null

  const metrics = saved.result.metrics || {}
  const totalReturn = finiteNumber(metrics['策略收益'], finiteNumber(metrics['总收益率'], null))
  const maxDrawdown = finiteNumber(metrics['最大回撤'], null)
  const winRate = finiteNumber(metrics['胜率'], null)
  return {
    totalReturn: formatPercent(totalReturn, true),
    maxDrawdown: maxDrawdown === null ? '--' : formatPercent(Math.abs(maxDrawdown), false),
    winRate: formatPercent(winRate, false),
    sparklinePoints: buildSparklinePoints(resultCurve(saved.result)),
  }
}

function ratingForResult(item) {
  const sharpe = finiteNumber(item && item.sharpe_ratio, null)
  const drawdown = Math.abs(finiteNumber(item && item.max_drawdown, 0))
  if (sharpe !== null && sharpe >= 1 && drawdown <= 0.2) return { rating: '稳健', tone: 'good' }
  if (drawdown > 0.3 || (sharpe !== null && sharpe < 0)) return { rating: '激进', tone: 'risk' }
  return { rating: '平衡', tone: 'normal' }
}

function buildSensitivityRows(saved, strategy) {
  if (!saved || !strategy || saved.strategyKey !== strategy.businessKey) return []
  const definitions = strategy.parameters || []
  return (Array.isArray(saved.results) ? saved.results : []).map((item, index) => {
    const params = item.params || {}
    const resultRating = ratingForResult(item)
    const returnValue = finiteNumber(item.annual_return, finiteNumber(item.total_return, null))
    const drawdown = finiteNumber(item.max_drawdown, null)
    return {
      key: item.params_label || String(index),
      paramsText: definitions.map(definition => (
        params[definition.key] === undefined ? '--' : params[definition.key]
      )).join(' / '),
      annualReturn: formatPercent(returnValue, false),
      maxDrawdown: drawdown === null ? '--' : formatPercent(Math.abs(drawdown), false),
      rating: resultRating.rating,
      tone: resultRating.tone,
    }
  })
}

module.exports = {
  buildSensitivityRows,
  buildSparklinePoints,
  buildTeachingPerformance,
}
