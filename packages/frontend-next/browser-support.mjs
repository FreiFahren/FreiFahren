import { readFileSync } from 'node:fs';

// Keep Vite's syntax/CSS targets and API linting on the same browser floor.
const browsers = readFileSync(new URL('./.browserslistrc', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

export const buildTargets = browsers.map((browser) => {
  const match = /^(chrome|edge|firefox|safari|ios_saf) (\d+(?:\.\d+)?)$/.exec(browser);
  if (!match) throw new Error(`Unsupported build target: ${browser}`);
  return `${match[1] === 'ios_saf' ? 'ios' : match[1]}${match[2]}`;
});
