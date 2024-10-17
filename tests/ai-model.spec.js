var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import test, { expect } from '@playwright/test';
import AIModel from '../src/ai/AIModel.js';
test('测试AI连通', () => __awaiter(void 0, void 0, void 0, function* () {
    const aiModel = AIModel.init(true);
    expect(yield aiModel, '连接失败').not.toBeNull();
    yield AIModel.instance.getResponse('你是谁');
    yield AIModel.instance.getResponse('哈喽!');
}));
//# sourceMappingURL=ai-model.spec.js.map