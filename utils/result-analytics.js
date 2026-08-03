function finiteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function percent(value, signed) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  const prefix = signed && number > 0 ? '+' : ''
  return prefix + (number * 100).toFixed(2) + '%'
}

function formatDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6)
  return text || '--'
}

function buildCoreMetrics(raw) {
  const metrics = raw || {}
  const total = finiteNumber(metrics['策略收益'], finiteNumber(metrics['总收益率'], null))
  const annual = finiteNumber(metrics['年化收益率'], null)
  const drawdown = finiteNumber(metrics['最大回撤'], null)
  const winRate = finiteNumber(metrics['胜率'], null)
  const profitLossRatio = finiteNumber(metrics['盈亏比'], null)
  const tradeCount = finiteNumber(metrics['交易次数'], null)
  return [
    { key: 'total', label: '累计收益率', value: percent(total, true), tone: total !== null && total >= 0 ? 'positive' : 'neutral' },
    { key: 'annual', label: '年化收益率', value: percent(annual, true), tone: annual !== null && annual >= 0 ? 'positive' : 'neutral' },
    { key: 'drawdown', label: '最大回撤', value: percent(drawdown, false), tone: 'safe' },
    { key: 'win', label: '胜率', value: percent(winRate, false), tone: 'neutral' },
    { key: 'ratio', label: '盈亏比', value: profitLossRatio === null ? '--' : profitLossRatio.toFixed(2), tone: 'neutral' },
    { key: 'trades', label: '交易次数', value: tradeCount === null ? '--' : Math.round(tradeCount) + ' 次', tone: 'neutral' }
  ]
}

function buildLegacyAnalytics(result) {
  const curve = Array.isArray(result && result.equity_curve) ? result.equity_curve : []
  const base = curve.length ? finiteNumber(curve[0].net_value, 1) : 1
  const netCurve = curve.map(item => ({
    date: item.date,
    strategy_nav: base ? finiteNumber(item.net_value, base) / base : null,
    benchmark_nav: null
  }))
  const monthEnds = {}
  netCurve.forEach(item => {
    const month = String(item.date || '').slice(0, 7)
    if (month && item.strategy_nav !== null) monthEnds[month] = item.strategy_nav
  })
  const months = Object.keys(monthEnds).sort()
  const monthlyReturns = months.map((month, index) => ({
    month,
    return: index ? monthEnds[month] / monthEnds[months[index - 1]] - 1 : monthEnds[month] - 1
  }))
  return {
    net_curve: netCurve,
    monthly_returns: monthlyReturns,
    trade_statistics: {}
  }
}

module.exports = {
  buildCoreMetrics,
  buildLegacyAnalytics,
  finiteNumber,
  formatDate,
  percent
}
