Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    subtitle: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    empty: { type: Boolean, value: false },
    emptyText: { type: String, value: '暂无数据' }
  }
})
