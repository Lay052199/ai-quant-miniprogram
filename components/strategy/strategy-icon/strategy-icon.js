Component({
  properties: {
    src: { type: String, value: '/assets/strategy/icons/ma.svg' },
    size: { type: Number, value: 80 }
  },
  methods: {
    onError() { this.setData({ src: '/assets/strategy/icons/ma.svg' }) }
  }
})
