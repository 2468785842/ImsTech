import { app, BrowserWindow } from 'electron';
import { Config, init, login } from '@ims-tech-auto/core';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AIModel from '@ims-tech-auto/core/ai/AIModel.js';

{
  const { appendSwitch } = app.commandLine;
  appendSwitch('remote-debugging-port', '9222');
  appendSwitch('--no-sandbox');
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    show: !Config.browser.headless,
    webPreferences: {
      nodeIntegration: false, // 禁用 Node.js Integration
      contextIsolation: true, // 启用上下文隔离
    },
  });

  // 加载应用的本地文件
  await mainWindow.loadURL(Config.urls.login());

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      console.error(
        `网页加载失败: ${errorDescription} (错误码: ${errorCode})`,
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
    .connectOverCDP('http://localhost:9222', {
        slowMo: 0, // 不使用 Playwright 的 slowMo，我们使用自己的延迟机制
        timeout: 1000 * 60 * 2,
    });
  // 获取浏览器页面

  // 在页面中执行操作
  await AIModel.init(true);

  const page = await login(browser);
  await init(page);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', app.quit);
