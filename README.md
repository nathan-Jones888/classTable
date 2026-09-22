# 松课课表

松课课表是一套面向学生的课程表应用，支持 Web、Android、iOS 和微信小程序。课程数据可以从教务系统导出的 HTML、CSV、TXT 或 Excel 文件中解析，并保存在用户本机。

## 功能

- 按教学周查看课程，支持前后周切换。
- 展示课程名称、教师、教室、星期和节次。
- 支持解析教务系统导出的 HTML、CSV、TXT、XLSX 和 XLS 文件。
- 支持复制课表文本或 HTML 后直接解析。
- Excel 解析和课程数据保存在本机，可离线查看。
- 学生密码不经过本项目后端，也不会保存。

## 项目结构

- `src/`：Vite + React + TypeScript Web 应用。
- `android/`：Capacitor Android 工程。
- `ios/`：Capacitor iOS 工程。
- `miniprogram/`：原生微信小程序，可使用微信开发者工具打开。
- `cloudfunctions/`：云函数目录。

## Web 开发

环境要求：Node.js 和 npm。

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

## 移动端构建

同步 Web 构建结果到 Capacitor：

```bash
npm run app:sync
```

Android：

```bash
npm run android:open
```

也可以使用脚本构建 Android：

```bash
npm run android:build
```

iOS 需要在 macOS 上执行：

```bash
npm run ios:open
```

更多 Android、iOS、签名和发布说明见 [APP_BUILD.md](APP_BUILD.md)。

## 微信小程序

1. 使用微信开发者工具打开 `miniprogram/`。
2. 在开发者工具中执行“构建 npm”。
3. 在小程序配置页导入教务系统导出的 HTML、CSV 或 Excel 文件，或粘贴课表文本。

详细说明见 [miniprogram/README.md](miniprogram/README.md)。

## 数据与隐私

课程数据仅保存在用户设备本地。本项目当前不要求使用 CloudBase 或课程数据后端；超星等教务系统的登录需要在其官方页面完成。
