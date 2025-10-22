import { Page } from 'playwright';
import ReadLine from 'readline';
import Config from './config.js';

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
  await page.waitForLoadState();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const progressBar: HTMLElement | null =
      document.querySelector('#ngProgress');
    return progressBar && progressBar.style.width === '0%'; // 判断进度是否完成
  });
  await page.waitForTimeout(500);
}

function input(query: string) {
  const rl = ReadLine.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function parseDOMText(page: Page, str: string) {
  return page.evaluate((str) => {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.innerText;
  }, str);
}

class ErrorWithRetry {
  private failedTask: (e: any) => void = (e) => { throw e; };
  private retryTask: () => Promise<void> | void = async () => {};

  constructor(
    private taskName: string,
    private maxCnt: number,
  ) {}

  async run(task: () => Promise<void> | void) {
    let lastError: any;
    
    for (let i = 0; i < this.maxCnt; i++) {
      try {
        // 等待任务完成（同步和异步都支持）
        await Promise.resolve(task());
        console.log(`任务: ${this.taskName} 执行成功`);
        return; // 成功则退出
      } catch (e) {
        lastError = e;
        console.warn(
          `任务: ${this.taskName} 执行失败, 重试: ${i + 1}/${this.maxCnt}, 错误: ${e}`
        );

        // 如果不是最后一次重试，执行重试任务
        if (i < this.maxCnt - 1) {
          try {
            await this.retryTask();
          } catch (retryError) {
            console.warn(`重试任务执行失败: ${retryError}`);
          }
        }
      }
    }
    
    // 所有重试都失败
    console.error(`任务: ${this.taskName} 执行失败, 并且达到最大重试次数.`);
    this.failedTask(lastError);
  }

  failed(callback: (e: any) => void) {
    this.failedTask = callback;
    return this;
  }

  retry(callback: () => Promise<void> | void) {
    this.retryTask = callback;
    return this;
  }
}

function errorWithRetry(taskName: string, maxCnt: number) {
  return new ErrorWithRetry(taskName, maxCnt);
}

async function withRandomDelay<T>(page: Page, operation: () => T) {
  try {
    const delay = Config.browser.slowMo();
    await page.waitForTimeout(delay);
    return operation();
  } catch (error: any) {
    if (
      error.message?.includes('Target page, context or browser has been closed')
    ) {
      console.log('页面已关闭，跳过延迟操作');
      return operation();
    }
    throw error;
  }
}

export {
  input,
  waitForSPALoaded,
  parseDOMText,
  errorWithRetry,
  withRandomDelay,
};
