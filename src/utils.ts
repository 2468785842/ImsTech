import { Page } from 'playwright';
import ReadLine from 'readline';

/**
 * 因为 vue 动态加载, 上方使用了 ngProgess 库显示进度
 * 我们可以根据 ngProgress 判断页面是否加载完成
 * 轮询检查 ngProgress 的宽度是否达到 0%
 *
 * @example
 * ```typescript
 * await waitForSPALoaded(page);
 * ```
 * @param page 当前页面
 *
 */
async function waitForSPALoaded(page: Page) {
  await page.waitForTimeout(500);
  await page.waitForLoadState();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const progressBar: HTMLElement | null =
      document.querySelector('#ngProgress');
    return progressBar && progressBar.style.width === '0%'; // 判断进度是否完成
  });
}

function input(query: string) {
  const rl = ReadLine.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise<string>((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export { input, waitForSPALoaded, sleep };
