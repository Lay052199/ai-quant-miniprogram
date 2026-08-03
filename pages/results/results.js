const echarts = require('../../ec-canvas/echarts')
const { runSensitivity } = require('../../utils/api')
const { loadLastResult } = require('../../utils/storage')

const CHART_COLORS = {
  purple: '#7C3AED',
  violet: '#A855F7',
  blue: '#2563EB',
  cyan: '#3B82F6',
  red: '#EF4444',
  green: '#14B8A6',
  grid: '#E7ECFA',
  text: '#7180A4'
}

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

function compactNumber(value, digits) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits === undefined ? 2 : digits) : '--'
}

function formatDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6)
  return text || '--'
}

function closedTrades(trades) {
  return (Array.isArray(trades) ? trades : []).filter(item => item && item.sell_date)
}

function maxConsecutive(values, positive) {
  let current = 0
  let longest = 0
  values.forEach(value => {
    const matched = positive ? value > 0 : value < 0
    current = matched ? current + 1 : 0
    longest = Math.max(longest, current)
  })
  return longest
}

function buildLegacyAnalytics(result) {
  const curve = Array.isArray(result.equity_curve) ? result.equity_curve : []
  const base = curve.length ? finiteNumber(curve[0].net_value, 1) : 1
  const netCurve = curve.map(item => ({
    date: item.date,
    strategy_return: base ? finiteNumber(item.net_value, base) / base - 1 : 0,
    benchmark_return: null
  }))

  const monthEnds = {}
  netCurve.forEach(item => {
    const month = String(item.date || '').slice(0, 7)
    if (month) monthEnds[month] = item.strategy_return
  })
  const months = Object.keys(monthEnds).sort()
  const monthlyReturns = months.map((month, index) => {
    const currentNav = 1 + monthEnds[month]
    const previousNav = index ? 1 + monthEnds[months[index - 1]] : 1
    return { month, return: previousNav ? currentNav / previousNav - 1 : 0 }
  })

  const trades = closedTrades(result.trades)
  const returns = trades.map(item => finiteNumber(item.return_rate, 0))
  const bucketDefinitions = [
    ['>10%', value => value > 0.10],
    ['5%-10%', value => value >= 0.05 && value <= 0.10],
    ['0%-5%', value => value >= 0 && value < 0.05],
    ['-5%-0%', value => value >= -0.05 && value < 0],
    ['<-5%', value => value < -0.05]
  ]
  const profitDistribution = bucketDefinitions.map(([label, matcher]) => {
    const count = returns.filter(matcher).length
    return { label, count, ratio: returns.length ? count / returns.length : 0 }
  })
  const wins = returns.filter(value => value > 0)
  const losses = returns.filter(value => value < 0)
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length
  const holdingDays = trades.map(item => finiteNumber(item.holding_days, NaN)).filter(Number.isFinite)

  return {
    net_curve: netCurve,
    monthly_returns: monthlyReturns,
    profit_distribution: profitDistribution,
    trade_statistics: {
      average_holding_days: holdingDays.length ? average(holdingDays) : null,
      profit_loss_ratio: wins.length && losses.length ? average(wins) / Math.abs(average(losses)) : null,
      max_consecutive_wins: maxConsecutive(returns, true),
      max_consecutive_losses: maxConsecutive(returns, false)
    }
  }
}

function buildInterpretations(metrics, benchmarkReturn, tradeStatistics) {
  const totalReturn = finiteNumber(metrics['策略收益'], finiteNumber(metrics['总收益率'], 0))
  const maxDrawdown = Math.abs(finiteNumber(metrics['最大回撤'], 0))
  const sharpe = finiteNumber(metrics['夏普比率'], 0)
  const winRate = finiteNumber(metrics['胜率'], 0)
  const profitLossRatio = finiteNumber(tradeStatistics.profit_loss_ratio, 0)
  const items = []

  const excess = totalReturn - benchmarkReturn
  if (excess > 0) {
    items.push('策略累计收益' + percent(totalReturn, true) + '，较基准高 ' + percent(excess, false) + '。')
  } else if (excess < 0) {
    items.push('策略累计收益' + percent(totalReturn, true) + '，较基准低 ' + percent(Math.abs(excess), false) + '，需关注策略适配性。')
  } else {
    items.push('策略累计收益' + percent(totalReturn, true) + '，与当前基准表现接近。')
  }

  if (maxDrawdown <= 0.10) {
    items.push('最大回撤为 ' + percent(-maxDrawdown, false) + '，本次样本中的回撤控制较平稳。')
  } else if (maxDrawdown <= 0.20) {
    items.push('最大回撤为 ' + percent(-maxDrawdown, false) + '，风险处于中等区间，仍需结合资金承受能力。')
  } else {
    items.push('最大回撤为 ' + percent(-maxDrawdown, false) + '，净值波动较大，应优先检查止损与仓位规则。')
  }

  const stability = sharpe >= 1 && winRate >= 0.5 ? '交易稳定性相对较好' : '交易稳定性仍有提升空间'
  const ratioText = profitLossRatio ? '，盈亏比 ' + compactNumber(profitLossRatio, 2) : ''
  items.push('夏普比率 ' + compactNumber(sharpe, 2) + '，胜率 ' + percent(winRate, false) + ratioText + '，' + stability + '。')
  return items
}

