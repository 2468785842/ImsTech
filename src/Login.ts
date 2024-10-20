import { Browser, Cookie } from 'playwright';

import * as fs from 'fs';

import Config from './config.js';

const cookieFilename = './.cookies.txt';

async function login(browser: Browser) {
  const context =
    browser.contexts().length == 0
      ? await browser.newContext()
      : browser.contexts()[0];

  await context.clearCookies();
  await context.addCookies(await restoreCookies());

  const page =
    context.pages().length == 0 ? await context.newPage() : context.pages()[0];

  await page.goto(Config.urls.home(), { timeout: 1000 * 60 * 10 });

  if (!RegExp(`^${Config.urls.login()}.*`).test(page.url())) {
    console.log('logined');
    return page;
  }

  console.log('need login');

  await page.getByPlaceholder('请输入登录名').fill(process.env._ACCOUNT!);
  await page.getByPlaceholder('请输入登录密码').fill(process.env._PASSWORD!);
  const agree = page.locator('#agreeCheckBox').first();
  await agree.setChecked(true);
  await page.getByRole('button', { name: '登录' }).click();
  // 等待跳转, timeout 可能被父级 page option覆盖呢..., 在这里显式声明好了
  await page.waitForURL(Config.urls.home(), { timeout: 1000 * 60 * 5 });
  await storeCookies(await context.cookies());
  return page;
}

async function storeCookies(cookies: Array<Cookie>) {
  const s = JSON.stringify(cookies);

  fs.writeFileSync(cookieFilename, s);
}

async function restoreCookies(): Promise<Array<Cookie>> {
  if (fs.existsSync(cookieFilename)) {
    return JSON.parse(String(fs.readFileSync(cookieFilename)));
  }
  return [];
}

export { login, storeCookies, restoreCookies };
