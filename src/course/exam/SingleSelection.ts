import { format } from 'util';
import { OptionId, SubjectType } from '../../api/Exam.js';
import BaseSubjectResolver, { Option } from './BaseSubjectResolver.js';

class SingleSelection extends BaseSubjectResolver {
  protected type: SubjectType = 'single_selection';
  private wrongOptions: Option[] = [];

  async addAnswerFilter(_: number, ...optionIds: OptionId[]) {

    this.wrongOptions = [
      ...new Set([
        ...this.wrongOptions,
        ...optionIds.map((optId) => {
          const option = this.subject.options.find(({ id }) => id == optId);
          if (!option)
            throw new Error(format("Oops! don't have:", optId, 'Option'));
          return option;
        }),
      ]),
    ];
  }

  async getAnswer(): Promise<OptionId[]> {
    const { options, description } = this.subject;

    if (this.wrongOptions.length == options.length) {
      throw new Error('impossable: all options is wrong!!');
    }

    // only leave one option
    if (options.length - this.wrongOptions.length == 1) {
      const opt = options.find((opt) => !this.wrongOptions.includes(opt));
      if (!opt) throw new Error("impossable: can't find option???");
      return [opt.id];
    }

    const answer = await this.aiModel.getResponse(
      this.type,
      description,
      options.flatMap((opt) =>
        this.wrongOptions.includes(opt) ? [] : opt.content,
      ),
    );

    return [options[answer].id];
  }

  isPass(): boolean {
    return this.subject.options.length - this.wrongOptions.length == 1;
  }
}

export default SingleSelection;
