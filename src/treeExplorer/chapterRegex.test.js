const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return {
      window: {
        showErrorMessage() {},
      },
      workspace: {
        getConfiguration() {
          return { get() { return undefined; } };
        },
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { parseChapters } = require('../../out/treeExplorer/chapter.js');

const numericPrefixContent = ['正文第一行', '476、一切都是恰好的安排', '第二行'].join('\n');
const numericPrefixChapters = parseChapters(numericPrefixContent);

assert.strictEqual(numericPrefixChapters.length, 1, '数字前缀章节应被识别为章节标题');
assert.strictEqual(numericPrefixChapters[0].title, '476、一切都是恰好的安排');
assert.strictEqual(numericPrefixChapters[0].content, '第二行', '章节正文不应包含标题行');

const sequenceContent = ['正文第一行', '序列1：这是一个示例', '第二行'].join('\n');
const sequenceChapters = parseChapters(sequenceContent);

assert.strictEqual(sequenceChapters.length, 1, '正文中出现“序列”时不应误判成章节标题');
assert.strictEqual(sequenceChapters[0].title, '第1段');
console.log('chapter regex tests passed');
