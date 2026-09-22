const http = require('http')
const https = require('https')
const { URL } = require('url')

const REQUEST_TIMEOUT = 15000
const MAX_BODY_SIZE = 5 * 1024 * 1024

function fail(message, code = 'PARSE_FAILED') {
  const error = new Error(message)
  error.code = code
  return error
}

function decodeHtml(value) {
  return String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(?:td|th)>/gi, ' | ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim()
}

function parseWeeks(value) {
  const match = String(value).match(/(\d+)\s*[-至~]\s*(\d+)\s*周/)
  if (match) return Array.from({ length: Number(match[2]) - Number(match[1]) + 1 }, (_, index) => Number(match[1]) + index)
  const single = String(value).match(/第?\s*(\d+)\s*周/)
  return single ? [Number(single[1])] : []
}

function parseWeekday(value) {
  const match = String(value).match(/周([一二三四五六日天1-7])/)
  if (!match) return 0
  if (/\d/.test(match[1])) return Number(match[1])
  return '一二三四五六日'.indexOf(match[1] === '天' ? '日' : match[1]) + 1
}

function parseSections(value) {
  const match = String(value).match(/(?:第\s*)?(\d+)\s*[-至~]\s*(\d+)\s*节/)
  return match ? { startSection: Number(match[1]), endSection: Number(match[2]) } : null
}

function parseScheduleText(text) {
  const rows = String(text).split(/\n|<tr[^>]*>/i).map(decodeHtml).filter(Boolean)
  return rows.flatMap((row, index) => {
    const weeks = parseWeeks(row)
    const weekday = parseWeekday(row)
    const sections = parseSections(row)
    if (!weeks.length || !weekday || !sections) return []
    const fields = row.split(/[|,，;；]/).map((field) => field.trim()).filter(Boolean)
    const name = (fields[0] || '').replace(/^(课程名称|课程)[:：]?/, '').trim()
    if (!name || /^(周次|上课时间|星期)/.test(name)) return []
    const classroom = (row.match(/(?:教室|地点|上课地点)[:：]?\s*([^|,，;； ]+)/) || [])[1] || ''
    const teacher = (row.match(/(?:教师|老师|任课教师)[:：]?\s*([^|,，;； ]+)/) || [])[1] || ''
    return [{ id: `remote-${index}`, name, code: '', teacher, classroom, category: '课程', weeks, weekday, ...sections }]
  })
}

function parseCourseBlocks(text, weekday, section) {
  const blocks = String(text).split(/(?=[A-Z]\d{6}\b)/).filter((block) => /^[A-Z]\d{6}\b/.test(block.trim()))
  return blocks.flatMap((block, index) => {
    const codeMatch = block.match(/^([A-Z]\d{6})\s+([^\n|]+)/)
    const weeks = parseWeeks(block)
    if (!codeMatch || !weeks.length) return []
    const name = codeMatch[2].replace(/\s+(?=20\d{2})[\s\S]*$/, '').replace(/\s+\d+\s*[-至~]\s*\d+\s*周[\s\S]*$/, '').trim()
    const roomCandidates = block.match(/\b\d+-\d+\b/g) || []
    const classroom = (block.match(/(?:教室|地点|上课地点)[:：]?\s*([\w-]+(?:\s*[A-Z]?\d+)?)/i) || [])[1] || roomCandidates.find((room) => !new RegExp(`${room}\\s*周`).test(block)) || ''
    const teacher = (block.match(/(?:教师|老师|任课教师)[:：]?\s*([^\n|]+)/) || [])[1] || ''
    return [{ id: `table-${weekday}-${section}-${index}`, name, code: codeMatch[1], teacher: teacher.trim(), classroom: classroom.trim(), category: '课程', weeks, weekday, startSection: section, endSection: section }]
  })
}

