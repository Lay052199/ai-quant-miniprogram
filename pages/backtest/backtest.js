const { checkHealth, fetchStrategies, lookupStock, runBacktest } = require('../../utils/api')
const {
  loadBacktestForm,
  loadLastStock,
  loadSelectedStrategy,
  saveBacktestForm,
  saveLastResult,
  saveLastStock
} = require('../../utils/storage')
const { FALLBACK_STRATEGIES, findStrategy } = require('../../utils/strategy-catalog')
const { normalizeStrategyKey } = require('../../utils/strategy-detail')

const PARAM_LABELS = {
  short_window: '短期均线',
  long_window: '长期均线',
  window: '观察窗口',
  threshold: '信号阈值',
  lower: '下限',
  upper: '上限',
  fast: '快速周期',
  slow: '慢速周期',
  signal_window: '信号周期',
  num_std: '标准差倍数',
  entry_z: '入场 Z 值',
  exit_z: '退出 Z 值',
  entry_window: '入场通道',
  exit_window: '退出通道',
  atr_window: 'ATR 周期',
  n: 'KDJ 周期',
  m1: 'K 平滑',
  m2: 'D 平滑'
}

function strategyFields(strategy, params) {
  return Object.keys(params).map(key => ({
    key,
    label: PARAM_LABELS[key] || key,
    value: String(params[key]),
    unit: /window|fast|slow|^n$|^m1$|^m2$/.test(key) ? '日' : ''
  }))
}

function calculatePeriodSummary(startDate, endDate) {
  const start = new Date(String(startDate || '') + 'T00:00:00')
  const end = new Date(String(endDate || '') + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { periodDays: '--', periodYears: '--' }
  }
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
  return {
    periodDays: String(days),
    periodYears: '≈' + (days / 365.25).toFixed(2) + ' 年'
  }
}

function formatMoney(value) {
  const raw = String(value || '').replace(/,/g, '').replace(/[^\d.]/g, '')
  if (!raw) return ''
  const parts = raw.split('.')
  const integer = parts.shift().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length ? integer + '.' + parts.join('') : integer
}

function parameterTitle(strategy) {
  return strategy && strategy.name === '双均线策略'
    ? '均线参数'
    : String((strategy && strategy.name) || '策略').replace(/策略$/, '') + '参数'
}

const DEFAULT_PERIOD = calculatePeriodSummary('2023-01-01', '2024-12-31')

