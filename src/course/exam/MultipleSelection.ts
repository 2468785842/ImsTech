import { OptionId } from '../../api/Exam.js';
import BaseSubjectResolver, { Option } from './BaseSubjectResolver.js';

// 最大尝试次数: 2^n − 1
class MultipleSelection extends BaseSubjectResolver {
  private dependableTable?: Record<OptionId, number>;
  private pass = false;

  private _combinations = this.generateCombinationsBySize(
    this.subject.options.map((opt) => opt.id),
  );

  get combinations() {
    return this._combinations;
  }

  set combinations(c: typeof this._combinations) {
    const clearEmptyArray = function <T>(arr: T[]): T[] {
      const result: T[] = [];

      for (const item of arr) {
        if (Array.isArray(item)) {
          const cleanedSubArray = clearEmptyArray(item);
          if (cleanedSubArray.length > 0) {
            result.push(cleanedSubArray as T);
          }
          continue;
        }
        result.push(item);
      }

      return result;
    };

    console.log('this._combinations', this._combinations);
    this._combinations = clearEmptyArray(c);
    console.log(this._combinations);
  }

  private async initDependableTable() {
    if (!this.dependableTable) {
      console.log('loading dependable tables... wait a minute');
      this.dependableTable = this.subject.options.reduce(
        (acc, { id }) => {
          acc[id] = 1;
          return acc;
        },
        {} as Record<OptionId, number>,
      );

      const combines = this.generateOptionIdCombines();
      for (const combine of combines) {
        const i = await this.aiModel.getResponse(
          'true_or_false',
          this.subject.description,
          combine.map((c) => c.content),
        );

        this.dependableTable[combine[i].id] += 1;
      }
    }

    return this.dependableTable!;
  }

  async addAnswerFilter(score: number, ...optionIds: OptionId[]) {
    if (this.pass) return;

    const { point } = this.subject;

    const count = optionIds.length;

    if (Number(point) == score) {
      this.combinations[count] = [optionIds];
      this.pass = true;
      return;
    }

    if (count == this.subject.options.length) {
      this.combinations[count] = [];
      return;
    }

    // 创建一个 `Set`，用于快速判断 `optionIds` 中是否包含某个选项
    const optionIdSet = new Set(optionIds);
    // 过滤掉不符合 `optionIds` 的组合
    this.combinations[count] = this.combinations[count].filter(
      (c) =>
        c.length == optionIdSet.size && !c.every((id) => optionIdSet.has(id)),
    );
  }

  async getAnswer(): Promise<OptionId[]> {
    const dependableTable = await this.initDependableTable();

    const sortDT = this.sortDependableTable();

    const NNN = sortDT.filter((v) => dependableTable[v] == 999);

    if (NNN.length != 0) return NNN;

    // 随便选
    const priority = [1, 3, 4, 2, 0];
    for (const p of priority) {
      if (this.combinations.length >= p && this.combinations[p].length != 0) {
        // 使用 reduce 找到最大总和值的组合索引
        const maxCombination = this.combinations[p].reduce((max, current) => {
          const currentSum = this.sumDependable(current, dependableTable);
          const maxSum = this.sumDependable(max, dependableTable);
          return currentSum > maxSum ? current : max;
        });

        return maxCombination;
      }
    }

    console.warn('this options is empty!!!');
    return [];
  }

  private async sumDependable(
    ids: OptionId[],
    dependableTable: Record<OptionId, number>,
  ) {
    return ids.reduce((acc, id) => acc + dependableTable[id], 0);
  }

  private sortDependableTable() {
    if (!this.dependableTable || Object.keys(this.dependableTable).length == 0)
      throw new Error('Error dependableTable is null or empty');

    return Object.keys(this.dependableTable)
      .sort(
        (a, b) =>
          this.dependableTable![Number(b)]! - this.dependableTable![Number(a)]!,
      )
      .map(Number);
  }

  private generateOptionIdCombines(): Option[][] {
    const t: Option[][] = [];
    const { options } = this.subject;
    const len = options.length;

    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        t.push(options.slice(i, j + 1));
      }
    }

    return t;
  }

  /**
   * 索引i对应有i个选项
   * @param options
   * @returns
   */
  private generateCombinationsBySize(options: OptionId[]) {
    if (options.length > 4) {
      throw new Error('too many options > 4');
    }
    const result = Array.from(
      { length: options.length + 1 },
      () => [] as OptionId[][],
    );

    function helper(currentCombination: OptionId[], start: number) {
      // 根据组合的长度，将当前组合加入到对应的 result 索引位置
      if (currentCombination.length != 0) {
        result[currentCombination.length].push([...currentCombination]);
      }

      // 遍历选项，生成更多的组合
      for (let i = start; i < options.length; i++) {
        currentCombination.push(options[i]);
        helper(currentCombination, i + 1);
        currentCombination.pop(); // 回溯
      }
    }

    // 开始递归生成组合
    helper([], 0);
    return result;
  }

  isPass(): boolean {
    return this.pass;
  }
}

export default MultipleSelection;
