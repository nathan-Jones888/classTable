function pad(number) { return String(number).padStart(2, '0') }

function parseDate(value) {
  const parts = String(value).split('-').map(Number)
  return new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1))
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(value, days) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDate(date)
}

function parseWeeks(value) {
  const match = String(value).match(/(\d+)\s*[-至]\s*(\d+)\s*周/)
  if (match) return Array.from({ length: Number(match[2]) - Number(match[1]) + 1 }, (_, index) => Number(match[1]) + index)
  const single = String(value).match(/第?\s*(\d+)\s*周/)
  return single ? [Number(single[1])] : []
}

function parseWeekday(value) {
  const match = String(value).match(/(?:周|星期)([一二三四五六日天1-7])/)
  if (!match) return 0
  if (/\d/.test(match[1])) return Number(match[1])
  return '一二三四五六日'.indexOf(match[1] === '天' ? '日' : match[1]) + 1
}

function parseSections(value) {
  const match = String(value).match(/(?:第\s*)?(\d+)\s*[-至~]\s*(\d+)\s*节/)
  return match ? { startSection: Number(match[1]), endSection: Number(match[2]) } : null
}

function parseCourseDetailRows(rows, sourceName = 'detail') {
  return rows.flatMap((row, rowIndex) => {
    const schedule = String(row['上课时间'] ?? '')
    const weeks = parseWeeks(schedule)
    const slots = [...schedule.matchAll(/(?:周|星期)([一二三四五六日天])\s*(\d+)\s*[-至~]\s*(\d+)\s*节/g)].map((match) => ({ weekday: parseWeekday(`${match[0]}`), startSection: Number(match[2]), endSection: Number(match[3]) })).filter((slot) => slot.weekday > 0)
    const name = String(row['课程名称'] ?? '').trim()
    if (!name || !weeks.length || !slots.length) return []
    return slots.map((slot, slotIndex) => ({
      id: `${sourceName}-${row['课程编号'] ?? rowIndex}-${slotIndex}`,
      name, code: String(row['课程编号'] ?? ''),
      teacher: String(row['任课教师'] ?? '').replace(/\d{6,}/g, '').trim(),
      classroom: String(row['上课地点'] ?? row['上课教室'] ?? row['地点'] ?? '').replace(/\([^)]*\)/g, '').trim(),
      category: String(row['课程性质'] ?? row['课程类别'] ?? '课程').trim(), weeks,
      weekday: slot.weekday, startSection: slot.startSection, endSection: slot.endSection,
    }))
  })
}

function parseExcelRows(rows, sourceName = 'excel') {
  return rows.flatMap((row, rowIndex) => {
    const entries = Object.entries(row).map(([key, value]) => `${key}:${String(value ?? '').trim()}`).filter((item) => !item.endsWith(':'))
    const text = entries.join(' | ')
    const code = (text.match(/\b([A-Z]\d{6})\b/i) || [])[1] || ''
    const nameEntry = Object.entries(row).find(([key]) => /课程名称|课程名|课程(?!编号)/.test(key))
    const name = nameEntry ? String(nameEntry[1] || '').trim() : (code ? text.split(code)[1]?.split(/[|：:]/)[0].trim() : '')
    const parsed = parseScheduleText(`${name || code || text} | ${text}`)
    return parsed.map((course, index) => ({ ...course, code: course.code || code, name: name || (code ? '' : course.name), id: `${sourceName}-${rowIndex}-${index}` }))
  })
}

function parseScheduleText(text) {
  const rows = String(text).split(/\n|<tr[^>]*>/i).map((row) => row.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  return rows.flatMap((row, index) => {
    const weeks = parseWeeks(row)
    const weekday = parseWeekday(row)
    const sections = parseSections(row)
    if (!weeks.length || !weekday || !sections) return []
    const name = row.split(/[|,，;；]/)[0].replace(/^(课程名称|课程)[:：]?/, '').trim()
    if (!name || /^(周次|上课时间)/.test(name)) return []
    const classroom = (row.match(/(?:教室|地点)[:：]?\s*([^|,，;； ]+)/) || [])[1] || ''
    const teacher = (row.match(/(?:教师|老师)[:：]?\s*([^|,，;； ]+)/) || [])[1] || ''
    return [{ id: `parsed-${index}`, name, code: '', teacher, classroom, category: '课程', weeks, weekday, ...sections }]
  })
}

function decodeHtml(value) {
  return String(value).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()
}

function parseScheduleHtml(html) {
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  const parsedRows = rows.map((rowMatch) => [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1])))
  const headerIndex = parsedRows.findIndex((cells) => cells.some((cell) => /(?:周|星期)[一二三四五六日天1-7]/.test(cell)))
  const header = headerIndex >= 0 ? parsedRows[headerIndex] : []
  const weekdayColumns = new Map()
  header.forEach((cell, index) => {
    const match = cell.match(/(?:周|星期)([一二三四五六日天1-7])/)
    if (match) weekdayColumns.set(index, parseWeekday(match[0]))
  })
  const firstDataRow = headerIndex >= 0 ? headerIndex + 1 : 1
  return parsedRows.slice(firstDataRow).flatMap((cells, rowIndex) => {
    const section = Number(((cells[0] || '').match(/\b(\d{1,2})\b/) || [])[1] || rowIndex + 1)
    return cells.slice(1).flatMap((cell, cellIndex) => String(cell).split(/(?=[A-Z]\d{5,8}\b)/).filter((block) => /^[A-Z]\d{5,8}\b/.test(block.trim())).flatMap((block, blockIndex) => {
      const match = block.match(/^([A-Z]\d{5,8})\s+([^\n|]+)/)
      const weeks = parseWeeks(block)
      if (!match || !weeks.length) return []
      const columnIndex = cellIndex + 1
      const weekday = weekdayColumns.get(columnIndex) || columnIndex
      return [{ id: `file-${weekday}-${section}-${blockIndex}`, name: match[2].replace(/\s+\d+\s*[-至~]\s*\d+\s*周[\s\S]*$/, '').trim(), code: match[1], teacher: '', classroom: '', category: '课程', weeks, weekday, startSection: section, endSection: section }]
    }))
  })
}

module.exports = { addDays, formatDate, formatLocalDate, parseCourseDetailRows, parseDate, parseExcelRows, parseScheduleHtml, parseScheduleText }
