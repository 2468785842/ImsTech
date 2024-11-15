## 淘宝镜像
* `$ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`
* `$ELECTRON_CUSTOM_DIR="v{{ version }}"`

### 打包
* `yarn run make`

### 运行
* `yarn start`
## 签名
* `cd ./out/make/squirrel.windows/x64/ && gpg --batch --yes --armor --detach-sign ./out/make/squirrel.windows/x64/installer.msi.sig path/to/your/installer.msi`
### 下载和打包electron需要mirror或全程科学代理