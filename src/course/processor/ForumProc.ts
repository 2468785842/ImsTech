import { Page } from 'playwright';

import { Processor } from '../Processor.js';

import { CourseProgress, CourseType } from '../Search.js';

export default class ForumProc implements Processor {
  name: CourseType = 'forum';

  condition(progress: CourseProgress): boolean {
    // ...就算发帖还是完成一半的状态...可能是国开系统bug...我们直接跳过
    return progress != 'part';
  }

  async exec(page: Page) {
    // 直接复制别人的...
    const topic = page.locator('.forum-topic-detail').first();
    const title = await topic.locator('.topic-title').textContent();
    const content = await topic.locator('.topic-content').textContent();

    const publishBtn = page.getByText('发表帖子');
    await publishBtn.click();

    const form = page.locator('.topic-form-section');
    const titleInput = form.locator('input[name="title"]');
    const contentInput = form.locator('.simditor-body>p');
    await titleInput.fill(title!);
    await contentInput.fill(content!);

    await page
      .locator('#add-topic-popup .form-buttons')
      .getByRole('button', { name: '保存' })
      .click();
  }
}
