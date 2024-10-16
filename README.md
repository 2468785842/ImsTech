### 使用nodejs, playwright构建的国开自动刷课

#### 搞快了会被检测异常行为, 需要等待一个小时

![image](https://github.com/user-attachments/assets/f4dc8d3c-af98-4520-96fc-f4dc16ef73d0)
```javascript
// 修改index.ts中的slowMo弄慢点, 自己看着弄吧
// Setup
const context = await chromium.launchPersistentContext(
    process.env._USER_DATA!,
    {
        executablePath: process.env._CHROME_DEV!,
        headless: false, // 如果不想显示浏览器, 设置为true启动无头模式
        viewport: null,
        slowMo: 3000, // 搞太快会限制访问, 这里设置3秒
        ...
    }
);
```
---

#### 准备
- 下载 [ChromeDev](https://www.google.com/intl/zh-CN/chrome/dev/)(如果你自己有Chrome不需要), [Node.js](https://nodejs.org/zh-cn)
- 打开`cmd` 运行 `npm install` 命令下载依赖

#### 配置
- 在项目根目录下添加.env文件, 写入
```properties
_LOGIN_URL="https://iam.pt.ouchn.cn"
_HOME_URL="https://lms.ouchn.cn"

_ACCOUNT="xxx" # 账号
_PASSWORD="xxx" # 密码
_CHROME_DEV="C:\Program Files\Google\Chrome Dev\Application\chrome.exe" # chrome dev路径, 或者你自己的Chrome安装目录
_USER_DATA="C:\ChromiumCache" # 缓存, 自己创建的文件夹, 用来存缓存文件Cookie的, 这样不用每次启动都登陆
```

#### 运行
```shell
npm run start
```

#### 注意
- 操作浏览器:
  - 当登录时进行人机验证需要手动操作
  - 登录完成之后最好不要碰浏览器, 不然可能会出现意外的错误
- 更换浏览器内核:
  - 当使用firefox时
    - 浏览器置于后台会暂停加载: 解决办法`无`
    - 缓存无法正常工作,每次需要重新登录: 解决办法`无`
  - 当使用webkit时:
    - 无
  - 使用chromium
    - 目前未发现`未解决问题`
