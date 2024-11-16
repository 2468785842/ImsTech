import { app, BrowserWindow } from 'electron';
import { Config, init, Login } from '@ims-tech-auto/core';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

{
  const { appendSwitch } = app.commandLine;
  appendSwitch('remote-debugging-port', '9222');
  appendSwitch('--no-sandbox');
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false, // 禁用 Node.js Integration
      contextIsolation: true, // 启用上下文隔离
    },
  });

  // 加载应用的本地文件
  await mainWindow.loadURL(Config.default.urls.login());

  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('Main window finished loading');
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      console.error(
        `Page failed to load: ${errorDescription} (Error code: ${errorCode})`,
      );
    },
  );

  await connectToElectron();
  // 使用 Playwright 连接窗口，示例连接到CDP端口（确保 Electron 打开时调试端口暴露）
  // await AIModel.init(true);
}

async function connectToElectron() {
  // 连接到 Electron 的 CDP 端口
  const browser = await chromium
    .use(StealthPlugin())
    .connectOverCDP('http://localhost:9222');
  // 获取浏览器页面

  // 在页面中执行操作
  const page = await Login.login(browser);
  await init(page);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
