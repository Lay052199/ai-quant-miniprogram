const API_BASE_URL = 'https://ai-quant-api-262511-5-1437199254.sh.run.tcloudbase.com'

function parseResponseData(data) {
  let value = data
  if (value && value.body) value = value.body
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch (error) {
      throw new Error('服务返回了无法识别的数据')
    }
  }
  return value || {}
}

function request({ url, method = 'GET', data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE_URL + url,
      method,
      data,
      timeout: 30000,
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(parseResponseData(res.data))
          } catch (error) {
            reject(error)
          }
          return
        }
        reject(new Error('服务返回异常（' + res.statusCode + '）'))
      },
      fail: () => reject(new Error('网络连接失败，请检查云端服务'))
    })
  })
}

function lookupStock(symbol) {
  const normalized = String(symbol || '').trim()
  if (!/^\d{6}$/.test(normalized)) {
    return Promise.reject(new Error('请输入六位股票代码'))
  }
  return request({ url: '/api/stocks/' + normalized })
}

function fetchStrategies() {
  return request({ url: '/api/strategies' })
}

function checkHealth() {
  return request({ url: '/health' })
}

function runBacktest(payload) {
  return request({ url: '/api/backtest', method: 'POST', data: payload })
}

function runSensitivity(payload) {
  return request({ url: '/api/sensitivity', method: 'POST', data: payload })
}

module.exports = {
  API_BASE_URL,
  checkHealth,
  fetchStrategies,
  lookupStock,
  runBacktest,
  runSensitivity
}
