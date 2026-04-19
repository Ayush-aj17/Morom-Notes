const estimateLineHeight = (line) => {
  const ESTIMATED_LINE_HEIGHT = 23;
  let lineHeight = ESTIMATED_LINE_HEIGHT;

  if (line.match(/^#{1,6}\s/)) {
    const headingLevel = line.match(/^#+/)[0].length;
    if (headingLevel === 1) lineHeight = 38;
    else if (headingLevel === 2) lineHeight = 32;
    else if (headingLevel === 3) lineHeight = 28;
    else lineHeight = 26;
  } else if (line.match(/^>\s/)) {
    lineHeight = Math.ceil(line.length / 80) * ESTIMATED_LINE_HEIGHT + 6;
  } else if (line.match(/^[-*+]\s/) || line.match(/^\d+\.\s/)) {
    const charCount = line.length;
    const estimatedWraps = Math.ceil(charCount / 95);
    lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT + 2;
  } else if (line.match(/^\s+[-*+]\s/) || line.match(/^\s+\d+\.\s/)) {
    const charCount = line.length;
    const estimatedWraps = Math.ceil(charCount / 90);
    lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT + 2;
  } else if (line.trim() === '') {
    lineHeight = 4;
  } else {
    const charCount = line.length;
    if (charCount > 100) {
      const estimatedWraps = Math.ceil(charCount / 100);
      lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT;
    }
  }

  return lineHeight;
};

const getContextIndices = (lines, lineIndex) => {
  if (lineIndex < 0 || lineIndex >= lines.length) return [];
  const line = lines[lineIndex];
  const match = line.match(/^(\s*)/);
  if (!match) return [];
  const lineIndent = match[1].length;
  if (lineIndent === 0) return [];
  const contextIndices = [];
  let currentSearchIndent = lineIndent;
  const searchLimit = Math.max(0, lineIndex - 50);
  for (let i = lineIndex - 1; i >= searchLimit; i--) {
    const prevLine = lines[i];
    if (prevLine.trim() === '') continue;
    const prevMatch = prevLine.match(/^(\s*)/);
    const prevIndent = prevMatch ? prevMatch[1].length : 0;
    const isListItem = prevLine.match(/^\s*[-*+\d.]\s/);
    if (isListItem && prevIndent < currentSearchIndent) {
      contextIndices.unshift(i);
      currentSearchIndent = prevIndent;
    }
  }
  return contextIndices;
};

const getParentContext = (lines, lineIndex) => {
  if (lineIndex < 0 || lineIndex >= lines.length) return [];
  const contextLines = [];
  const searchLimit = Math.max(0, lineIndex - 150);
  for (let i = lineIndex - 1; i >= searchLimit; i--) {
    const line = lines[i];
    if (line.match(/^#{1,6}\s/)) {
      contextLines.unshift(line);
      break;
    }
  }
  return contextLines;
};

function processContent(content) {
    const PAGE_HEIGHT_ESTIMATE = 100; // Small height to force breaks
    const PADDING_BUFFER = 10;
    const pagesList = [];
    const lines = content.split('\n');
    let currentPageLines = [];
    let currentPageLineIndices = [];
    let currentPageHeight = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineHeight = estimateLineHeight(line);
      const isNestedItem = line.match(/^\s+[-*+\d.]/);
      const isMainItem = line.match(/^[-*+\d.]\s/);

      if (isMainItem && !isNestedItem) {
        let blockHeight = lineHeight;
        let j = i + 1;
        let block = [line];
        let blockIndices = [i];

        while (j < lines.length) {
          const nextLine = lines[j];
          const nextIsNested = nextLine.match(/^\s+[-*+\d.]/);
          const nextIsMainItem = nextLine.match(/^[-*+\d.]\s/);
          const nextIsEmpty = nextLine.trim() === '';

          if (nextIsMainItem && !nextIsNested) break;

          if (nextIsNested || nextIsEmpty) {
            const nextHeight = estimateLineHeight(nextLine);
            block.push(nextLine);
            blockIndices.push(j);
            blockHeight += nextHeight;
            j++;
          } else {
            break;
          }
        }

        if (currentPageHeight + blockHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          const pageToSave = currentPageLines.join('\n').trim();
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pagesList.push([...contextLines, ...currentPageLines].join('\n').trim());
              } else {
                pagesList.push(pageToSave);
              }
            } else {
              pagesList.push(pageToSave);
            }
          } else {
            pagesList.push(pageToSave);
          }
          currentPageLines = block;
          currentPageLineIndices = blockIndices;
          currentPageHeight = blockHeight;
          i = j;
        } else {
          currentPageLines.push(...block);
          currentPageLineIndices.push(...blockIndices);
          currentPageHeight += blockHeight;
          i = j;
        }
      } else {
        if (currentPageHeight + lineHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          const pageToSave = currentPageLines.join('\n').trim();
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pagesList.push([...contextLines, ...currentPageLines].join('\n').trim());
              } else {
                pagesList.push(pageToSave);
              }
            } else {
              pagesList.push(pageToSave);
            }
          } else {
            pagesList.push(pageToSave);
          }
          currentPageLines = [line];
          currentPageLineIndices = [i];
          currentPageHeight = lineHeight;
        } else {
          currentPageLines.push(line);
          currentPageLineIndices.push(i);
          currentPageHeight += lineHeight;
        }
        i++;
      }
    }

    if (currentPageLines.length > 0) {
      let pageToSave = currentPageLines.join('\n').trim();
      const parentHeadings = getParentContext(lines, currentPageLineIndices[0]);
      if (parentHeadings.length > 0 && !pageToSave.startsWith('#')) {
        pageToSave = [...parentHeadings, '', pageToSave].join('\n').trim();
      }
      if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
        const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
        if (firstLineIndent >= 2) {
          const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
          if (contextIndices.length > 0) {
            const firstContextIdx = contextIndices[0];
            const firstPageIdx = currentPageLineIndices[0];
            if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
              const contextLines = contextIndices.map(idx => lines[idx]);
              pageToSave = [...contextLines, '', pageToSave].join('\n').trim();
            }
          }
        }
      }
      pagesList.push(pageToSave);
    }

    let inCodeBlock = false;
    const processedPages = pagesList.map((pageContent, idx) => {
      const backtickMatches = pageContent.match(/\`\`\`/g);
      const backtickCount = backtickMatches ? backtickMatches.length : 0;
      
      let processedContent = pageContent;
      if (inCodeBlock && !pageContent.trim().startsWith('\`\`\`')) {
        processedContent = '\`\`\`\n' + processedContent;
      }
      
      for (let i = 0; i < backtickCount; i++) {
        inCodeBlock = !inCodeBlock;
      }
      
      return processedContent;
    });

    console.log("PROCESSED PAGES: ", processedPages);
}

const content = `3. Verify Remote Connection:
   - To check if the remote was added correctly:
     \`\`\`bash
     git remote -v
     \`\`\`
     origin https://github.com/StudentApnaCollege/local-repo.git (fetch)
     origin https://github.com/StudentApnaCollege/local-repo.git (push)
4. **Check Current Branch**:
   - Type \`git branch\`.`;

processContent(content);
