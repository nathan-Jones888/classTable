import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import * as XLSX from 'xlsx'
import './styles.css'

type Course = {
  id: string
  name: string
  code: string
  teacher: string
  classroom: string
  category: string
  weeks: number[]
  weekday: number
  startSection: number
  endSection: number
  startTime: string
  endTime: string
}

type RawRow = Record<string, unknown>

const weekdayNames = ['一', '二', '三', '四', '五', '六', '日']
const sectionTimes: Record<number, [string, string]> = {
  1: ['08:20', '09:05'], 2: ['09:10', '09:55'], 3: ['10:15', '11:00'], 4: ['11:05', '11:50'],
  5: ['14:00', '14:45'], 6: ['14:50', '15:35'], 7: ['15:55', '16:40'], 8: ['16:45', '17:30'],
  9: ['18:30', '19:15'], 10: ['19:20', '20:05'], 11: ['20:10', '20:55'],
}

const storageKey = 'songke-semester-data'
function range(start: number, end: number) { return Array.from({ length: end - start + 1 }, (_, index) => start + index) }
function loadSavedData() {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) as { courses: Course[]; firstMonday: string; fileName: string } : null
  } catch { return null }
}
function parseDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day)) }
function formatDate(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next }
function weekdayFromText(value: string) { const index = weekdayNames.findIndex((item) => value.includes(`周${item}`)); return index + 1 }
function parseWeeks(value: string) {
  const match = value.match(/(\d+)\s*-\s*(\d+)\s*周/)
  return match ? range(Number(match[1]), Number(match[2])) : []
}
function parseTimeSlots(value: string) {
  const matches = [...value.matchAll(/周([一二三四五六日天])\s*(\d+)\s*-\s*(\d+)节/g)]
  return matches.map((match) => {
    const weekday = weekdayNames.indexOf(match[1] === '天' ? '日' : match[1]) + 1
    const startSection = Number(match[2])
    const endSection = Number(match[3])
    return { weekday, startSection, endSection }
  }).filter((slot) => slot.weekday > 0)
}
function rowsToCourses(rows: RawRow[]): Course[] {
  return rows.flatMap((row, rowIndex) => {
    const schedule = String(row['上课时间'] ?? '')
    const weeks = parseWeeks(schedule)
    const slots = parseTimeSlots(schedule)
    if (!String(row['课程名称'] ?? '').trim() || !weeks.length || !slots.length) return []
    return slots.map((slot, slotIndex) => {
      const [startTime, endTime] = [sectionTimes[slot.startSection]?.[0] ?? '', sectionTimes[slot.endSection]?.[1] ?? '']
      return {
        id: `${row['课程编号'] ?? rowIndex}-${slotIndex}`,
        name: String(row['课程名称'] ?? ''), code: String(row['课程编号'] ?? ''),
        teacher: String(row['任课教师'] ?? '').replace(/\d{6,}/g, '').trim(),
        classroom: String(row['上课教室'] ?? '').replace(/\([^)]*\)/g, '').trim(),
        category: String(row['课程性质'] ?? row['课程类别'] ?? '课程').trim(), weeks,
        weekday: slot.weekday, startSection: slot.startSection, endSection: slot.endSection, startTime, endTime,
      }
    })
  })
}