function parseScheduleHtml(html) {
  const rows = [...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (!rows.length) return []
  return rows.slice(1).flatMap((rowMatch, rowIndex) => {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[1]))
    const sectionMatch = (cells[0] || '').match(/\b(\d{1,2})\b/)
    const section = sectionMatch ? Number(sectionMatch[1]) : rowIndex + 1
    return cells.slice(1).flatMap((cell, cellIndex) => parseCourseBlocks(cell, cellIndex + 1, section))
  })
}

function uniqueCourses(courses) {
  const seen = new Set()
  return courses.filter((course) => {
    const key = [course.name, course.weekday, course.startSection, course.endSection, course.classroom].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cookieHeader(setCookie = []) { return setCookie.map((cookie) => cookie.split(';')[0]).join('; ') }

function requestPage(target, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(fail('教务系统重定向次数过多', 'TOO_MANY_REDIRECTS'))
    const url = new URL(target)
    if (!['http:', 'https:'].includes(url.protocol)) return reject(fail('只支持 HTTP 或 HTTPS 教务系统地址', 'INVALID_URL'))
    const client = url.protocol === 'https:' ? https : http
    const request = client.request(url, { method: options.method || 'GET', headers: { 'User-Agent': 'SongkeSchedule/1.0', Accept: 'text/html,application/xhtml+xml', ...(options.headers || {}) } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume()
        return resolve(requestPage(new URL(response.headers.location, url).toString(), options, redirects + 1))
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => { size += chunk.length; if (size <= MAX_BODY_SIZE) chunks.push(chunk) })
      response.on('end', () => resolve({ url: url.toString(), statusCode: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.setTimeout(REQUEST_TIMEOUT, () => request.destroy(fail('教务系统响应超时', 'UPSTREAM_TIMEOUT')))
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

function formDetails(html, baseUrl) {
  const form = html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i)
  if (!form) return { action: baseUrl, hidden: {} }
  const action = (form[1].match(/action\s*=\s*["']([^"']+)/i) || [])[1] || baseUrl
  const hidden = {}
  for (const match of form[2].matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = match[1]
    const type = (attrs.match(/type\s*=\s*["']([^"']+)/i) || [])[1] || 'text'
    const name = (attrs.match(/name\s*=\s*["']([^"']+)/i) || [])[1]
    const value = (attrs.match(/value\s*=\s*["']([^"']*)/i) || [])[1] || ''
    if (name && type.toLowerCase() === 'hidden') hidden[name] = value
  }
  return { action: new URL(action, baseUrl).toString(), hidden }
}

function findField(html, pattern, fallback) {
  for (const match of html.matchAll(/<input\b([^>]*)>/gi)) {
    const attrs = match[1]
    const type = ((attrs.match(/type\s*=\s*["']([^"']+)/i) || [])[1] || 'text').toLowerCase()
    const name = (attrs.match(/name\s*=\s*["']([^"']+)/i) || [])[1] || ''
    if (type !== 'hidden' && pattern.test(`${name} ${attrs}`)) return name
  }
  return fallback
}

async function genericLogin(systemUrl, username, password) {
  const loginPage = await requestPage(systemUrl)
  const form = formDetails(loginPage.body, loginPage.url)
  const usernameField = findField(loginPage.body, /user|account|login|name|学号|账号/i, 'username')
  const passwordField = findField(loginPage.body, /pass|pwd|密码/i, 'password')
  const params = new URLSearchParams({ ...form.hidden, [usernameField]: username, [passwordField]: password })
  const cookie = cookieHeader(loginPage.headers['set-cookie'])
  const response = await requestPage(form.action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) }, body: params.toString() })
  return { page: response, cookie: cookieHeader([...(loginPage.headers['set-cookie'] || []), ...(response.headers['set-cookie'] || [])]) }
}

async function parsePublicPage(pageUrl) {
  let url
  try { url = new URL(pageUrl) } catch { throw fail('课程表页面地址格式不正确', 'INVALID_URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw fail('只支持 HTTP 或 HTTPS 课程表地址', 'INVALID_URL')
  const page = await requestPage(url.toString())
  const courses = uniqueCourses([...parseScheduleHtml(page.body), ...parseScheduleText(page.body)])
  if (!courses.length) {
    if (/chaoxing\.com$/i.test(url.hostname)) throw fail('超星登录态不会共享给云函数，请复制课表内容到配置页解析', 'AUTH_SESSION_REQUIRED')
    if (/登录|手机号登录|机构账号登录|验证码|统一身份认证|captcha/i.test(page.body)) throw fail('当前页面仍需要登录，云函数无法读取小程序 web-view 的登录 Cookie', 'AUTH_SESSION_REQUIRED')
    throw fail('当前页面没有识别到课程内容', 'COURSE_NOT_FOUND')
  }
  return { courses, source: 'public-page', parsedAt: new Date().toISOString() }
}

function parseExportFile(fileName, fileBase64) {
  if (!fileBase64) throw fail('导出文件内容为空', 'INVALID_FILE')
  const buffer = Buffer.from(fileBase64, 'base64')
  let courses = []
  if (/\.html?$/i.test(fileName)) courses = parseScheduleHtml(buffer.toString('utf8'))
  else if (/\.csv$|\.txt$/i.test(fileName)) courses = parseScheduleText(buffer.toString('utf8'))
  else {
    let XLSX
    try { XLSX = require('xlsx') } catch { throw fail('云函数缺少 xlsx 依赖，请重新部署云函数', 'MISSING_XLSX_DEPENDENCY') }
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const text = workbook.SheetNames.map((sheetName) => XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])).join('\n')
    courses = parseScheduleText(text)
  }
  const unique = uniqueCourses(courses)
  if (!unique.length) throw fail('导出文件中没有识别到课程，请确认导出的是课程表而不是空白模板', 'COURSE_NOT_FOUND')
  return { courses: unique, source: 'export-file', fileName, parsedAt: new Date().toISOString() }
}

async function parseRequest(event) {
  const payload = typeof event === 'string' ? JSON.parse(event) : (event || {})
  const { systemUrl, pageUrl, fileName, fileBase64, username, password } = payload
  if (pageUrl) return parsePublicPage(pageUrl)
  if (fileBase64) return parseExportFile(fileName || 'schedule.xlsx', fileBase64)
  if (!systemUrl || !username || !password) throw fail('请提供教务系统地址、学号和密码', 'INVALID_INPUT')
  let url
  try { url = new URL(systemUrl) } catch { throw fail('教务系统地址格式不正确', 'INVALID_URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw fail('只支持 HTTP 或 HTTPS 教务系统地址', 'INVALID_URL')
  const login = await genericLogin(url.toString(), username, password)
  const schedulePage = await requestPage(url.toString(), { headers: login.cookie ? { Cookie: login.cookie } : {} })
  const courses = uniqueCourses([...parseScheduleHtml(login.page.body), ...parseScheduleHtml(schedulePage.body), ...parseScheduleText(`${login.page.body}\n${schedulePage.body}`)])
  if (!courses.length) {
    if (/chaoxing\.com$/i.test(url.hostname)) throw fail('该超星课表入口会跳转到机构登录页，需要先完成超星手机号或机构账号登录；登录态接入需要该学校的专用适配器', 'CHAoxING_LOGIN_REQUIRED')
    if (/验证码|滑块|统一身份认证|二次验证|captcha/i.test(schedulePage.body)) throw fail('该教务系统需要验证码或统一认证，暂时无法自动登录', 'AUTH_FLOW_UNSUPPORTED')
    throw fail('登录成功但没有识别到课程，请为该学校增加专用解析适配器', 'COURSE_NOT_FOUND')
  }
  return { courses, source: 'cloud-function', parsedAt: new Date().toISOString() }
}

exports.main = async (event) => {
  try { return { ok: true, ...(await parseRequest(event)) } } catch (error) { return { ok: false, code: error.code || 'PARSE_FAILED', message: error.message || '教务系统解析失败' } }
}
