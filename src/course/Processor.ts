import { Page } from 'playwright';

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { CourseProgress } from './Search.js';

type StrategyFunc = (page: Page, progress: CourseProgress) => Promise<void>;

// TODO: 重构
const COURSE_TYPE = {
  web_link: '线上链接',
  material: '参考资料',
  homework: '作业',
  forum: '讨论',
  online_video: '音视频教材',
  slide: '微课',
  lesson: '录播教材',
  lesson_replay: '教室录播',
  exam: '测试',
  chatroom: 'iSlide 直播',
  classroom: '随堂测试',
  questionnaire: '调查问卷',
  page: '页面',
  scorm: '第三方教材',
  interaction: '互动教材',
  feedback: '教学反馈',
  virtual_classroom: 'Connect 直播',
  zoom: 'Zoom 直播',
  microsoft_teams_meeting: 'Teams 直播',
  webex_meeting: 'Webex 直播',
  welink: 'Welink',
  tencent_meeting: '课堂直播',
  classin: 'ClassIn 直播',
  live_record: '直播',
  select_student: '选人',
  race_answer: '抢答',
  number_rollcall: '数字点名',
  qr_rollcall: '二维码点名',
  dingtalk_meeting: '钉钉会议',
  virtual_experiment: '虚拟仿真实验',
  mix_task: '复合任务',
  vocabulary: '词汇表',
  unknown: '未知'
};

type CourseType = keyof typeof COURSE_TYPE;

interface Processor {
  name: CourseType;
  /**
   * 回调
   * 执行条件, true 执行 exec(...), 反之不执行
   * condition == null 同样执行 exec(...)
   * @param progress 课程进度
   * @returns
   */
  condition?: (progress: CourseProgress) => boolean;
  /**
   * 处理课程逻辑
   * @param page 当前页面对象
   * @returns void
   */
  exec: (page: Page) => Promise<void>;
}

const processorTable: Partial<Record<CourseType, Processor>> = {};

function registerProcessor(processor: Processor) {
  processorTable[processor.name] = processor;
}

function getProcessor(name: CourseType) {
  return processorTable[name];
}

// 获取当前模块的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 定义脚本文件夹路径
const scriptsFolder = path.join(__dirname, 'processor');

// 读取目录中的所有脚本文件
fs.readdirSync(scriptsFolder)
  .filter((s) => s.endsWith('.js')) // 过滤出 .js 文件
  .forEach(async (file) => {
    const filePath = path.join(scriptsFolder, file);

    // 将文件路径转换为 file:// URL 格式
    const fileUrl = new URL(`file://${filePath}`);

    await import(fileUrl.href) // 使用合法的 file:// URL
      .then((m) => {
        registerProcessor(new m.default());
        console.log(`${file} loaded successfully`);
        // 可以根据需要使用加载的模块 'module'
      })
      .catch((e) => {
        console.error(`Error loading ${file}`);
        throw e;
      });
  });

export type { CourseType, Processor, StrategyFunc };

export { COURSE_TYPE, getProcessor, registerProcessor };
