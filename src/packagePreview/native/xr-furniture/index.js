Component({
  properties: {
    floorScale: { type: String, value: '4 1 3' },
    cubesJson: { type: String, value: '[]' },
  },
  data: {
    cubes: [],
  },
  observers: {
    cubesJson(value) {
      let cubes = []
      try {
        const parsed = JSON.parse(value || '[]')
        if (Array.isArray(parsed)) cubes = parsed
      } catch (error) {
        cubes = []
      }
      this.setData({ cubes })
    },
  },
  methods: {
    onReady() {
      this.triggerEvent('ready')
    },
    onError() {
      this.triggerEvent('error')
    },
  },
})
