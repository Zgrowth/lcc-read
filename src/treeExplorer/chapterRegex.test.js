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

const content = ['正文第一行', '序列1：这是一个示例', '第二行'].join('\n');
const chapters = parseChapters(content);

assert.strictEqual(chapters.length, 1, '正文中出现“序列”时不应误判成章节标题');
assert.strictEqual(chapters[0].title, '第1段');
console.log('chapter regex tests passed');
