import { Browser, Cookie } from 'playwright';

import * as fs from 'fs';

import Config, { API_BASE_URL } from './config.js';

const cookieFilename = './.cookies.txt';

async function login(browser: Browser) {
  const context =
    browser.contexts().length == 0
      ? await browser.newContext()
      : browser.contexts()[0];

  const cookies = await restoreCookies();

  if (cookies.length != 0) {
    await context.clearCookies();

    await context.addCookies(cookies).catch((e) => {
      console.warn('解析Cookie文件失败:', e);
      fs.rmSync(cookieFilename);
    });
  }

  const page =
    context.pages().length == 0 ? await context.newPage() : context.pages()[0];

  await page.focus('html');

  await page.goto(Config.urls.home(), { timeout: 1000 * 60 * 10 });

  if (!RegExp(`^${Config.urls.login()}.*`).test(page.url())) {
    console.log('已经登陆');
    return page;
  }

  console.log('需要登陆');

  await page.getByPlaceholder('请输入登录名').fill(process.env._ACCOUNT!);
  await page.getByPlaceholder('请输入登录密码').fill(process.env._PASSWORD!);
  const agree = page.locator('#agreeCheckBox').first();
  await agree.setChecked(true);
  await page.getByRole('button', { name: '登录' }).click();

  // 等待跳转, timeout 可能被父级 page option覆盖呢..., 在这里显式声明好了
  await page.waitForURL(Config.urls.home(), { timeout: 1000 * 60 * 5 });

  if (cookies.length == 0)
    await storeCookies(
      filterCookies(await context.cookies()).map((cookie) => ({
        ...cookie,
        domain: API_BASE_URL.substring('https://'.length)
      }))
    );

  return page;
}

async function storeCookies(cookies: Array<Cookie>) {
  const s = JSON.stringify(cookies);

  fs.writeFileSync(cookieFilename, s);
}

async function restoreCookies(): Promise<Array<Cookie>> {
  if (fs.existsSync(cookieFilename)) {
    // playwright 不识别null,需要转换undefined
    const cookies: Cookie[] = JSON.parse(
      String(fs.readFileSync(cookieFilename))
    );
    cookies.forEach((cookie) => {
      for (const k in cookie) {
        (cookie as any)[k] = cookie[k as keyof Cookie] ?? void 0;
      }

      // 不识别小写开头,需要转 ___*( ￣皿￣)/#____
      cookie.sameSite = {
        STRICT: 'Strict',
        LAX: 'Lax',
        None: 'None'
      }[cookie.sameSite.toUpperCase()] as any;
    });

    return cookies;
  }
  return [];
}

function filterCookies(cookies: Array<Cookie>) {
  return cookies.filter((cookie) =>
    ['HWWAFSESID', 'HWWAFSESTIME', 'session'].includes(cookie.name)
  );
}

export { login, storeCookies, restoreCookies };