function buildCoreMetrics(raw) {
  const totalReturn = finiteNumber(raw['策略收益'], finiteNumber(raw['总收益率'], null))
  const annualReturn = finiteNumber(raw['年化收益率'], null)
  const drawdown = finiteNumber(raw['最大回撤'], null)
  const sharpe = finiteNumber(raw['夏普比率'], null)
  const winRate = finiteNumber(raw['胜率'], null)
  const tradeCount = finiteNumber(raw['交易次数'], null)
  const tone = value => value === null ? 'neutral' : (value >= 0 ? 'positive' : 'negative')

  return {
    totalReturn: { value: percent(totalReturn, true), tone: tone(totalReturn) },
    annualReturn: { value: percent(annualReturn, true), tone: tone(annualReturn) },
    maxDrawdown: { value: percent(drawdown, false), tone: 'safe' },
    sharpeRatio: { value: compactNumber(sharpe, 2), tone: 'neutral' },
    winRate: { value: percent(winRate, false), raw: Math.max(0, Math.min(1, finiteNumber(winRate, 0))) },
    tradeCount: { value: tradeCount === null ? '--' : String(Math.round(tradeCount)) + ' 次', raw: tradeCount || 0 }
  }
}

function filterNetCurve(curve, range) {
  if (!Array.isArray(curve) || !curve.length || range === 'all') return curve || []
  const lastDate = new Date(curve[curve.length - 1].date)
  if (Number.isNaN(lastDate.getTime())) return curve
  const cutoff = new Date(lastDate)
  cutoff.setMonth(cutoff.getMonth() - (range === '6m' ? 6 : 12))
  return curve.filter(item => new Date(item.date) >= cutoff)
}

