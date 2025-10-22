import { Browser, Cookie } from 'playwright';

import * as fs from 'fs';
import path from 'path';

import Config from './config.js';

const cookieFilename = path.join(process.cwd(), '.cookies.txt');

async function login(browser: Browser) {
  const context =
    browser.contexts().length == 0
      ? await browser.newContext()
      : browser.contexts()[0];

  const cookies = await restoreCookies();

  if (cookies.length != 0) {
    await context.clearCookies();

    await context.addCookies(filterCookies(cookies, ['session'])).catch((e) => {
      console.warn('解析Cookie文件失败:', e);
      fs.rmSync(cookieFilename);
    });
  }

  const page =
    context.pages().length == 0 ? await context.newPage() : context.pages()[0];

  await page.goto(Config.urls.home(), { timeout: 1000 * 60 * 10 });

  if (!RegExp(`^${Config.urls.login()}`).test(page.url())) {
    console.log('已经登陆');
    return page;
  }

  if (Config.browser.headless) {
    throw '需要手动进行验证, 请关闭无头模式';
  }

  console.warn('需要登陆');

  const { account, password } = Config.user;

  if (account && password) {
    await page.getByPlaceholder('请输入登录名').fill(account);
    await page.getByPlaceholder('请输入登录密码').fill(password);
  } else {
    console.warn('缺少账号或密码, 需要手动输入');
  }

  const agree = page.locator('#agreeCheckBox').first();
  await agree.setChecked(true);

  if (account && password) {
    await page.getByRole('button', { name: /^\s*登\s*录\s*$/ }).click();
  }

  // 等待跳转, timeout 可能被父级 page option覆盖呢..., 在这里显式声明好了
  await page.waitForURL(Config.urls.home(), { timeout: 1000 * 60 * 5 });

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
      String(fs.readFileSync(cookieFilename)),
    );
    cookies.forEach((cookie) => {
      for (const k in cookie) {
        (cookie as any)[k] = cookie[k as keyof Cookie] ?? void 0;
      }

      // 不识别小写开头,需要转 ___*( ￣皿￣)/#____
      cookie.sameSite = {
        STRICT: 'Strict',
        LAX: 'Lax',
        None: 'None',
      }[cookie.sameSite.toUpperCase()] as any;
    });

    return cookies;
  }
  return [];
}

/**
 *
 * @param cookies Cookie数组
 * @param names 需要哪些Cookie匹配的name
 * @returns 过滤后符合names的Cookie数组
 */
function filterCookies(cookies: Array<Cookie>, names: string[]) {
  return cookies.filter((cookie) => names.includes(cookie.name));
}

export { filterCookies, login, restoreCookies, storeCookies };
