const courses = [
  { id: 'math', name: '高等数学 A', code: '1001', teacher: '林老师', classroom: '东 101', category: '必修', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], weekday: 1, startSection: 1, endSection: 2 },
  { id: 'design', name: '交互设计基础', code: '2042', teacher: '周老师', classroom: '艺 203', category: '专业课', weeks: [1, 2, 3, 4, 5, 6, 7, 8], weekday: 2, startSection: 3, endSection: 4 },
  { id: 'english', name: '大学英语 III', code: '3018', teacher: 'Miller', classroom: '外语楼 106', category: '必修', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], weekday: 3, startSection: 5, endSection: 6 },
  { id: 'history', name: '设计史论', code: '4013', teacher: '陈老师', classroom: '南 402', category: '选修', weeks: [2, 4, 6, 8, 10], weekday: 4, startSection: 7, endSection: 8 },
  { id: 'studio', name: '工作室实践', code: '5099', teacher: '王老师', classroom: '创意工坊', category: '实践', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], weekday: 5, startSection: 9, endSection: 11 },
]

module.exports = { courses }