Page({
  data: {
    hasResult: false,
    result: null,
    payload: null,
    summary: {},
    coreMetrics: {},
    trades: [],
    riskReport: [],
    reportText: '',
    analysis: null,
    benchmark: null,
    analytics: null,
    tradeStatistics: {},
    interpretations: [],
    curveRange: 'all',
    sensitivityLoading: false,
    sensitivityResults: [],
    sensitivitySummary: null,
    netChartEc: { lazyLoad: true },
    monthlyChartEc: { lazyLoad: true },
    distributionChartEc: { lazyLoad: true },
    winRateChartEc: { lazyLoad: true }
  },

  onShow() {
    const cached = loadLastResult()
    if (!cached || !cached.result) {
      this.setData({ hasResult: false })
      return
    }
    this.renderResult(cached.result, cached.payload || {}, cached.stock || null)
  },

  onUnload() {
    ;['netChart', 'monthlyChart', 'distributionChart', 'winRateChart'].forEach(key => {
      if (this[key] && this[key].dispose) this[key].dispose()
    })
  },

  renderResult(result, payload, stock) {
    const raw = result.metrics || {}
    const analytics = result.analytics && result.analytics.net_curve
      ? result.analytics
      : buildLegacyAnalytics(result)
    const tradeStatistics = analytics.trade_statistics || {}
    const benchmarkReturn = finiteNumber(raw['基准收益'], finiteNumber(raw['基准收益率'], 0))
    const symbol = result.symbol || payload.symbol || '--'
    const stockName = stock && stock.name ? stock.name : ''
    const startDate = formatDate(result.start_date || payload.start_date)
    const endDate = formatDate(result.end_date || payload.end_date)

    this.setData({
      hasResult: true,
      result,
      payload,
      summary: {
        symbol,
        stockName,
        stockDisplay: stockName ? symbol + ' ' + stockName : symbol,
        strategy: result.strategy || payload.strategy || '--',
        dates: startDate + ' ~ ' + endDate,
        source: result.data_source || 'unknown',
        message: result.data_message || ''
      },
      coreMetrics: buildCoreMetrics(raw),
      trades: Array.isArray(result.trades) ? result.trades.slice(0, 20) : [],
      riskReport: Array.isArray(result.risk_report) ? result.risk_report : [],
      reportText: result.report || '',
      analysis: result.analysis_conclusion || null,
      benchmark: result.benchmark_analysis || null,
      analytics,
      tradeStatistics: {
        averageHoldingDays: tradeStatistics.average_holding_days === null || tradeStatistics.average_holding_days === undefined
          ? '--' : compactNumber(tradeStatistics.average_holding_days, 1) + ' 天',
        profitLossRatio: tradeStatistics.profit_loss_ratio === null || tradeStatistics.profit_loss_ratio === undefined
          ? '--' : compactNumber(tradeStatistics.profit_loss_ratio, 2),
        maxConsecutiveWins: String(tradeStatistics.max_consecutive_wins || 0) + ' 次',
        maxConsecutiveLosses: String(tradeStatistics.max_consecutive_losses || 0) + ' 次'
      },
      interpretations: buildInterpretations(raw, benchmarkReturn, tradeStatistics)
    }, () => {
      wx.nextTick(() => this.initializeCharts())
    })
  },

  initializeChart(selector, key, option) {
    if (this[key] && this[key].setOption) {
      this[key].setOption(option, true)
      return
    }
    const component = this.selectComponent(selector)
    if (!component || !component.init) return
    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
      canvas.setChart(chart)
      chart.setOption(option)
      this[key] = chart
      return chart
    })
  },

  initializeCharts() {
    if (!this.data.analytics) return
    this.renderNetChart()
    this.renderMonthlyChart()
    this.renderDistributionChart()
    this.renderWinRateChart()
  },

  renderNetChart() {
    const curve = filterNetCurve(this.data.analytics.net_curve, this.data.curveRange)
    const dates = curve.map(item => item.date)
    const strategy = curve.map(item => {
      const nav = finiteNumber(item.strategy_nav, null)
      const value = nav === null ? finiteNumber(item.strategy_return, null) : nav - 1
      return value === null ? '-' : +(value * 100).toFixed(2)
    })
    const benchmark = curve.map(item => {
      const nav = finiteNumber(item.benchmark_nav, null)
      const value = nav === null ? finiteNumber(item.benchmark_return, null) : nav - 1
      return value === null ? '-' : +(value * 100).toFixed(2)
    })
    const lastDate = dates.length ? dates[dates.length - 1] : ''
    const lastStrategy = strategy.length ? strategy[strategy.length - 1] : 0
    const lastBenchmark = benchmark.length ? benchmark[benchmark.length - 1] : 0
    const endLabel = (value, color) => {
      const numericValue = finiteNumber(value, 0)
      return ({
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color, borderColor: '#ffffff', borderWidth: 2 },
        data: [{
          coord: [lastDate, numericValue],
          value: (numericValue > 0 ? '+' : '') + numericValue.toFixed(1) + '%',
          label: {
            show: true,
            position: 'right',
            distance: 7,
            padding: [5, 7],
            borderRadius: 5,
            color: '#ffffff',
            backgroundColor: color,
            fontSize: 10,
            fontWeight: 'bold',
            formatter: params => params.value
          }
        }]
      })
    }
    const option = {
      color: [CHART_COLORS.purple, CHART_COLORS.blue],
      animationDuration: 850,
      legend: {
        top: 0,
        left: 0,
        itemWidth: 20,
        itemHeight: 5,
        icon: 'roundRect',
        itemGap: 18,
        textStyle: { color: '#536184', fontSize: 10 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(24,35,76,0.92)',
        borderWidth: 0,
        padding: [8, 10],
        textStyle: { color: '#ffffff', fontSize: 10 },
        valueFormatter: value => value + '%'
      },
      grid: { left: 43, right: 58, top: 48, bottom: 32 },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#DCE4F5' } },
        axisTick: { show: false },
        axisLabel: {
          color: CHART_COLORS.text,
          fontSize: 9,
          hideOverlap: true,
          margin: 11,
          formatter: value => value.slice(0, 7)
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: CHART_COLORS.text, fontSize: 9, formatter: '{value}%' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitNumber: 5,
        splitLine: { lineStyle: { color: '#E6EBF7', type: 'dashed', width: 1 } }
      },
      series: [
        {
          name: '策略收益',
          type: 'line',
          data: strategy,
          showSymbol: false,
          smooth: 0.16,
          sampling: 'lttb',
          connectNulls: true,
          lineStyle: { width: 2.6, cap: 'round', join: 'round' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(124,58,237,0.16)' },
              { offset: 1, color: 'rgba(124,58,237,0.01)' }
            ])
          },
          markPoint: endLabel(lastStrategy, CHART_COLORS.purple)
        },
        {
          name: '基准收益（沪深300）',
          type: 'line',
          data: benchmark,
          showSymbol: false,
          smooth: 0.14,
          sampling: 'lttb',
          connectNulls: true,
          lineStyle: { width: 2.2, cap: 'round', join: 'round' },
          markPoint: endLabel(lastBenchmark, CHART_COLORS.blue)
        }
      ]
    }
    this.initializeChart('#net-chart', 'netChart', option)
  },

  renderMonthlyChart() {
    const rows = this.data.analytics.monthly_returns || []
    const values = rows.map(item => +(finiteNumber(item.return, 0) * 100).toFixed(2))
    const option = {
      animationDuration: 650,
      tooltip: { trigger: 'axis', valueFormatter: value => value + '%' },
      grid: { left: 36, right: 8, top: 12, bottom: 30 },
      xAxis: {
        type: 'category',
        data: rows.map(item => item.month.slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_COLORS.grid } },
        axisLabel: { color: CHART_COLORS.text, fontSize: 9, interval: Math.max(0, Math.floor(rows.length / 6) - 1) }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: CHART_COLORS.text, fontSize: 8, formatter: '{value}%' },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: 'dashed' } }
      },
      series: [{
        type: 'bar',
        data: values.map(value => ({
          value,
          itemStyle: {
            color: value >= 0
              ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: CHART_COLORS.violet }, { offset: 1, color: CHART_COLORS.purple }])
              : new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#60A5FA' }, { offset: 1, color: CHART_COLORS.blue }])
          }
        })),
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }]
    }
    this.initializeChart('#monthly-chart', 'monthlyChart', option)
  },

  renderDistributionChart() {
    const rows = this.data.analytics.profit_distribution || []
    const option = {
      animationDuration: 650,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => value + '%' },
      grid: { left: 55, right: 25, top: 6, bottom: 10 },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map(item => item.label),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#4C5A7C', fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: rows.map((item, index) => ({
          value: +(finiteNumber(item.ratio, 0) * 100).toFixed(1),
          itemStyle: {
            color: index < 3
              ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CHART_COLORS.purple }, { offset: 1, color: '#C084FC' }])
              : new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: CHART_COLORS.blue }, { offset: 1, color: '#60A5FA' }])
          }
        })),
        showBackground: true,
        backgroundStyle: { color: '#EEF2FF', borderRadius: 8 },
        barWidth: 10,
        label: { show: true, position: 'right', color: '#33416B', fontSize: 9, formatter: '{c}%' },
        itemStyle: { borderRadius: 8 }
      }]
    }
    this.initializeChart('#distribution-chart', 'distributionChart', option)
  },

  renderWinRateChart() {
    const rate = Math.max(0, Math.min(100, Math.round(this.data.coreMetrics.winRate.raw * 100)))
    const option = {
      animationDuration: 760,
      animationEasing: 'cubicOut',
      tooltip: { show: false },
      series: [{
        type: 'pie',
        radius: ['76%', '88%'],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        padAngle: 2,
        silent: true,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { disabled: true, scale: false },
        data: [
          {
            value: rate,
            itemStyle: {
              borderRadius: 8,
              color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
                { offset: 0, color: '#9B7AF6' },
                { offset: 0.52, color: CHART_COLORS.violet },
                { offset: 1, color: CHART_COLORS.blue }
              ]),
              shadowBlur: 4,
              shadowColor: 'rgba(108, 92, 244, 0.16)'
            }
          },
          {
            value: Math.max(0, 100 - rate),
            itemStyle: {
              borderRadius: 8,
              color: '#ECEFFA'
            }
          }
        ]
      }]
    }
    this.initializeChart('#win-rate-chart', 'winRateChart', option)
  },

  onCurveRangeChange(e) {
    const range = e.currentTarget.dataset.range
    if (!range || range === this.data.curveRange) return
    this.setData({ curveRange: range }, () => this.renderNetChart())
  },

  goToBacktest() {
    wx.switchTab({ url: '/pages/backtest/backtest' })
  },

  async startSensitivity() {
    if (!this.data.payload) return
    this.setData({ sensitivityLoading: true })
    try {
      const data = await runSensitivity(this.data.payload)
      this.setData({
        sensitivityResults: data.sensitivity_results || [],
        sensitivitySummary: data.sensitivity_summary || null
      })
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    } finally {
      this.setData({ sensitivityLoading: false })
    }
  },

  copyReport() {
    if (!this.data.reportText) return
    wx.setClipboardData({ data: this.data.reportText })
  }
})
