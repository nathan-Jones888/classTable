Page({
  data: { loginUrl: 'https://etbum.v.chaoxing.com/manage?ws=2', currentUrl: '' },
  onLoad(options) { if (options.url) this.setData({ loginUrl: decodeURIComponent(options.url) }) },
  onWebLoad(event) { if (event.detail && event.detail.src) this.setData({ currentUrl: event.detail.src }) },
  backToImport() { wx.navigateBack() },
})
