Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    icon: { type: String, value: '' },
    actionText: { type: String, value: '' },
    tone: { type: String, value: 'default' }
  },
  methods: {
    onAction() { this.triggerEvent('action') }
  }
})
