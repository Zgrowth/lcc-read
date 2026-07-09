export function splitTextIntoCommentSegments(text: string): string[] {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();

  if (!normalizedText) {
    return [];
  }

  const lines = normalizedText.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    // 包含结尾的引号/括号等闭合符号，避免把这些符号单独分到一行
    const sentenceLikeSegments = trimmedLine.match(/[^。！？.!?…]+(?:[。！？.!?…]+|$)[\u201D\u2019"'\)\]\}》】」』]?/g) || [trimmedLine];

    // 优先尝试将相邻的短片段合并为一行，保留原有的长片段拆分逻辑
    const fixedCommentLength = 80;
    let buffer = '';

    const flushBuffer = () => {
      if (buffer && buffer.trim().length > 0) {
        result.push(buffer.trim());
        buffer = '';
      }
    };

    for (const segment of sentenceLikeSegments) {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) continue;

      // 如果单个片段已经很长，先把缓冲区写出，然后按长度拆分这个片段
      if (trimmedSegment.length > fixedCommentLength) {
        flushBuffer();
        for (let i = 0; i < trimmedSegment.length; i += fixedCommentLength) {
          const chunk = trimmedSegment.slice(i, i + fixedCommentLength);
          const remaining = trimmedSegment.slice(i + fixedCommentLength);

          if (remaining.length > 0 && remaining.length <= 5) {
            result.push((chunk + remaining).trim());
            break;
          }

          if (chunk.length > 0) {
            result.push(chunk.trim());
          }
        }
        continue;
      }

      // 如果缓冲区为空，直接放入缓冲区
      if (buffer.length === 0) {
        buffer = trimmedSegment;
        continue;
      }

      // 尝试合并当前片段到缓冲区，如果合并后仍在限制内则合并，否则先flush再把当前片段放入缓冲区
      if ((buffer.length + trimmedSegment.length) <= fixedCommentLength) {
        buffer = buffer + trimmedSegment;
      } else {
        flushBuffer();
        buffer = trimmedSegment;
      }
    }

    // 结束时写出缓冲区
    flushBuffer();
  }

  return result;
}