Page({
  data: {
    symbol: '000001',
    stockInfo: null,
    stockStatus: 'idle',
    stockMessage: '输入六位代码后自动识别个股',
    startDateDisplay: '2023-01-01',
    endDateDisplay: '2024-12-31',
    strategies: FALLBACK_STRATEGIES,
    strategyNames: FALLBACK_STRATEGIES.map(item => item.name),
    strategyIndex: 0,
    strategy: FALLBACK_STRATEGIES[0],
    strategyParams: FALLBACK_STRATEGIES[0].defaultParams,
    paramFields: strategyFields(FALLBACK_STRATEGIES[0], FALLBACK_STRATEGIES[0].defaultParams),
    parameterSectionTitle: parameterTitle(FALLBACK_STRATEGIES[0]),
    initialCash: '100000',
    initialCashDisplay: '100,000',
    commissionRate: '0.0003',
    slippageRate: '0.0002',
    periodDays: DEFAULT_PERIOD.periodDays,
    periodYears: DEFAULT_PERIOD.periodYears,
    stockChangeDisplay: '+1.23%',
    loading: false,
    errorMessage: ''
  },

  onLoad() {
    this.restoreBacktestForm()
    this.loadStrategyCatalog()
    const cachedStock = loadLastStock()
    if (cachedStock && cachedStock.symbol === this.data.symbol) {
      this.setData({ stockInfo: cachedStock, stockStatus: 'success', stockMessage: '已从本地记录恢复' })
    } else {
      this.resolveStock()
    }
    this.persistBacktestForm()
  },

  restoreBacktestForm() {
    const saved = loadBacktestForm()
    if (!saved) return
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(saved.startDate || ''))
      ? saved.startDate : this.data.startDateDisplay
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(saved.endDate || ''))
      ? saved.endDate : this.data.endDateDisplay
    const initialCash = String(saved.initialCash || this.data.initialCash)
    this.setData({
      symbol: /^\d{6}$/.test(String(saved.symbol || '')) ? String(saved.symbol) : this.data.symbol,
      startDateDisplay: startDate,
      endDateDisplay: endDate,
      initialCash,
      initialCashDisplay: formatMoney(initialCash),
      commissionRate: String(saved.commissionRate === undefined ? this.data.commissionRate : saved.commissionRate),
      slippageRate: String(saved.slippageRate === undefined ? this.data.slippageRate : saved.slippageRate)
    }, () => {
      this.updatePeriodSummary()
      if (saved.strategyName) this.applyStrategy(saved.strategyName, saved.strategyParams)
    })
  },

  onShow() {
    const selected = loadSelectedStrategy()
    if (selected && selected.name && selected.name !== this.data.strategy.name) {
      this.applyStrategy(selected.name, selected.defaultParams || selected.default_params)
    }
  },

  async loadStrategyCatalog() {
    try {
      const data = await fetchStrategies()
      const remote = Array.isArray(data.strategies) ? data.strategies : []
      if (!remote.length) return
      const strategies = remote.map(item => {
        const fallback = findStrategy(item.name)
        return {
          ...fallback,
          ...item,
          defaultParams: item.default_params || fallback.defaultParams
        }
      })
      this.setData({ strategies, strategyNames: strategies.map(item => item.name) })
    } catch (error) {
      this.setData({ strategies: FALLBACK_STRATEGIES, strategyNames: FALLBACK_STRATEGIES.map(item => item.name) })
    }
  },

  onSymbolInput(e) {
    this.setData({
      symbol: e.detail.value.replace(/\D/g, '').slice(0, 6),
      stockInfo: null,
      stockStatus: 'idle',
      stockMessage: '输入完成后自动识别'
    }, () => this.persistBacktestForm())
  },

  async resolveStock() {
    const symbol = String(this.data.symbol || '').trim()
    if (!/^\d{6}$/.test(symbol)) {
      this.setData({ stockStatus: 'error', stockMessage: '请输入六位股票代码', stockInfo: null })
      return
    }
    this.setData({ stockStatus: 'loading', stockMessage: '正在识别…' })
    try {
      const stock = await lookupStock(symbol)
      const validStock = stock.success && stock.asset_type === 'stock'
      this.setData({
        stockInfo: validStock ? stock : null,
        stockStatus: validStock ? 'success' : 'error',
        stockMessage: stock.message || (validStock ? '识别成功' : '当前版本仅支持 A 股个股')
      })
      if (validStock) saveLastStock(stock)
      this.persistBacktestForm()
    } catch (error) {
      this.setData({ stockStatus: 'error', stockMessage: error.message, stockInfo: null })
    }
  },

  onStartDateChange(e) {
    this.setData({ startDateDisplay: e.detail.value }, () => {
      this.updatePeriodSummary()
      this.persistBacktestForm()
    })
  },

  onEndDateChange(e) {
    this.setData({ endDateDisplay: e.detail.value }, () => {
      this.updatePeriodSummary()
      this.persistBacktestForm()
    })
  },

  updatePeriodSummary() {
    this.setData(calculatePeriodSummary(this.data.startDateDisplay, this.data.endDateDisplay))
  },

  onStrategyChange(e) {
    const index = Number(e.detail.value)
    const selected = this.data.strategies[index] || this.data.strategies[0]
    this.applyStrategy(selected.name, selected.defaultParams || selected.default_params)
  },

  applyStrategy(name, params) {
    const index = Math.max(0, this.data.strategies.findIndex(item => item.name === name))
    const selected = this.data.strategies[index] || findStrategy(name)
    const strategyParams = { ...(params || selected.defaultParams || selected.default_params || {}) }
    this.setData({
      strategyIndex: index,
      strategy: selected,
      strategyParams,
      paramFields: strategyFields(selected, strategyParams),
      parameterSectionTitle: parameterTitle(selected)
    }, () => this.persistBacktestForm())
  },

  onParamInput(e) {
    const key = e.currentTarget.dataset.param
    const value = e.detail.value
    const strategyParams = { ...this.data.strategyParams, [key]: value }
    const paramFields = this.data.paramFields.map(item => item.key === key ? { ...item, value } : item)
    this.setData({ strategyParams, paramFields }, () => this.persistBacktestForm())
  },

  onInitialCashInput(e) {
    const initialCash = String(e.detail.value || '').replace(/,/g, '').replace(/[^\d.]/g, '')
    this.setData({ initialCash, initialCashDisplay: formatMoney(initialCash) }, () => this.persistBacktestForm())
  },
  onCommissionInput(e) {
    this.setData({ commissionRate: e.detail.value }, () => this.persistBacktestForm())
  },
  onSlippageInput(e) {
    this.setData({ slippageRate: e.detail.value }, () => this.persistBacktestForm())
  },

  persistBacktestForm() {
    saveBacktestForm({
      symbol: this.data.symbol,
      startDate: this.data.startDateDisplay,
      endDate: this.data.endDateDisplay,
      strategyKey: normalizeStrategyKey(this.data.strategy.name),
      strategyName: this.data.strategy.name,
      strategyParams: { ...this.data.strategyParams },
      initialCash: this.data.initialCash,
      commissionRate: this.data.commissionRate,
      slippageRate: this.data.slippageRate
    })
  },

  buildPayload() {
    const strategyParams = {}
    Object.keys(this.data.strategyParams).forEach(key => {
      const raw = this.data.strategyParams[key]
      strategyParams[key] = raw === '' ? raw : Number(raw)
    })
    return {
      symbol: this.data.symbol,
      start_date: this.data.startDateDisplay.replace(/-/g, ''),
      end_date: this.data.endDateDisplay.replace(/-/g, ''),
      strategy: this.data.strategy.name,
      initial_cash: Number(this.data.initialCash),
      commission_rate: Number(this.data.commissionRate),
      slippage_rate: Number(this.data.slippageRate),
      strategy_params: strategyParams,
      demo_mode: false,
      allow_mock: true
    }
  },

  async startBacktest() {
    const canStart = this.data.stockInfo && this.data.stockInfo.asset_type === 'stock'
    if (!canStart) {
      wx.showToast({ title: '请先识别有效个股', icon: 'none' })
      return
    }
    const payload = this.buildPayload()
    this.setData({ loading: true, errorMessage: '' })
    try {
      const data = await runBacktest(payload)
      if (data.success === false) throw new Error(data.message || '回测未成功')
      saveLastResult(data, payload, this.data.stockInfo)
      wx.switchTab({ url: '/pages/results/results' })
    } catch (error) {
      this.setData({ errorMessage: error.message || '回测失败，请稍后重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async testHealth() {
    try {
      await checkHealth()
      wx.showToast({ title: '后端连接成功', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  openStrategyLibrary() {
    wx.switchTab({ url: '/pages/strategies/strategies' })
  }
})
