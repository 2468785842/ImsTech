import { app, BrowserWindow } from 'electron';
// import { init } from 'imstechauto';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

{
  const { appendSwitch } = app.commandLine;
  appendSwitch('inspect', '0');
  appendSwitch('remote-debugging-port', '9222');
  appendSwitch('--no-sandbox');
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 加载应用的本地文件
  // await mainWindow.loadFile('index.html');
  await mainWindow.loadURL('https://www.baidu.com');

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
  const page = browser.contexts()[0].pages()[0];

  // 在页面中执行操作
  await page.goto('https://www.google.com');
  console.log('goto baidu');
  page.waitForTimeout(1000 * 5);

  // await init(browser);
  // 关闭浏览器
  await browser.close();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
