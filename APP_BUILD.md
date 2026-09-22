# 松课 App 构建

## Android 和华为手机

在项目根目录执行：

```bash
npm run app:sync
npm run android:open
```

Android Studio 打开后，选择 `Build > Generate App Bundles or APKs`：

- 选择 APK 可直接安装到 Android/华为手机
- 选择 AAB 可发布到应用市场

首次构建需要 Android Studio、Android SDK 和 Gradle。应用包名是 `com.songke.classtable`。

## iPhone

在 macOS 上执行：

```bash
npm run app:sync
npm run ios:open
```

然后使用 Xcode 签名并运行到 iPhone，或打包上传 App Store。iOS 发布必须使用 macOS 和 Apple 开发者账号。

## 数据说明

Excel 解析和课表数据保存在 App 的本机存储中。首次安装后上传两个 Excel，之后可以离线查看整学期课表。