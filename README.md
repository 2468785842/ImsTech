### 使用nodejs, playwright构建的国开自动刷课

#### 需要注意: 点击太快会被检测异常行为, 需要等待一个小时

```javascript
// 在 src/index.ts 中可以修改某些设置
await chromium.use(StealthPlugin()).launch({
    executablePath: process.env._CHROME_DEV!,
    // true 不显示浏览器,
    // 当你登陆过一次存了cookie可以开启,
    // cookie存在项目根目录下的 .cookie.txt 文件中
    headless: true,
    slowMo: 1000 // 点击速率, 搞太快会限制访问
  });
```

---

#### 准备
- 安装 [ChromeDev](https://www.google.com/intl/zh-CN/chrome/dev/)(如果你自己有Chrome不需要)
- 安装 [Node.js](https://nodejs.org/zh-cn)

#### 配置
- 在项目根目录下添加`.env`文件, 写入
```properties

_ACCOUNT="xxx" # 账号
_PASSWORD="xxx" # 密码

_CHROME_DEV="C:\Program Files\Google\Chrome Dev\Application\chrome.exe" # chrome dev路径, 或者你自己的Chrome安装目录


########## 以下功能不稳定, 有问题提 issue ##########

# 可选 不设置不开启自动答题
# 目前只会帮助回答可尝试次数为999的exam
# AI 答题, 目前支持单选, 判断, 不支持多选, 和随机题目

_API="https://spark-api-open.xf-yun.com/v1" # api 接口
_KEY="nxetovst4bY1v0hUIk8L:NxYXC44THZHkVUmWLLGb" # 密钥, 此为演示, 不可用
_MODEL="lite" # 模型名
_Qps=2 # 每秒查询率, 可选 默认为1

# 可选 设置代理, 此为ai和axios的代理, 浏览器不会使用
_PROXY_HOST=127.0.0.1
_PROXY_PORT=8080
```

#### 运行
- 设置代理: 
  ```shell
  npm config set registry https://registry.npmmirror.com
  ```
- 安装库:
  ```shell
  npm install
  ```
- 运行: 
  ```shell
  npm run start
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
  - chromium: 目前未发现`未解决问题`
