Page({
  data: { firstMonday: '2026-08-31', loading: false, fileNames: [] },
  onLoad() {
    const saved = wx.getStorageSync('songke_schedule')
    if (saved) this.setData({ firstMonday: saved.firstMonday })
  },
  onDateChange(event) { this.setData({ firstMonday: event.detail.value }) },
  chooseExcelFiles() {
    this.chooseOneFile('课程详情', (detailFile) => {
      this.setData({ fileNames: [detailFile.name] })
      wx.showToast({ title: '请继续选择排课安排', icon: 'none', duration: 1800 })
      this.chooseOneFile('排课安排', (scheduleFile) => {
        this.setData({ fileNames: [detailFile.name, scheduleFile.name] })
        this.parseFiles([detailFile, scheduleFile])
      })
    })
  },
  chooseOneFile(label, onSelected) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (choice) => {
        const file = choice.tempFiles && choice.tempFiles[0]
        if (!file) return wx.showToast({ title: `${label}文件未选择`, icon: 'none' })
        onSelected(file)
      },
      fail: () => wx.showToast({ title: `未选择${label}文件`, icon: 'none' }),
    })
  },
  parseFiles(files) {
    this.setData({ loading: true })
    Promise.all(files.map((file) => this.readExcel(file))).then((books) => {
      const { parseCourseDetailRows } = require('../../utils/schedule.js')
      const detailRows = books.flatMap((book) => book.rows).filter((row) => Object.prototype.hasOwnProperty.call(row, '课程名称') && Object.prototype.hasOwnProperty.call(row, '上课时间'))
      const courses = parseCourseDetailRows(detailRows, 'detail')
      if (!courses.length) throw new Error('两个 Excel 中没有识别到课程，请确认文件内容是课程详情和排课安排。')
      this.save(courses)
    }).catch((error) => wx.showModal({ title: 'Excel 解析失败', content: error.message || '请检查文件格式后重试。', showCancel: false })).finally(() => this.setData({ loading: false }))
  },
  readExcel(file) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({ filePath: file.path, encoding: 'base64', success: (result) => {
        try {
          const XLSX = require('../../miniprogram_npm/xlsx/index.js')
          const { parseExcelRows, parseScheduleHtml } = require('../../utils/schedule.js')
          const workbook = XLSX.read(result.data, { type: 'base64' })
          const courses = workbook.SheetNames.flatMap((sheetName) => {
            const sheet = workbook.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
            return [...parseScheduleHtml(XLSX.utils.sheet_to_html(sheet)), ...parseExcelRows(rows, `${file.name}-${sheetName}`)]
          })
          resolve({ name: file.name, rows: workbook.SheetNames.flatMap((sheetName) => XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })), courses })
        } catch (error) {
          const message = String(error && error.message || error)
          if (/module|xlsx|require/i.test(message)) reject(new Error('Excel 解析组件未加载，请在微信开发者工具点击“工具 → 构建 npm”后重新编译。'))
          else reject(new Error(`文件 ${file.name} 无法解析：${message}`))
        }
      }, fail: reject })
    })
  },
  uniqueCourses(courses) {
    const seen = new Set()
    return courses.filter((course) => {
      const key = [course.name, course.weekday, course.startSection, course.endSection, course.classroom].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  },
  mergeCourseDetails(courses) {
    const details = new Map(courses.filter((course) => course.code && course.name).map((course) => [course.code, course]))
    return this.uniqueCourses(courses.map((course) => ({ ...course, name: course.name || details.get(course.code)?.name || course.code || '未命名课程', teacher: course.teacher || details.get(course.code)?.teacher || '', classroom: course.classroom || details.get(course.code)?.classroom || '' })))
  },
  save(courses) {
    wx.setStorageSync('songke_schedule', { firstMonday: this.data.firstMonday, courses })
    wx.showToast({ title: `已生成 ${courses.length} 条课程`, icon: 'success' })
    setTimeout(() => wx.navigateBack(), 600)
  },
  clearSchedule() {
    wx.removeStorageSync('songke_schedule')
    this.setData({ fileNames: [] })
    wx.showToast({ title: '已清空', icon: 'success' })
  },
})
