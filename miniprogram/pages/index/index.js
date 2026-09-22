const { addDays, formatDate, parseDate } = require('../../utils/schedule.js')

const labels = ['一', '二', '三', '四', '五', '六', '日']
const sections = [
  { number: '01', time: '08:20', end: '09:05', break: false }, { number: '02', time: '09:10', end: '09:55', break: false },
  { number: '03', time: '10:15', end: '11:00', break: false }, { number: '04', time: '11:05', end: '11:50', break: true },
  { number: '05', time: '14:00', end: '14:45', break: false }, { number: '06', time: '14:50', end: '15:35', break: false },
  { number: '07', time: '15:55', end: '16:40', break: false }, { number: '08', time: '16:45', end: '17:30', break: true },
  { number: '09', time: '18:30', end: '19:15', break: false }, { number: '10', time: '19:20', end: '20:05', break: false }, { number: '11', time: '20:10', end: '20:55', break: false },
]

Page({
  data: { semester: getApp().globalData.semester, firstMonday: '2026-08-31', selectedDate: '2026-09-01', week: 1, weekDays: [], labels, sections, courses: [], weekCourseCount: 0, todaySummary: '今日无课', selectedCourse: null },
  onShow() { this.loadSchedule() },
  loadSchedule() {
    const saved = wx.getStorageSync('songke_schedule') || { firstMonday: '2026-08-31', courses: [] }
    this.setData({ firstMonday: saved.firstMonday, courses: saved.courses || [] }, () => this.renderWeek())
  },
  renderWeek() {
    const start = parseDate(this.data.firstMonday)
    const current = parseDate(this.data.selectedDate)
    const week = Math.floor((current - start) / 86400000 / 7) + 1
    const monday = addDays(this.data.firstMonday, (week - 1) * 7)
    const courseKeys = [...new Set(this.data.courses.map((course) => course.code || course.name))]
    const toneByCourse = new Map(courseKeys.map((key, index) => [key, index % 8]))
    const weekDays = labels.map((label, index) => {
      const date = addDays(monday, index)
      const courses = this.data.courses.filter((course) => course.weekday === index + 1 && course.weeks.indexOf(week) > -1).map((course) => ({ ...course, classDate: date, startTime: sections[course.startSection - 1]?.time || '', endTime: sections[course.endSection - 1]?.end || '', tone: toneByCourse.get(course.code || course.name) ?? 0, top: (course.startSection - 1) * 84 + (course.startSection > 8 ? 28 : course.startSection > 4 ? 14 : 0) + 6, height: (course.endSection - course.startSection + 1) * 84 - 12 }))
      return { label, date, shortDate: date.slice(5).replace('-', '/'), selected: date === this.data.selectedDate, courses }
    })
    const selectedDay = weekDays.find((day) => day.selected)
    this.setData({ week, weekDays, weekCourseCount: weekDays.reduce((sum, day) => sum + day.courses.length, 0), todaySummary: selectedDay && selectedDay.courses.length ? `今日 ${selectedDay.courses.length} 条课程` : '今日无课' })
  },
  shiftWeek(amount) { this.setData({ selectedDate: addDays(this.data.selectedDate, amount * 7) }, () => this.renderWeek()) },
  previousWeek() { this.shiftWeek(-1) }, nextWeek() { this.shiftWeek(1) },
  goToday() { this.setData({ selectedDate: formatDate(new Date()) }, () => this.renderWeek()) },
  openCourse(event) { this.setData({ selectedCourse: event.currentTarget.dataset.course }) },
  closeCourse() { this.setData({ selectedCourse: null }) },
  noop() {},
  openSetup() {
    wx.navigateTo({
      url: '/packageSetup/pages/setup/setup',
      fail: (error) => wx.showModal({ title: '配置页打开失败', content: error.errMsg || '请重新编译小程序', showCancel: false }),
    })
  },
})
