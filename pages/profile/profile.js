const { checkHealth } = require('../../utils/api')
const { loadLastResultTime } = require('../../utils/storage')

Page({
  data: {
    healthStatus: '未检查',
    resultTime: '暂无'
  },

  onShow() {
    const value = loadLastResultTime()
    this.setData({ resultTime: value ? value.replace('T', ' ').slice(0, 19) : '暂无' })
  },

  async checkService() {
    this.setData({ healthStatus: '检查中…' })
    try {
      await checkHealth()
      this.setData({ healthStatus: '连接正常' })
    } catch (error) {
      this.setData({ healthStatus: '连接失败：' + error.message })
    }
  }
})
