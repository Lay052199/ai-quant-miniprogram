const {
  clearRecentStrategies,
  loadRecentStrategies,
  saveRecentStrategies,
  saveSelectedStrategy
} = require('../../../utils/storage')
const { findStrategy } = require('../../../utils/strategy-catalog')

const PERIODS = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' }
]

const SORT_MODES = [
  { key: 'time', label: '按时间排序' },
  { key: 'usage', label: '按使用次数' },
  { key: 'return', label: '按收益率' }
]

const SEED_HISTORY = [
  {
    id: 'ma-today',
    key: 'ma',
    sourceName: '双均线策略',
    name: '双均线策略',
    risk: '低风险',
    riskTone: 'low-risk',
    description: '短期均线上穿长期均线时做多，反之做空。',
    tags: ['趋势跟踪', '均线', '通用'],
    icon: '/assets/strategy/icons/ma.svg',
    groupKey: 'today',
    groupLabel: '今天',
    lastView: '13:32',
    lastBacktest: '13:31',
    sortTime: 600,
    usageCount: 18,
    returnValue: 15.2,
    periods: ['all', 'today', 'week', 'month']
  },
  {
    id: 'macd-today',
    key: 'macd',
    sourceName: 'MACD 策略',
    name: 'MACD趋势策略',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: 'MACD金叉做多，死叉做空，跟随趋势。',
    tags: ['趋势跟踪', 'MACD', '动量'],
    icon: '/assets/strategy/icons/macd.svg',
    groupKey: 'today',
    groupLabel: '今天',
    lastView: '11:45',
    lastBacktest: '11:44',
    sortTime: 590,
    usageCount: 15,
    returnValue: 18.7,
    periods: ['all', 'today', 'week', 'month']
  },
  {
    id: 'boll-today',
    key: 'boll',
    sourceName: '布林带策略',
    name: '布林带策略',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: '价格触及布林带上下轨时进行反转交易。',
    tags: ['均值回归', '布林带', '反转'],
    icon: '/assets/strategy/icons/boll.svg',
    groupKey: 'today',
    groupLabel: '今天',
    lastView: '09:18',
    lastBacktest: '09:17',
    sortTime: 580,
    usageCount: 11,
    returnValue: 11.3,
    periods: ['all', 'today', 'week', 'month']
  },
  {
    id: 'rsi-yesterday',
    key: 'rsi',
    sourceName: 'RSI 策略',
    name: 'RSI反转策略',
    risk: '低风险',
    riskTone: 'low-risk',
    description: 'RSI超买超卖区间进行反转交易。',
    tags: ['均值回归', 'RSI', '反转'],
    icon: '/assets/strategy/icons/rsi.svg',
    groupKey: 'yesterday',
    groupLabel: '昨天',
    lastView: '16:22',
    lastBacktest: '16:20',
    sortTime: 470,
    usageCount: 9,
    returnValue: 8.6,
    periods: ['all', 'week', 'month']
  },
  {
    id: 'turtle-yesterday',
    key: 'turtle',
    sourceName: '海龟交易策略',
    name: '海龟突破策略',
    risk: '高风险',
    riskTone: 'high-risk',
    description: '突破N日高点做多，突破N日低点做空。',
    tags: ['趋势跟踪', '突破', '海龟交易'],
    icon: '/assets/strategy/icons/turtle.svg',
    groupKey: 'yesterday',
    groupLabel: '昨天',
    lastView: '14:05',
    lastBacktest: '14:03',
    sortTime: 460,
    usageCount: 7,
    returnValue: 22.1,
    periods: ['all', 'week', 'month']
  },
  {
    id: 'mean-earlier',
    key: 'mean',
    sourceName: '均值回归策略',
    name: '均值回归策略',
    risk: '低风险',
    riskTone: 'low-risk',
    description: '价格偏离均值一定幅度时进行回归交易。',
    tags: ['均值回归', '统计套利', '通用'],
    icon: '/assets/strategy/icons/mean.svg',
    groupKey: 'earlier',
    groupLabel: '更早',
    lastView: '2024-05-07 21:16',
    lastBacktest: '2024-05-07 21:15',
    sortTime: 300,
    usageCount: 6,
    returnValue: 12.4,
    periods: ['all']
  }
]

const GROUP_ORDER = ['today', 'yesterday', 'earlier']

function createGroups(records, query, periodKey, sortKey) {
  const normalized = String(query || '').trim().toLowerCase()
  const filtered = records.filter(record => {
    const matchesPeriod = record.periods.includes(periodKey)
    const searchText = [record.name, record.description, record.tags.join(' ')].join(' ').toLowerCase()
    return matchesPeriod && (!normalized || searchText.includes(normalized))
  })
  const sortField = sortKey === 'usage' ? 'usageCount' : sortKey === 'return' ? 'returnValue' : 'sortTime'
  const sorted = filtered.slice().sort((left, right) => right[sortField] - left[sortField])
  return GROUP_ORDER.map(key => ({
    key,
    label: key === 'today' ? '今天' : key === 'yesterday' ? '昨天' : '更早',
    records: sorted.filter(record => record.groupKey === key)
  })).filter(group => group.records.length)
}

Page({
  data: {
    periods: PERIODS,
    selectedPeriod: 'all',
    query: '',
    sortModes: SORT_MODES,
    sortIndex: 0,
    sortLabel: SORT_MODES[0].label,
    historyRecords: [],
    visibleGroups: [],
    visibleCount: 0
  },

  onLoad() {
    const saved = loadRecentStrategies()
    const historyRecords = saved === null ? SEED_HISTORY : saved
    if (saved === null) saveRecentStrategies(historyRecords)
    this.setData({ historyRecords }, () => this.refreshGroups())
  },

  refreshGroups() {
    const sortKey = SORT_MODES[this.data.sortIndex].key
    const visibleGroups = createGroups(
      this.data.historyRecords,
      this.data.query,
      this.data.selectedPeriod,
      sortKey
    )
    const visibleCount = visibleGroups.reduce((count, group) => count + group.records.length, 0)
    this.setData({ visibleGroups, visibleCount })
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  onSearchInput(e) {
    this.setData({ query: e.detail.value || '' }, () => this.refreshGroups())
  },

  onPeriodTap(e) {
    this.setData({ selectedPeriod: e.currentTarget.dataset.key || 'all' }, () => this.refreshGroups())
  },

  onSortTap() {
    wx.showActionSheet({
      itemList: SORT_MODES.map(item => item.label.replace(/^按/, '')),
      success: result => {
        const sortIndex = result.tapIndex
        this.setData({ sortIndex, sortLabel: SORT_MODES[sortIndex].label }, () => this.refreshGroups())
      }
    })
  },

  clearHistory() {
    wx.showModal({
      title: '清空最近使用',
      content: '是否清空最近使用记录？',
      confirmText: '确认',
      confirmColor: '#526dff',
      success: result => {
        if (!result.confirm) return
        clearRecentStrategies()
        this.setData({ historyRecords: [] }, () => this.refreshGroups())
      }
    })
  },

  openStrategy(e) {
    const record = this.findRecord(e.currentTarget.dataset.id)
    if (!record) return
    wx.navigateTo({ url: '/pages/strategy/detail/index?strategy=' + record.key })
  },

  continueStrategy(e) {
    const record = this.findRecord(e.currentTarget.dataset.id)
    if (!record) return
    saveSelectedStrategy(findStrategy(record.sourceName))
    wx.switchTab({ url: '/pages/backtest/backtest' })
  },

  findRecord(id) {
    return this.data.historyRecords.find(record => record.id === id)
  },

  switchMainTab(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.switchTab({ url })
  }
})
