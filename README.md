### 使用Nodejs, Playwright构建的国开自动刷课程序

### 可以直接下载使用Electron打包的版本
[ImsTechAuto](https://github.com/2468785842/ImsTech/releases/latest/download/ims-tech-auto-1.0.0.Setup.exe)

### 或从源码运行

#### 准备
- 安装 [ChromeDev](https://www.google.com/intl/zh-CN/chrome/dev/)(如果你自己有Chrome不需要)
- 安装 [Node.js](https://nodejs.org/zh-cn)

#### 配置
- 在项目根目录下添加`.env`文件, 写入
```properties

_ACCOUNT="xxx" # 账号
_PASSWORD="xxx" # 密码

_CHROME_DEV="C:\Program Files\Google\Chrome Dev\Application\chrome.exe" # chrome dev路径, 或者你自己的Chrome安装目录

_SLOW_MO=1000 # 可选 执行间隔默认1000(需要注意: 点击太快会被检测异常行为, 需要等待一个小时, 将此设置调大即可)单位为毫秒
_HEAD_LESS=1 # 可选 是否无头模式默认为false
_PLAY_RATE=16 # 可选 视频播放倍速默认8
_TOTAL_POINTS=100 # 可选 考试分数及格线百分比, 当AI答题结果分数超过会结束当前考试,进行下一项

########## 以下功能不稳定, 有问题提 issue ##########

# 可选 不设置不开启自动答题
# 目前只会帮助回答可尝试次数为999的exam
# AI 答题, 目前支持单选, 判断, 和随机题目. 不支持多选和简答题等等..

_API="https://spark-api-open.xf-yun.com/v1" # api 接口
_KEY="nxetovst4bY1v0hUIk8L:NxYXC44THZHkVUmWLLGb" # 密钥, 此为演示, 不可用
_MODEL="lite" # 模型名
_Qps=2 # 每秒查询率, 可选 默认为1

# 可选 设置代理, 此为ai和axios的代理, 浏览器不会使用
_PROXY_HOST=127.0.0.1
_PROXY_PORT=8080
```

#### 运行
- 安装yarn:
  npm install -g yarn --registry=https://registry.npmmirror.com

- 设置代理: 
  ```shell
  yarn config set registry https://registry.npmmirror.com
  ```
- 进入core目录:
   ```shell
   cd core
  ```

- 安装库:
  ```shell
  yarn install
  ```
- 运行: 
  ```shell
  yarn start
  ```


#### 注意
- 操作浏览器:
  - 当登录时进行人机验证需要手动操作
  - 登录完成之后最好不要碰浏览器, 不然可能会出现意外的错误
- 更换浏览器内核:
  - firefox:
    - 浏览器置于后台会暂停加载: 解决办法`无`
    - 缓存无法正常工作,每次需要重新登录: 解决办法`无`
  - webkit: 无
  - chromium: 无
  
#### 代码风格
* 使用 Prettier 进行代码格式化。请确保在提交之前格式化您的代码。使用以下命令格式化
* `npx prettier --write ./src`


### Electron打包

#### 淘宝镜像
* `$ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`
* `$ELECTRON_CUSTOM_DIR="v{{ version }}"`

#### 可执行文件(不需要设置Chromium, Nodejs打包完成, 安装直接可以运行)
- 运行electron:
  ```shell
  yarn start:electron
  ```

- 打包为可执行文件:
  ```shell
  yarn make:electron
  ```

#### 签名
```shell
gpg --batch --yes --armor --detach-sign --output ./electron/out/make/wix/x64/@ims-tech-auto-electron.msi.sig ./electron/out/make/wix/x64/@ims-tech-auto-electron.msi
```

#### 重新安装
* `msiexec /i ./electron/out/make/wix/x64/@ims-tech-auto-electron.msi REINSTALL=ALL REINSTALLMODE=vomus`

#### 下载和打包electron需要mirror或全程科学代理