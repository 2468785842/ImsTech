### 国开自动刷课程序 (基于 Node.js 和 Playwright)

### 可直接下载并使用 Electron 打包版
点击以下链接下载可执行安装程序：
[ImsTechAuto](https://github.com/2468785842/ImsTech/releases/latest/download/ims-tech-auto-1.0.0.Setup.exe)

### 或者从源码运行

#### 准备工作
1. 安装 [Chrome Dev](https://www.google.com/intl/zh-CN/chrome/dev/)（如果已安装 Chrome，可以跳过）
2. 安装 [Node.js](https://nodejs.org/zh-cn)

#### 配置
1. 在项目的根目录创建一个 `.env` 文件，并添加以下内容：
```properties
_ACCOUNT="xxx" # 你的账号
_PASSWORD="xxx" # 你的密码

_CHROME_DEV="C:\Program Files\Google\Chrome Dev\Application\chrome.exe" # Chrome Dev 安装路径，或使用你自己的 Chrome 安装路径
_SLOW_MO=6000 # 可选，执行间隔，默认为1000ms。调整此值可以避免被检测为异常行为。
_SLOW_MO_MIN=6000 # 可选，最小执行间隔（毫秒）
_SLOW_MO_MAX=10000 # 可选，最大执行间隔（毫秒）

_HEAD_LESS=1 # 可选，是否启用无头模式，默认不启用,参数为空则显示浏览器窗口。
_PLAY_RATE=16 # 可选，视频播放倍速，默认倍速为 8。
_TOTAL_POINTS=100 # 可选，考试及格分数，AI 答题分数超过此值时会自动结束当前考试。

########## 以下功能不稳定，如有问题请提交 issue ##########

# 可选，开启自动答题功能
# 目前仅支持单选题、判断题和随机题目，暂不支持多选和简答题。
_API="https://spark-api-open.xf-yun.com/v1" # AI 答题 API 接口
_KEY="nxetovst4bY1v0hUIk8L:NxYXC44THZHkVUmWLLGb" # API 密钥（此为示例，无法使用）
_MODEL="lite" # 模型名
_Qps=2 # 可选，每秒查询次数，默认为 1。

# 可选，设置代理（仅用于 AI 和 axios，浏览器不受影响）
#_PROXY_HOST=127.0.0.1
#_PROXY_PORT=8080
```

#### 运行程序
1. 安装 `yarn`：
   ```bash
   npm install -g yarn --registry=https://registry.npmmirror.com
   ```

2. 配置镜像源：
   ```bash
   yarn config set registry https://registry.npmmirror.com
   ```

3. 进入 `core` 目录：
   ```bash
   cd core
   ```

4. 安装依赖库：
   ```bash
   yarn install
   ```

5. 启动程序：
   ```bash
   yarn start
   ```

#### 注意事项
- **操作浏览器时：**
  - 登录时需要手动处理人机验证。
  - 登录完成后，尽量不要操作浏览器，以免发生错误。
  
- **浏览器兼容性：**
  - **Firefox**：浏览器置于后台时暂停加载，且每次登录需要重新输入。
  - **Webkit 和 Chromium**：无已知问题。

#### 代码风格
- 使用 Prettier 格式化代码。提交前请确保代码已格式化。可以使用以下命令格式化：
  ```bash
  npx prettier --write ./src ./core/src
  ```

### Electron 打包

#### 配置淘宝镜像
设置 Electron 镜像源：
```bash
$ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$ELECTRON_CUSTOM_DIR="v{{ version }}"
```

#### 打包成可执行文件
- 启动 Electron：
  ```bash
  yarn start:electron
  ```

- 打包应用：
  ```bash
  yarn make:electron
  ```

#### 下载和打包 Electron 时需要使用镜像或科学上网工具。