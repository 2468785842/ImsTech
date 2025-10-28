import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

import { app, BrowserWindow } from 'electron';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { ims } from '@ims-tech-auto/core';
import AIModel from '@ims-tech-auto/core/ai/AIModel.js';
import HumanBehaviorPlugin from '@ims-tech-auto/core/plugins/HumanBehaviorPlugin.js';
import Config from '@ims-tech-auto/core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.join(dirname(__filename), '..', '..');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果无法获得锁，说明已有实例在运行
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
{
  const { appendSwitch } = app.commandLine;
  appendSwitch('remote-debugging-port', '9222');
  appendSwitch('no-sandbox');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    show: !Config.browser.headless,
    webPreferences: {
      nodeIntegration: false, // 禁用 Node.js Integration
      contextIsolation: true, // 启用上下文隔离
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  await mainWindow.loadFile(path.join(__dirname, '/index.html'));

  mainWindow.webContents.setAudioMuted(true);

  // 使用 Playwright 连接窗口，示例连接到CDP端口（确保 Electron 打开时调试端口暴露）
  await connectToElectron().catch((err) => {
    console.error('Electron连接Playwright失败:', err);
  });
}

async function connectToElectron() {
  // 连接到 Electron 的 CDP 端口
  const browser = await chromium
    .use(StealthPlugin())
    .use(HumanBehaviorPlugin())
    .connectOverCDP('http://localhost:9222', {
      slowMo: 240,
      timeout: 1000 * 60 * 2,
      headers: {
        Accept: 'application/json',
        Connection: 'keep-alive',
      },
    });

  await AIModel.init(true);

  const runner = await ims
    .login(browser, {
      ...Config.user,
      loginApi: Config.urls.login(),
      homeApi: Config.urls.home(),
    })
    .start();

  await runner?.restart();

  app.exit();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  app.quit();
});
