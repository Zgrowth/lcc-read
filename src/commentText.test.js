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
assert.ok(longTextResult.length > 1);
assert.ok(longTextResult.every((segment) => segment.includes('这是一段很长的内容')));

console.log('commentText tests passed');
