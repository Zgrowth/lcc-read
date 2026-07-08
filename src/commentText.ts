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

    const sentenceLikeSegments = trimmedLine.match(/[^。！？.!?…]+(?:[。！？.!?…]+|$)/g) || [trimmedLine];

    for (const segment of sentenceLikeSegments) {
      const trimmedSegment = segment.trim();
      if (!trimmedSegment) {
        continue;
      }

      if (trimmedSegment.length <= 80) {
        result.push(trimmedSegment);
        continue;
      }

      for (let i = 0; i < trimmedSegment.length; i += 80) {
        const chunk = trimmedSegment.slice(i, i + 80);
        const remaining = trimmedSegment.slice(i + 80);

        if (remaining.length > 0 && remaining.length <= 5) {
          result.push(chunk + remaining);
          break;
        }

        if (chunk.length > 0) {
          result.push(chunk);
        }
      }
    }
  }

  return result;
}
