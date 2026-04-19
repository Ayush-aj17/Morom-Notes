const content = `3. Verify Remote Connection:
   - To check if the remote was added correctly:
     \`\`\`bash
     git remote -v
     \`\`\`
     origin https://github.com/StudentApnaCollege/local-repo.git (fetch)
     origin https://github.com/StudentApnaCollege/local-repo.git (push)
4. **Check Current Branch**:
   - Type \`git branch\`.`;

const lines = content.split('\n');

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

console.log("Context for line 2:", getContextIndices(lines, 2));
console.log("Context for line 6:", getContextIndices(lines, 6));

