#!/usr/bin/env ts-node
import { estimateReadingTime } from '../src/lib/readingTime';

const samples = [
  '# Title\nSome short content.',
  'A '.repeat(400), // ~400 words
  '```js\nconsole.log("code block");\n```\nRegular text after code block to measure reading time properly.'
];

samples.forEach((sample, i) => {
  const r = estimateReadingTime(sample);
  console.log(`Sample ${i+1}:`, r);
});
