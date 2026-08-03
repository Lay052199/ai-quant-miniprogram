const echarts = require('../../../ec-canvas/echarts')
const { loadLastResult } = require('../../../utils/storage')
const { findStrategyDetail } = require('../../../utils/strategy-detail')
const { startStrategyFlow } = require('../../../utils/strategy-flow')
const {
  buildCoreMetrics,
  buildLegacyAnalytics,
  finiteNumber,
  formatDate
} = require('../../../utils/result-analytics')

function matchesResultStrategy(saved, strategy) {
  if (!saved || !saved.result || !strategy) return false
  const resultName = saved.result.strategy || (saved.payload && saved.payload.strategy)
  if (!resultName) return false
  const resultDetail = findStrategyDetail(resultName)
  return !resultDetail.fallback && resultDetail.key === strategy.key
}

function statisticRows(analytics) {
  const value = (analytics && analytics.trade_statistics) || {}
  const number = (raw, digits, suffix) => {
    const parsed = finiteNumber(raw, null)
    return parsed === null ? '--' : parsed.toFixed(digits) + suffix
  }
  return [
    { label: '平均持仓时间', value: number(value.average_holding_days, 1, ' 天') },
    { label: '最大连续盈利', value: number(value.max_consecutive_wins, 0, ' 次') },
    { label: '最大连续亏损', value: number(value.max_consecutive_losses, 0, ' 次') }
  ]
}

Page({
  data: {
    strategy: findStrategyDetail('ma'),
    hasResult: false,
    summary: {},
    metrics: [],
    analytics: null,
    statistics: [],
    netChartEc: { lazyLoad: true },
    monthlyChartEc: { lazyLoad: true },
    loading: false,
    errorMessage: ''
  },

  onLoad(options) {
    this.setData({ strategy: findStrategyDetail(options && options.strategy) })
  },

  onShow() {
    const saved = loadLastResult()
    if (!matchesResultStrategy(saved, this.data.strategy)) {
      this.setData({ hasResult: false, analytics: null })
      return
    }
    const result = saved.result
    const payload = saved.payload || {}
    const analytics = result.analytics && Array.isArray(result.analytics.net_curve)
      ? result.analytics
      : buildLegacyAnalytics(result)
    this.setData({
      hasResult: true,
      summary: {
        symbol: result.symbol || payload.symbol || '--',
        strategy: result.strategy || payload.strategy || this.data.strategy.name,
        dates: formatDate(result.start_date || payload.start_date) + ' ~ ' + formatDate(result.end_date || payload.end_date)
      },
      metrics: buildCoreMetrics(result.metrics),
      analytics,
      statistics: statisticRows(analytics)
    }, () => wx.nextTick(() => this.initializeCharts()))
  },

  onUnload() {
    ;['netChart', 'monthlyChart'].forEach(key => {
      if (this[key] && this[key].dispose) this[key].dispose()
    })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  useStrategy() {
    return startStrategyFlow(this, this.data.strategy)
  },

  initializeChart(selector, key, option) {
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
    const analytics = this.data.analytics
    if (!analytics) return
    const curve = analytics.net_curve || []
    const readReturn = (item, navKey, returnKey) => {
      const nav = finiteNumber(item[navKey], null)
      const value = nav === null ? finiteNumber(item[returnKey], null) : nav - 1
      return value === null ? '-' : +(value * 100).toFixed(2)
    }
    const netOption = {
      animationDuration: 760,
      color: ['#7c3aed', '#2563eb'],
      legend: { top: 0, textStyle: { color: '#5c6987', fontSize: 10 } },
      grid: { left: 42, right: 16, top: 48, bottom: 32 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: curve.map(item => item.date),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dce4f5' } },
        axisLabel: { color: '#7180a4', fontSize: 9, hideOverlap: true, formatter: value => String(value).slice(0, 7) }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: '#7180a4', fontSize: 9, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#e7ecfa', type: 'dashed' } }
      },
      series: [
        {
          name: '策略收益',
          type: 'line',
          data: curve.map(item => readReturn(item, 'strategy_nav', 'strategy_return')),
          showSymbol: false,
          smooth: 0.16,
          connectNulls: false,
          lineStyle: { width: 2.4, cap: 'round', join: 'round' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(124,58,237,.16)' },
              { offset: 1, color: 'rgba(124,58,237,.01)' }
            ])
          }
        },
        {
          name: '基准收益（沪深300）',
          type: 'line',
          data: curve.map(item => readReturn(item, 'benchmark_nav', 'benchmark_return')),
          showSymbol: false,
          smooth: 0.14,
          connectNulls: false,
          lineStyle: { width: 2.1, cap: 'round', join: 'round' }
        }
      ]
    }
    const months = analytics.monthly_returns || []
    const monthlyOption = {
      animationDuration: 650,
      grid: { left: 38, right: 10, top: 12, bottom: 30 },
      xAxis: {
        type: 'category',
        data: months.map(item => String(item.month).slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e7ecfa' } },
        axisLabel: { color: '#7180a4', fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#7180a4', fontSize: 8, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#e7ecfa', type: 'dashed' } }
      },
      series: [{
        type: 'bar',
        barMaxWidth: 18,
        data: months.map(item => {
          const value = +(finiteNumber(item.return, 0) * 100).toFixed(2)
          return { value, itemStyle: { color: value >= 0 ? '#8b5cf6' : '#ef7185', borderRadius: [4, 4, 0, 0] } }
        })
      }]
    }
    this.initializeChart('#performance-net-chart', 'netChart', netOption)
    this.initializeChart('#performance-monthly-chart', 'monthlyChart', monthlyOption)
  }
})

module.exports = { matchesResultStrategy }
