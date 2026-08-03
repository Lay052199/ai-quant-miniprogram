const { fetchStrategies } = require('../../utils/api')
const { saveSelectedStrategy } = require('../../utils/storage')
const { FALLBACK_STRATEGIES, findStrategy } = require('../../utils/strategy-catalog')

const CATEGORY_TABS = [
  { key: 'all', label: '全部' },
  { key: 'trend', label: '趋势' },
  { key: 'mean', label: '均值回归' },
  { key: 'breakout', label: '突破' },
  { key: 'volume', label: '量价' },
  { key: 'ai', label: 'AI推荐', hot: true }
]

const STRATEGY_PRESENTATIONS = [
  {
    key: 'ma',
    sourceNames: ['双均线策略'],
    name: '双均线策略',
    icon: '/assets/icons/strategy-ma.svg',
    risk: '低风险',
    riskTone: 'low-risk',
    description: '短期均线上穿长期均线时做多，反之做空。',
    market: '趋势行情',
    tags: ['趋势跟踪', '均线', '通用'],
    referenceReturn: '+15.2%',
    drawdown: '9.8%',
    frequency: '中等'
  },
  {
    key: 'boll',
    sourceNames: ['布林带策略'],
    name: '布林带策略',
    icon: '/assets/icons/strategy-boll.svg',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: '价格触及布林带上下轨时进行反转交易。',
    market: '震荡行情',
    tags: ['均值回归', '布林带', '反转'],
    referenceReturn: '+11.3%',
    drawdown: '11.7%',
    frequency: '高频'
  },
  {
    key: 'macd',
    sourceNames: ['MACD 策略', 'MACD趋势策略'],
    name: 'MACD趋势策略',
    icon: '/assets/icons/strategy-macd.svg',
    risk: '中风险',
    riskTone: 'medium-risk',
    description: 'MACD金叉做多，死叉做空，跟随趋势。',
    market: '趋势行情',
    tags: ['趋势跟踪', 'MACD', '动量'],
    referenceReturn: '+18.7%',
    drawdown: '13.2%',
    frequency: '中等'
  },
  {
    key: 'rsi',
    sourceNames: ['RSI 策略', 'RSI反转策略'],
    name: 'RSI反转策略',
    icon: '/assets/icons/strategy-rsi.svg',
    risk: '低风险',
    riskTone: 'low-risk',
    description: 'RSI超买超卖区间进行反转交易。',
    market: '震荡行情',
    tags: ['均值回归', 'RSI', '反转'],
    referenceReturn: '+8.6%',
    drawdown: '8.6%',
    frequency: '高频'
  },
  {
    key: 'turtle',
    sourceNames: ['海龟交易策略', '海龟突破策略'],
    name: '海龟突破策略',
    icon: '/assets/icons/strategy-turtle.svg',
    risk: '高风险',
    riskTone: 'high-risk',
    description: '突破N日高点做多，突破N日低点做空。',
    market: '趋势行情',
    tags: ['突破', '趋势跟踪', '海龟交易'],
    referenceReturn: '+22.1%',
    drawdown: '18.4%',
    frequency: '低频'
  }
]

const RECENT_STRATEGIES = [
  { key: 'ma', name: '双均线策略', time: '2024-05-10 22:18' },
  { key: 'macd', name: 'MACD趋势策略', time: '2024-05-09 15:42' },
  { key: 'boll', name: '布林带策略', time: '2024-05-08 11:05' }
]

function findSourceStrategy(strategies, sourceNames) {
  const source = strategies.find(item => sourceNames.includes(item.name))
  return source || findStrategy(sourceNames[0])
}

function buildStrategyCards(strategies, favorites = {}) {
  return STRATEGY_PRESENTATIONS.map(presentation => {
    const source = findSourceStrategy(strategies, presentation.sourceNames)
    return {
      ...presentation,
      source,
      sourceName: source.name,
      favorite: Boolean(favorites[presentation.key]),
      searchText: [
        presentation.name,
        presentation.description,
        presentation.market,
        presentation.tags.join(' ')
      ].join(' ').toLowerCase()
    }
  })
}

function filterCards(cards, query) {
  const normalized = String(query || '').trim().toLowerCase()
  if (!normalized) return cards
  return cards.filter(card => card.searchText.includes(normalized))
}

Page({
  data: {
    categories: CATEGORY_TABS,
    selectedCategory: 'all',
    categoryNotice: '',
    searchQuery: '',
    strategies: FALLBACK_STRATEGIES,
    strategyCards: buildStrategyCards(FALLBACK_STRATEGIES),
    visibleCards: buildStrategyCards(FALLBACK_STRATEGIES),
    featuredStrategy: {
      ...STRATEGY_PRESENTATIONS[0],
      featureTags: ['趋势跟踪', '易上手', '通用性强']
    },
    recentStrategies: RECENT_STRATEGIES,
    offline: false
  },

  async onLoad() {
    try {
      const data = await fetchStrategies()
      const remote = Array.isArray(data.strategies) ? data.strategies : []
      if (!remote.length) throw new Error('empty')
      const strategies = remote.map(item => {
        const fallback = findStrategy(item.name)
        return { ...fallback, ...item, defaultParams: item.default_params || fallback.defaultParams }
      })
      this.applyStrategyData(strategies, false)
    } catch (error) {
      this.applyStrategyData(FALLBACK_STRATEGIES, true)
    }
  },

  applyStrategyData(strategies, offline) {
    const favorites = this.data.strategyCards.reduce((result, item) => {
      result[item.key] = item.favorite
      return result
    }, {})
    const strategyCards = buildStrategyCards(strategies, favorites)
    this.setData({
      strategies,
      offline,
      strategyCards,
      visibleCards: filterCards(strategyCards, this.data.searchQuery)
    })
  },

  onSearchInput(e) {
    const searchQuery = e.detail.value || ''
    this.setData({
      searchQuery,
      visibleCards: filterCards(this.data.strategyCards, searchQuery)
    })
  },

  onCategoryTap(e) {
    const selectedCategory = e.currentTarget.dataset.key || 'all'
    this.setData({
      selectedCategory,
      categoryNotice: selectedCategory === 'all' ? '' : '当前分类内容将在后续版本完善，暂时展示全部策略。'
    })
  },

  onFilterTap() {
    wx.showToast({ title: '可使用上方分类快速筛选', icon: 'none' })
  },

  openRecentHistory() {
    wx.navigateTo({ url: '/pages/strategy/history/history' })
  },

  openStrategyDetail(e) {
    const key = e.currentTarget.dataset.key || 'ma'
    wx.navigateTo({ url: '/pages/strategy/detail/index?strategy=' + key })
  },

  toggleFavorite(e) {
    const key = e.currentTarget.dataset.key
    const strategyCards = this.data.strategyCards.map(card => (
      card.key === key ? { ...card, favorite: !card.favorite } : card
    ))
    this.setData({
      strategyCards,
      visibleCards: filterCards(strategyCards, this.data.searchQuery)
    })
  },

  useStrategy(e) {
    const key = e.currentTarget.dataset.key || 'ma'
    const card = this.data.strategyCards.find(item => item.key === key) || this.data.strategyCards[0]
    saveSelectedStrategy(card.source)
    wx.switchTab({ url: '/pages/backtest/backtest' })
  }
})
