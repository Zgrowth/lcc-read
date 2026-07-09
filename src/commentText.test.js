const assert = require('assert');
const { splitTextIntoCommentSegments } = require('../out/commentText.js');

assert.deepStrictEqual(
  splitTextIntoCommentSegments('第一行\n第二行'),
  ['第一行', '第二行']
);

assert.deepStrictEqual(
  splitTextIntoCommentSegments('第一句。\n第二句\n第三句'),
  ['第一句。', '第二句', '第三句']
);

const longTextResult = splitTextIntoCommentSegments('这是一段很长的内容...这是一段很长的内容...这是一段很长的内容...');
// 长文本可能因为合并策略而只产生一段，保证至少有一段且内容包含目标子串
assert.ok(longTextResult.length >= 1);
assert.ok(longTextResult.every((segment) => segment.includes('这是一段很长的内容')));

// 确保结尾带中文右引号/标点不会被单独分成一行
const quoteSample = '请诸公试想一下，若是身在我位，诸公该作何决策，难道就等着那些百姓平白无故的饿死吗？”';
const quoteResult = splitTextIntoCommentSegments(quoteSample);
assert.strictEqual(quoteResult.length, 1);
assert.ok(quoteResult[0].endsWith('吗？”'));

// 保持一句话尽量在一行（示例）
const longSentence = '“好！鉴于方正一在位期间，政绩出众，遗漏税款之事就暂做罚俸一年，以示惩戒。诸卿以为如何？”';
const longSentenceResult = splitTextIntoCommentSegments(longSentence);
assert.strictEqual(longSentenceResult.length, 1, '示例应被保留为单行');
assert.ok(longSentenceResult[0].startsWith('“好！') && longSentenceResult[0].endsWith('如何？”'));

console.log('commentText tests passed');
