const API_BASE_URL = 'https://ai-quant-api-262511-5-1437199254.sh.run.tcloudbase.com'

const STRATEGY_EXPLANATIONS = {
  '双均线策略': {
    principle: '通过短期均线与长期均线的交叉判断趋势变化。',
    market: '适用于趋势明显的上涨或下跌行情。',
    failure: '震荡行情中容易频繁交易，产生假信号。',
    focus: '理解趋势跟随、信号滞后、参数敏感性。'
  },
  '动量策略': {
    principle: '假设近期上涨的资产短期内可能延续趋势。',
    market: '适用于强趋势、持续上涨或下跌行情。',
    failure: '行情快速反转时容易追高或杀跌。',
    focus: '理解动量效应、趋势延续和反转风险。'
  },
  'RSI策略': {
    principle: '通过相对强弱指标识别超买和超卖状态。',
    market: '适用于震荡或均值回归特征明显的行情。',
    failure: '强趋势行情中可能长期超买或超卖，过早反向交易。',
    focus: '理解超买超卖、均值回归和指标钝化。'
  }
}

Page({
  data: {
    symbol: '000001',
    startDate: '20230101',
    endDate: '20241231',
    strategyOptions: ['双均线策略', '动量策略', 'RSI策略'],
    strategies: ['双均线策略', '动量策略', 'RSI策略'],
    strategyIndex: 0,
    strategy: '双均线策略',
    initialCash: '100000',
    commissionRate: '0.0003',
    slippageRate: '0.0002',
    shortWindow: '5',
    longWindow: '20',
    loading: false,
    sensitivityLoading: false,
    errorMessage: '',
    result: null,
    metrics: {},
    displayMetrics: [],
    riskReport: [],
    reportText: '',
    trades: [],
    equityCurveLength: 0,
    benchmarkAnalysis: null,
    analysisConclusion: null,
    sensitivityResults: [],
    sensitivityVisuals: [],
    sensitivitySummary: null,
    equityCurveRaw: [],
    curveSummary: {
      first: '--',
      last: '--',
      max: '--',
      min: '--',
      change: '--'
    },
    curvePreview: [],
    summary: {
      symbol: '--',
      dateRange: '--',
      strategy: '--',
      dataSourceLabel: '数据不可用',
      dataMessage: '--'
    },
    sourceBadgeClass: 'source-badge source-none',
    showMockNotice: false,
    showCacheNotice: false,
    showRealNotice: false,
    showErrorCard: false,
    errorCardTitle: '',
    errorCardMessage: '',
    failureAnalysis: null,
    strategyExplanation: STRATEGY_EXPLANATIONS['双均线策略'],
    disclaimerText: '本工具仅用于历史数据回测、策略学习与模拟分析，不构成任何投资建议。',
    equityCanvasWidth: 320,
    equityCanvasHeight: 220
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const canvasWidth = Math.max(300, systemInfo.windowWidth - 72)
    this.setData({
      equityCanvasWidth: canvasWidth,
      equityCanvasHeight: 220
    })
    console.log('QuantLabAI 页面加载完成')
  },

  testHealth() {
    wx.request({
      url: API_BASE_URL + '/health',
      method: 'GET',
      success(res) {
        console.log('公网 health 返回：', res)
        if (res.statusCode === 200) {
          wx.showToast({
            title: '后端连接成功',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '后端返回异常',
            icon: 'none'
          })
        }
      },
      fail(err) {
        console.error('公网 health 请求失败：', err)
        wx.showToast({
          title: '请求失败',
          icon: 'none'
        })
      }
    })
  },

  onInputSymbol(e) { this.setData({ symbol: e.detail.value }) },
  onSymbolInput(e) { this.onInputSymbol(e) },
  onInputStartDate(e) { this.setData({ startDate: e.detail.value }) },
  onStartDateInput(e) { this.onInputStartDate(e) },
  onInputEndDate(e) { this.setData({ endDate: e.detail.value }) },
  onEndDateInput(e) { this.onInputEndDate(e) },

  onChangeStrategy(e) {
    const index = Number(e.detail.value)
    const strategy = this.data.strategyOptions[index] || '双均线策略'
    this.setData({
      strategyIndex: index,
      strategy: strategy,
      strategyExplanation: STRATEGY_EXPLANATIONS[strategy] || STRATEGY_EXPLANATIONS['双均线策略']
    })
  },

  onStrategyChange(e) { this.onChangeStrategy(e) },
  onInputInitialCash(e) { this.setData({ initialCash: e.detail.value }) },
  onInitialCashInput(e) { this.onInputInitialCash(e) },
  onInputCommissionRate(e) { this.setData({ commissionRate: e.detail.value }) },
  onCommissionRateInput(e) { this.onInputCommissionRate(e) },
  onInputSlippageRate(e) { this.setData({ slippageRate: e.detail.value }) },
  onSlippageRateInput(e) { this.onInputSlippageRate(e) },
  onInputShortWindow(e) { this.setData({ shortWindow: e.detail.value }) },
  onShortWindowInput(e) { this.onInputShortWindow(e) },
  onInputLongWindow(e) { this.setData({ longWindow: e.detail.value }) },
  onLongWindowInput(e) { this.onInputLongWindow(e) },

  buildRequestPayload(useDemoMode = true) {
    return {
      symbol: String(this.data.symbol || '').trim(),
      start_date: String(this.data.startDate || '').trim(),
      end_date: String(this.data.endDate || '').trim(),
      strategy: this.data.strategy || this.data.strategyOptions[this.data.strategyIndex] || '双均线策略',
      initial_cash: Number(this.data.initialCash || 100000),
      commission_rate: Number(this.data.commissionRate || 0.0003),
      slippage_rate: Number(this.data.slippageRate || 0.0002),
      demo_mode: useDemoMode,
      allow_mock: useDemoMode,
      strategy_params: {
        short_window: Number(this.data.shortWindow || 5),
        long_window: Number(this.data.longWindow || 20)
      },
      short_window: Number(this.data.shortWindow || 5),
      long_window: Number(this.data.longWindow || 20)
    }
  },

  parseCloudResponse(res) {
    let data = null
    if (res && res.data) {
      data = res.data
    }
    if (!data && res && res.result) {
      data = res.result
    }
    if (data && data.body) {
      data = data.body
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (err) {
        console.error('JSON.parse 解析失败：', err)
      }
    }
    return data || {}
  },

  getSourceInfo(dataSource) {
    const mapping = {
      akshare: { label: '真实行情', badgeClass: 'source-badge source-akshare' },
      cache: { label: '缓存行情', badgeClass: 'source-badge source-cache' },
      mock: { label: '演示行情', badgeClass: 'source-badge source-mock' },
      none: { label: '数据不可用', badgeClass: 'source-badge source-none' }
    }
    return mapping[dataSource] || mapping.none
  },

  normalizeRiskReport(data) {
    const rawRiskReport = data.risk_report || data.riskReport || []
    if (!rawRiskReport) return []
    if (Array.isArray(rawRiskReport)) {
      return rawRiskReport.map(item => {
        if (typeof item === 'string') return item
        if (typeof item === 'object') return item.message || item.text || item.detail || JSON.stringify(item)
        return String(item)
      })
    }
    return [String(rawRiskReport)]
  },

  normalizeTrades(data) {
    const trades = data.trades || []
    if (!Array.isArray(trades)) return []
    return trades.slice(0, 10).map(item => {
      return {
        buy_date: item.buy_date || item.buyDate || item.date || '--',
        sell_date: item.sell_date || item.sellDate || '--',
        buy_price: item.buy_price || item.buyPrice || item.price || '--',
        sell_price: item.sell_price || item.sellPrice || '--',
        profit: item.profit || item.return || '--'
      }
    })
  },

  formatPercentNumber(value) {
    const num = Number(value)
    if (Number.isNaN(num)) {
      return '--'
    }
    return (num * 100).toFixed(2) + '%'
  },

  formatMetricValue(name, value) {
    if (value === null || value === undefined || value === '') return '--'
    const num = Number(value)
    if (Number.isNaN(num)) return String(value)

    if (name.includes('资金') || name.includes('资产') || name.includes('市值') || name.includes('本金')) {
      return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    if (name.includes('次数') || name.includes('交易数') || name.includes('笔数') || name.includes('天数')) {
      return String(Math.round(num))
    }

    if (name.includes('收益') || name.includes('收益率') || name.includes('回撤') || name.includes('胜率') || name.includes('波动')) {
      return (num * 100).toFixed(2) + '%'
    }

    return num.toFixed(4)
  },

  getMetricTone(name, rawValue) {
    const num = Number(rawValue)
    if (Number.isNaN(num)) return ''
    if (name.includes('最大回撤')) return num < 0 ? 'metric-negative' : 'metric-positive'
    if (name.includes('收益') || name.includes('胜率') || name.includes('夏普')) return num >= 0 ? 'metric-positive' : 'metric-negative'
    return ''
  },

  buildDisplayMetrics(rawMetrics) {
    const mapping = [
      { key: '策略收益', aliases: ['策略收益', '总收益率', 'total_return'] },
      { key: '基准收益', aliases: ['基准收益', '基准收益率', 'benchmark_return'] },
      { key: '超额收益', aliases: ['超额收益', '超额收益率', 'excess_return'] },
      { key: '年化收益率', aliases: ['年化收益率', 'annual_return'] },
      { key: '最大回撤', aliases: ['最大回撤', 'max_drawdown'] },
      { key: '夏普比率', aliases: ['夏普比率', 'sharpe_ratio'] },
      { key: '胜率', aliases: ['胜率', 'win_rate'] },
      { key: '交易次数', aliases: ['交易次数', 'trade_count'] },
      { key: '最终资产', aliases: ['最终资产', 'final_value'] }
    ]

    const metrics = rawMetrics || {}
    return mapping.map(item => {
      let rawValue = null
      for (let i = 0; i < item.aliases.length; i++) {
        const alias = item.aliases[i]
        if (metrics[alias] !== undefined && metrics[alias] !== null) {
          rawValue = metrics[alias]
          break
        }
      }
      return {
        name: item.key,
        value: this.formatMetricValue(item.key, rawValue),
        toneClass: this.getMetricTone(item.key, rawValue)
      }
    })
  },

  extractCurveValue(point) {
    if (typeof point === 'number') return point
    if (!point || typeof point !== 'object') return null
    const possibleKeys = ['net_value', 'nav', 'value', 'equity', 'strategy_nav', '净值']
    for (let i = 0; i < possibleKeys.length; i++) {
      const key = possibleKeys[i]
      if (point[key] !== undefined && point[key] !== null) {
        const num = Number(point[key])
        return Number.isNaN(num) ? null : num
      }
    }
    return null
  },

  buildCurveInfo(data) {
    const curve = data.equity_curve || []
    const validCurve = Array.isArray(curve) ? curve : []
    const values = validCurve.map(item => this.extractCurveValue(item)).filter(value => value !== null && !Number.isNaN(value))
    const defaultSummary = { first: '--', last: '--', max: '--', min: '--', change: '--' }

    if (values.length === 0) {
      return { equityCurveLength: validCurve.length, curveSummary: defaultSummary, curvePreview: [] }
    }

    const first = values[0]
    const last = values[values.length - 1]
    const max = Math.max(...values)
    const min = Math.min(...values)
    const change = first !== 0 ? (((last / first) - 1) * 100).toFixed(2) + '%' : '--'
    const step = Math.max(1, Math.floor(values.length / 8))
    const sampled = values.filter((_, index) => index % step === 0).slice(0, 8)
    const minValue = Math.min(...sampled)
    const maxValue = Math.max(...sampled)
    const range = maxValue - minValue || 1

    const curvePreview = sampled.map((value, index) => {
      const width = 24 + ((value - minValue) / range) * 76
      return { label: '点' + (index + 1), value: value.toFixed(4), style: 'width: ' + width.toFixed(0) + '%;' }
    })

    return {
      equityCurveLength: validCurve.length,
      curveSummary: {
        first: first.toFixed(4),
        last: last.toFixed(4),
        max: max.toFixed(4),
        min: min.toFixed(4),
        change: change
      },
      curvePreview: curvePreview
    }
  },

  drawEquityChart(curve) {
    const curveData = Array.isArray(curve) ? curve : []
    if (curveData.length < 2) {
      return
    }

    const values = curveData
      .map(item => Number(item.net_value))
      .filter(value => !Number.isNaN(value))

    if (values.length < 2) {
      return
    }

    const width = this.data.equityCanvasWidth
    const height = this.data.equityCanvasHeight
    const paddingLeft = 28
    const paddingRight = 18
    const paddingTop = 22
    const paddingBottom = 26
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1
    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom
    const stepX = chartWidth / Math.max(values.length - 1, 1)
    const ctx = wx.createCanvasContext('equityCanvas', this)

    ctx.clearRect(0, 0, width, height)
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, width, height)

    ctx.setStrokeStyle('#e2e8f0')
    ctx.setLineWidth(1)
    for (let i = 0; i < 4; i++) {
      const y = paddingTop + (chartHeight / 3) * i
      ctx.beginPath()
      ctx.moveTo(paddingLeft, y)
      ctx.lineTo(width - paddingRight, y)
      ctx.stroke()
    }

    ctx.setStrokeStyle('#2563eb')
    ctx.setLineWidth(3)
    ctx.beginPath()
    values.forEach((value, index) => {
      const x = paddingLeft + stepX * index
      const y = paddingTop + chartHeight - ((value - minValue) / range) * chartHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    ctx.setFillStyle('#2563eb')
    const firstY = paddingTop + chartHeight - ((values[0] - minValue) / range) * chartHeight
    const lastY = paddingTop + chartHeight - ((values[values.length - 1] - minValue) / range) * chartHeight

    ctx.beginPath()
    ctx.arc(paddingLeft, firstY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(width - paddingRight, lastY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.setFillStyle('#64748b')
    ctx.setFontSize(10)
    ctx.fillText(maxValue.toFixed(4), 4, paddingTop + 4)
    ctx.fillText(minValue.toFixed(4), 4, height - paddingBottom)
    ctx.fillText(curveData[0].date || '', paddingLeft, height - 6)
    ctx.fillText(curveData[curveData.length - 1].date || '', width - 86, height - 6)
    ctx.draw()
  },

  buildSummary(data) {
    const sourceInfo = this.getSourceInfo(data.data_source)
    return {
      symbol: data.symbol || this.data.symbol,
      dateRange: (data.start_date || this.data.startDate) + ' ~ ' + (data.end_date || this.data.endDate),
      strategy: data.strategy || this.data.strategy,
      dataSourceLabel: sourceInfo.label,
      dataMessage: data.data_message || '--'
    }
  },

  buildBenchmarkDisplay(data) {
    const benchmark = data.benchmark_analysis || {}
    return {
      strategyReturn: this.formatMetricValue('策略收益', benchmark.strategy_return),
      benchmarkReturn: this.formatMetricValue('基准收益', benchmark.benchmark_return),
      excessReturn: this.formatMetricValue('超额收益', benchmark.excess_return),
      conclusion: benchmark.conclusion || '--',
      explanation: benchmark.explanation || '--'
    }
  },

  buildAnalysisConclusion(data, metrics) {
    const analysis = data.analysis_conclusion || {}
    if (analysis.summary) return analysis

    const strategyReturn = Number((metrics || {})['策略收益'] || 0)
    const benchmarkReturn = Number((metrics || {})['基准收益'] || 0)
    const maxDrawdown = Number((metrics || {})['最大回撤'] || 0)

    return {
      summary: strategyReturn > benchmarkReturn ? '策略收益高于基准，说明当前参数下具备一定主动收益能力。' : '策略收益不及基准，说明当前参数下策略优势并不明显。',
      return_analysis: '本次回测结果需要结合基准收益与超额收益共同解读，不能只看绝对收益。',
      risk_analysis: Math.abs(maxDrawdown) < 0.2 ? '回撤仍处于可分析范围内，但需继续关注不同市场阶段下的波动表现。' : '最大回撤偏大，说明在不利市场环境中仍存在明显净值压力。',
      strategy_limitation: '单次回测不能代表策略长期有效性，参数和市场环境都会影响结果。',
      learning_note: '历史回测不等于未来表现，建议从多区间、多参数、多市场环境角度综合理解策略特征。'
    }
  },

  normalizeFailureAnalysis(data) {
    return data.failure_analysis || {
      reason: '系统未返回详细失败分析。',
      possible_causes: ['数据源暂时不可用', '参数设置不合理'],
      suggestions: ['稍后重试', '开启演示模式']
    }
  },

  buildSensitivityVisuals(results) {
    const list = Array.isArray(results) ? results : []
    if (list.length === 0) {
      return []
    }

    const absReturns = list.map(item => Math.abs(Number(item.total_return) || 0))
    const maxReturn = Math.max(...absReturns, 0.01)

    return list.map(item => {
      const totalReturn = Number(item.total_return) || 0
      const width = 18 + (Math.abs(totalReturn) / maxReturn) * 82
      return {
        paramsLabel: item.params_label,
        totalReturnText: this.formatPercentNumber(item.total_return),
        maxDrawdownText: this.formatPercentNumber(item.max_drawdown),
        sharpeText: Number(item.sharpe_ratio || 0).toFixed(4),
        conclusion: item.conclusion || '--',
        barStyle: 'width:' + width.toFixed(0) + '%;',
        barClass: totalReturn >= 0 ? 'sensitivity-bar-fill positive' : 'sensitivity-bar-fill negative'
      }
    })
  },

  copyReport() {
    if (!this.data.reportText) {
      wx.showToast({ title: '暂无可复制报告', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.reportText,
      success: () => {
        wx.showToast({ title: '已复制报告', icon: 'success' })
      }
    })
  },

  retryWithDemoMode() {
    this.startBacktest(true)
  },

  runSensitivityAnalysis() {
    this.setData({ sensitivityLoading: true })
    const payload = this.buildRequestPayload(true)
    wx.request({
      url: API_BASE_URL + '/api/sensitivity',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: payload,
      success: (res) => {
        console.log('参数敏感性接口返回：', res)
        const data = this.parseCloudResponse(res) || {}
        if (res.statusCode === 200 && data.success !== false) {
          this.setData({
            sensitivityResults: data.sensitivity_results || [],
            sensitivitySummary: data.sensitivity_summary || null,
            sensitivityVisuals: this.buildSensitivityVisuals(data.sensitivity_results || [])
          })
          wx.showToast({ title: '分析完成', icon: 'success' })
        } else {
          wx.showToast({ title: '分析失败', icon: 'none' })
        }
      },
      fail: (err) => {
        console.error('参数敏感性请求失败：', err)
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ sensitivityLoading: false })
      }
    })
  },

  startBacktest(forceDemoMode) {
    const useDemo = typeof forceDemoMode === 'boolean' ? forceDemoMode : true
    this.setData({
      loading: true,
      errorMessage: '',
      result: null,
      metrics: {},
      displayMetrics: [],
      riskReport: [],
      reportText: '',
      trades: [],
      equityCurveLength: 0,
      benchmarkAnalysis: null,
      analysisConclusion: null,
      sensitivityResults: [],
      sensitivityVisuals: [],
      sensitivitySummary: null,
      equityCurveRaw: [],
      curveSummary: { first: '--', last: '--', max: '--', min: '--', change: '--' },
      curvePreview: [],
      summary: {
        symbol: '--',
        dateRange: '--',
        strategy: '--',
        dataSourceLabel: '数据不可用',
        dataMessage: '--'
      },
      sourceBadgeClass: 'source-badge source-none',
      showMockNotice: false,
      showCacheNotice: false,
      showRealNotice: false,
      showErrorCard: false,
      errorCardTitle: '',
      errorCardMessage: '',
      failureAnalysis: null
    })

    const payload = this.buildRequestPayload(useDemo)
    console.log('回测请求参数：', payload)

    wx.request({
      url: API_BASE_URL + '/api/backtest',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: payload,
      success: (res) => {
        console.log('回测接口返回：', res)
        const data = this.parseCloudResponse(res) || {}
        const sourceInfo = this.getSourceInfo(data.data_source)
        const summary = this.buildSummary(data)

        if (res.statusCode !== 200) {
          this.setData({
            errorMessage: '回测失败：' + JSON.stringify(res.data),
            showErrorCard: true,
            errorCardTitle: '服务返回异常',
            errorCardMessage: '请稍后重试，或切换到演示模式。'
          })
          wx.showToast({ title: '回测失败', icon: 'none' })
          return
        }

        if (data.success === false) {
          this.setData({
            result: data,
            summary: summary,
            sourceBadgeClass: sourceInfo.badgeClass,
            errorMessage: data.message || '数据源暂不可用',
            showErrorCard: true,
            errorCardTitle: '失败原因分析',
            errorCardMessage: data.message || '可稍后重试，或使用演示模式。',
            failureAnalysis: this.normalizeFailureAnalysis(data),
            showMockNotice: false,
            showCacheNotice: false,
            showRealNotice: false
          })
          wx.showToast({ title: '数据不可用', icon: 'none' })
          return
        }

        const rawMetrics = data.metrics || {}
        const displayMetrics = this.buildDisplayMetrics(rawMetrics)
        const riskReport = this.normalizeRiskReport(data)
        const reportText = data.report || ''
        const trades = this.normalizeTrades(data)
        const curveInfo = this.buildCurveInfo(data)
        const benchmarkDisplay = this.buildBenchmarkDisplay(data)
        const analysisConclusion = this.buildAnalysisConclusion(data, rawMetrics)
        const source = data.data_source

        this.setData({
          result: data,
          metrics: rawMetrics,
          displayMetrics: displayMetrics,
          riskReport: riskReport,
          reportText: reportText,
          trades: trades,
          equityCurveLength: curveInfo.equityCurveLength,
          equityCurveRaw: data.equity_curve || [],
          curveSummary: curveInfo.curveSummary,
          curvePreview: curveInfo.curvePreview,
          summary: summary,
          sourceBadgeClass: sourceInfo.badgeClass,
          benchmarkAnalysis: benchmarkDisplay,
          analysisConclusion: analysisConclusion,
          showMockNotice: source === 'mock',
          showCacheNotice: source === 'cache',
          showRealNotice: source === 'akshare',
          showErrorCard: false,
          errorMessage: ''
        }, () => {
          this.drawEquityChart(data.equity_curve || [])
        })

        wx.showToast({ title: '回测成功', icon: 'success' })
      },
      fail: (err) => {
        console.error('回测请求失败：', err)
        this.setData({
          errorMessage: '请求失败，请检查网络或后端服务',
          showErrorCard: true,
          errorCardTitle: '失败原因分析',
          errorCardMessage: '当前请求未能完成，请检查网络连接或稍后重试。',
          failureAnalysis: {
            reason: '网络或服务连接异常',
            possible_causes: ['网络不稳定', '云托管服务临时不可用', '请求超时'],
            suggestions: ['稍后重试', '测试后端连接', '开启演示模式']
          }
        })
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})
