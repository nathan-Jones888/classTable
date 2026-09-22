App({
  globalData: {
    semester: '2026-2027-1',
  },
  onLaunch() {
    const saved = wx.getStorageSync('songke_schedule')
    if (!saved) {
      wx.setStorageSync('songke_schedule', {
        firstMonday: '2026-08-31',
        courses: require('./data/sample').courses,
      })
    }
  },
})