function App() {
  const savedData = useMemo(() => loadSavedData(), [])
  const [courses, setCourses] = useState<Course[]>(savedData?.courses ?? [])
  const [semester, setSemester] = useState('2026-2027-1')
  const [firstMonday, setFirstMonday] = useState(savedData?.firstMonday ?? '2026-08-31')
  const [selectedDate, setSelectedDate] = useState('2026-09-21')
  const [fileName, setFileName] = useState(savedData?.fileName ?? '尚未导入课表')
  const [message, setMessage] = useState(savedData ? `已从本机恢复 ${savedData.courses.length} 条课程安排` : '请导入课程详情 Excel')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const courseToneByCode = useMemo(() => {
    const codes = [...new Set(courses.map((course) => course.code))]
    return new Map(codes.map((code, index) => [code, index % 15]))
  }, [courses])
  useEffect(() => {
    if (courses.length) localStorage.setItem(storageKey, JSON.stringify({ courses, firstMonday, fileName }))
  }, [courses, firstMonday, fileName])

  const selectedWeek = useMemo(() => {
    const start = parseDate(firstMonday)
    const current = parseDate(selectedDate)
    return Math.floor((current.getTime() - start.getTime()) / 86400000 / 7) + 1
  }, [firstMonday, selectedDate])
  const weekStart = addDays(parseDate(firstMonday), (selectedWeek - 1) * 7)
  const weekDays = weekdayNames.map((label, index) => ({ label, date: formatDate(addDays(weekStart, index)), day: index + 1 }))
  const visibleCourses = courses.filter((course) => course.weeks.includes(selectedWeek))
  const selectedWeekday = parseDate(selectedDate).getUTCDay() || 7
  const selectedDayCourses = visibleCourses.filter((course) => course.weekday === selectedWeekday)

  async function importWorkbooks(files: File[]) {
    try {
      const parsedFiles = await Promise.all(files.map(async (file) => {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })
        const headers = rows.length ? Object.keys(rows[0]) : []
        return { file, rows, isDetailSheet: headers.includes('课程名称') && headers.includes('上课时间') }
      }))
      const detailFile = parsedFiles.find((item) => item.isDetailSheet)
      if (!detailFile) throw new Error('未找到课程详情 Excel，请同时选择包含“课程名称”和“上课时间”的文件')
      const imported = rowsToCourses(detailFile.rows)
      if (!imported.length) throw new Error('课程详情 Excel 中没有找到可识别的课程数据')
      setCourses(imported)
      setFileName(files.map((file) => file.name).join('、'))
      setMessage(`已读取 ${files.length} 个文件，导入 ${imported.length} 条上课安排`)
      setSettingsOpen(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，请检查文件格式')
    }
  }

  function clearSavedData() {
    if (!window.confirm('确定清空当前课表数据吗？清空后需要重新导入 Excel。')) return
    localStorage.removeItem(storageKey)
    setCourses([])
    setFileName('尚未导入课表')
    setMessage('请导入课程详情 Excel')
    setSettingsOpen(false)
  }

  function shiftWeek(amount: number) {
    setSelectedDate(formatDate(addDays(parseDate(selectedDate), amount * 7)))
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark" aria-label="松课 Logo"><span className="logo-calendar">松</span><span className="logo-breeze" /></div>
      <div><p className="eyebrow">A CALMER WAY TO PLAN</p><h1>松课</h1></div>
      <div className="topbar-spacer" />
      <div className="settings-wrap"><button className={`settings-button ${settingsOpen ? 'is-open' : ''}`} onClick={() => setSettingsOpen((open) => !open)} aria-label="打开配置" aria-expanded={settingsOpen}>⚙</button>{settingsOpen && <div className="settings-menu"><div className="settings-title">课表配置</div><label className="settings-field">第一教学周周一<input type="date" value={firstMonday} onChange={(event) => setFirstMonday(event.target.value)} /></label><label className="settings-field">查看日期<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><div className="settings-divider" /><label className="menu-action upload-button"><span>＋</span> 导入两个 Excel<input type="file" accept=".xlsx,.xls" multiple onChange={(event) => event.target.files?.length && importWorkbooks(Array.from(event.target.files))} /></label><button className="menu-action clear-button" onClick={clearSavedData} disabled={!courses.length}>清空已保存数据</button></div>}</div>
    </header>

    <section className="hero-row">
      <div><p className="eyebrow">当前学期</p><h2>{semester}</h2><p className="muted">{fileName} · {message}</p></div>
    </section>

    <section className="week-toolbar"><button className="icon-button" onClick={() => shiftWeek(-1)} aria-label="上一周">←</button><div><span className="week-kicker">TEACHING WEEK</span><strong>第 {selectedWeek} 周</strong><span className="week-range">{weekDays[0].date} — {weekDays[6].date}</span></div><button className="icon-button" onClick={() => shiftWeek(1)} aria-label="下一周">→</button><button className="today-button" onClick={() => setSelectedDate(formatDate(new Date()))}>回到今天</button></section>

    <section className="calendar-grid">
      <div className="time-column"><div className="grid-corner">节次</div>{Object.entries(sectionTimes).map(([section, time]) => <Fragment key={section}><div className="time-cell"><b>{section.padStart(2, '0')}</b><span><i>{time[0]}</i><i>{time[1]}</i></span></div>{(section === '4' || section === '8') && <div className="section-break" />}</Fragment>)}</div>
      {weekDays.map((day) => <div className={`day-column ${day.date === selectedDate ? 'selected-day' : ''}`} key={day.date}><div className="day-heading"><span>周{day.label}</span><b>{day.date.slice(5).replace('-', '/')}</b></div><div className="day-slots">{Object.entries(sectionTimes).map(([section]) => <Fragment key={section}><div className="slot" />{(section === '4' || section === '8') && <div className="section-break" />}</Fragment>)}{visibleCourses.filter((course) => course.weekday === day.day).map((course) => <article className={`course-card course-tone-${courseToneByCode.get(course.code) ?? 0}`} style={{ '--start': course.startSection, '--span': course.endSection - course.startSection + 1, '--break-offset': course.startSection > 8 ? '28px' : course.startSection > 4 ? '14px' : '0px' } as CSSProperties} key={course.id} onClick={() => setSelectedCourse(course)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && setSelectedCourse(course)}><span className="course-code">{course.code}</span><h3>{course.name}</h3><p>{course.startTime} — {course.endTime}</p><p>{course.classroom || '教室待定'} · {course.teacher || '教师待定'}</p></article>)}</div></div>)}
    </section>

    <footer className="footer-note"><span className="status-dot" />今天{selectedDayCourses.length ? `有 ${selectedDayCourses.length} 条课程` : '无课'} · 本周共 {visibleCourses.length} 条安排</footer>
    {selectedCourse && <div className="course-modal-backdrop" role="presentation" onClick={() => setSelectedCourse(null)}><section className={`course-modal course-tone-${courseToneByCode.get(selectedCourse.code) ?? 0}`} role="dialog" aria-modal="true" aria-labelledby="course-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedCourse(null)} aria-label="关闭课程详情">×</button><span className="modal-kicker">COURSE DETAILS</span><h2 id="course-modal-title">{selectedCourse.name}</h2><p className="modal-code">{selectedCourse.code || '课程编号未提供'}</p><div className="modal-details"><div><span>上课星期</span><b>周{weekdayNames[selectedCourse.weekday - 1]}</b></div><div><span>上课节次</span><b>第 {selectedCourse.startSection}-{selectedCourse.endSection} 节</b></div><div><span>上课时间</span><b>{selectedCourse.startTime} — {selectedCourse.endTime}</b></div><div><span>上课周次</span><b>第 {selectedCourse.weeks[0]}-{selectedCourse.weeks[selectedCourse.weeks.length - 1]} 周</b></div><div><span>任课教师</span><b>{selectedCourse.teacher || '教师待定'}</b></div><div><span>上课教室</span><b>{selectedCourse.classroom || '教室待定'}</b></div></div></section></div>}
  </main>
}

export default App

const root = globalThis.__songkeRoot ?? (globalThis.__songkeRoot = createRoot(document.getElementById('root')!))
root.render(<App />)
