import { marked } from 'marked';
// Wait, react-markdown uses remark!
import { remark } from 'remark';
import remarkMath from 'remark-math';
import remarkHtml from 'remark-html';

const markdown = `
1. **Check Initial Status**:
   - **Expected Output**:
     Your branch is up to date with 'origin/main'.
`;

remark()
  .use(remarkMath)
  .use(remarkHtml)
  .process(markdown)
  .then((file) => console.log(String(file)));
