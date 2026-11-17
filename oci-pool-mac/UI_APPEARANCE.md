# Mac 界面风格

客户端与 Web 共用 Claude / 经典两套视觉规则，页面与接口逻辑不因风格切换而变化，最低系统版本保持 macOS 11。

## 使用方式

登录页语言按钮旁、主界面右上角的主题按钮均提供「界面风格」和「配色模式」两组设置：

- Claude：暖米色 / 暖深色、珊瑚色默认强调色、衬线标题。
- 经典：保留原有冷灰色系、绿色默认强调色和传统导航标记。
- 浅色 / 深色 / 跟随系统与风格独立；每套风格分别记住强调色。
- 新安装默认 Claude 浅色；已有 `appAppearance` 或 `appAccent` 设置且未选择过风格的用户保留经典外观与已有偏好。
- 经典浅色的品牌标志使用随强调色调和的底色与白色云资源图形；登录页外观菜单在窗口内部右对齐，预留 40pt 边距。
- 两端登录页的管理员说明统一使用中性底色与细实线边框；找回密码链接使用强调色与正文前景混色，悬停时显示下划线。
- Claude 登录拓扑统一以 Mac 图形为基准：530 单位构图、65% 强调色骨架、橙色热点、固定 -22° 外环和相同的核心 / 标签底色；两端均尊重系统减弱动态效果设置。

偏好保存在 Mac 的 `UserDefaults`，新增 `appInterfaceStyle`、`appAccentByDesign`，兼容既有 `appAppearance`、`appAccent` 和 `appDensity`，不自动同步浏览器偏好。

## 实现位置

- `Supporting/AppTheme.swift`：动态颜色、语义色、品牌配色与主题控制器。
- `Supporting/AppearancePreferences.swift`：旧偏好迁移与按风格保存强调色。
- `Supporting/AppTypography.swift`：Claude 使用原生衬线标题，正文、表格和数字保留系统字体及等宽设置。
- `Common/Components/AppearanceOptionsView.swift`：登录页与顶栏共用的风格 / 配色菜单。
- `Supporting/BrandGeometry.swift`：客户端标志与应用图标生成器共用的云资源池路径。
- `Common/Components/BrandMarkView.swift`：浅色模式白色云朵及高对比底色，深色模式奶白云朵与珊瑚色资源层。

成功徽章、运行状态和成功通知使用独立成功色；日志面板适配暖深色。SSH 终端的配色预设与用户选择保持独立。Mac 特有的本机 / 远程部署及启动状态不变。

## 验证与构建

在 `oci-pool-mac/` 目录运行：

```sh
mkdir -p .build/appearance-check
swiftc OciPool/Supporting/AppDesignStyle.swift OciPool/Supporting/AppearancePreferences.swift verify-appearance.swift -o .build/appearance-check/verify-appearance
.build/appearance-check/verify-appearance

swiftc OciPool/Supporting/BrandGeometry.swift generate-icon.swift -o .build/generate-icon
.build/generate-icon OciPool/Assets.xcassets/AppIcon.appiconset
swift verify-icon.swift OciPool/Assets.xcassets/AppIcon.appiconset/icon_1024.png

xcodegen generate --spec project.yml
xcodebuild -project OciPool.xcodeproj -scheme OciPool -configuration Debug -derivedDataPath .build/ui-dev CODE_SIGNING_ALLOWED=NO build
```

`build-dmg.sh` 已接入新的图标生成方式，执行该脚本仍会运行原有完整打包流程。日常 UI 验证只需构建原生客户端，无需重新打包后端。

人工验收覆盖：两套风格 × 深浅色、跟随系统、登录前后一致、重启偏好保留、侧栏展开 / 收起、常用表单和弹窗，以及成功状态不被强调色替代。

### 本次验证记录

- Debug 原生构建通过，部署目标仍为 macOS 11.0；未在 Big Sur 实机验证。
- 偏好检查通过：默认值、旧设置迁移、分风格强调色、重新读取及无效值回退。
- 图标检查通过：暖黑底、白色云朵、珊瑚色资源层及透明留白。
- 原生界面已检查 Claude / 经典各自的深浅色、登录页和主窗口外观菜单、侧栏展开与收起、API 导入表单（仅打开与取消）。
- 主窗口已连接真实 Docker 开发后端并显示租户列表空状态，未导入凭据或提交资源操作。

本次界面验收使用独立 bundle ID 的测试副本，未覆盖已安装的客户端或其偏好。完整发布 DMG 尚未生成。
