import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeAnswerMarkdown} from '../public/answer-markdown.mjs';
test('answers repair loose bold delimiters without rewriting code examples',()=>{
 const raw='- **A：候选物。 ** 图注 **8** 和 ** n = 1（10） **\n`** literal **`\n```md\n** literal **\n```\n    ** indented code **';
 assert.equal(normalizeAnswerMarkdown(raw),'- **A：候选物。** 图注 **8** 和 **n = 1（10）**\n`** literal **`\n```md\n** literal **\n```\n    ** indented code **');
});
