Component({
  properties: {
    strategy: { type: Object, value: {} },
    performance: {
      type: Object,
      value: {},
      observer() {
        this.scheduleSparkline()
      },
    },
    hasPerformance: {
      type: Boolean,
      value: false,
      observer() {
        this.scheduleSparkline()
      },
    },
  },

  lifetimes: {
    ready() {
      this.scheduleSparkline()
    },
  },

  methods: {
    scheduleSparkline() {
      if (!this.data.hasPerformance || !this.data.performance.sparklinePoints) return
      wx.nextTick(() => this.drawSparkline())
    },

    drawSparkline() {
      this.createSelectorQuery()
        .in(this)
        .select('#header-sparkline')
        .fields({ node: true, size: true })
        .exec(result => {
          const target = result && result[0]
          if (!target || !target.node) return
          const canvas = target.node
          const context = canvas.getContext('2d')
          const pixelRatio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
          canvas.width = target.width * pixelRatio
          canvas.height = target.height * pixelRatio
          context.scale(pixelRatio, pixelRatio)
          context.clearRect(0, 0, target.width, target.height)
          const points = String(this.data.performance.sparklinePoints)
            .split(' ')
            .map(item => item.split(',').map(Number))
            .filter(item => item.length === 2 && item.every(Number.isFinite))
          if (points.length < 2) return
          const gradient = context.createLinearGradient(0, 0, target.width, 0)
          gradient.addColorStop(0, '#526dff')
          gradient.addColorStop(1, '#9a5cff')
          context.beginPath()
          points.forEach((point, index) => {
            const x = point[0] / 220 * target.width
            const y = point[1] / 50 * target.height
            if (index === 0) context.moveTo(x, y)
            else context.lineTo(x, y)
          })
          context.strokeStyle = gradient
          context.lineWidth = 1.8
          context.lineCap = 'round'
          context.lineJoin = 'round'
          context.stroke()
        })
    },
  },
})
