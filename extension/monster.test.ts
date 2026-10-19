import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import type { EvolutionStage, MonsterProps, MonsterState } from '../src/components/Monster';

// Render the production component. CSS is loaded separately into the DOM below so
// palette assertions exercise the real stylesheet as well as the generated SVG.
const bundled = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import Monster from './src/components/Monster';
      export const renderMonster = props => renderToStaticMarkup(React.createElement(Monster, props));
    `,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    sourcefile: 'monster-render-test.tsx',
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['react', 'react-dom/server'],
  loader: { '.css': 'empty' },
});
const loaded = { exports: {} as { renderMonster: (props: MonsterProps) => string } };
runInNewContext(bundled.outputFiles[0]!.text, {
  module: loaded,
  exports: loaded.exports,
  require: createRequire(import.meta.url),
});
const renderMonster = loaded.exports.renderMonster;
const stylesheet = await readFile(new URL('../src/components/Monster.css', import.meta.url), 'utf8');

function rendered(props: MonsterProps) {
  const dom = new JSDOM('<!doctype html><head></head><body></body>');
  const style = dom.window.document.createElement('style');
  style.textContent = stylesheet;
  dom.window.document.head.append(style);
  dom.window.document.body.innerHTML = renderMonster(props);
  const svg = dom.window.document.querySelector('svg')!;
  return { dom, svg, close: () => dom.window.close() };
}

const originalOutline = 'M24 8h12v12h24V8h12v12h8v8h8v12h5v24h-5v12h-8v8h-8v8H56V80H40v12H24V80h-8v-8H8V60H3V40h5V28h8v-8h8Z';
const originalBody = 'M28 12h4v16H20v8h-8v12H7v8h5v12h8v8h8v12h8V76h24v12h8V76h8v-8h8V56h5v-8h-5V36h-8v-8H64V12h4v12h-8v4H36v-4h-8Z';

test('omitted evolution props retain the original desktop creature silhouette and lime palette', (t) => {
  assert.equal(renderMonster({ state: 'IDLE' }), renderMonster({ state: 'IDLE', evolutionStage: 0, mood: null }));
  const picture = rendered({ state: 'IDLE' });
  t.after(picture.close);
  assert.equal(picture.svg.getAttribute('viewBox'), '0 0 96 96');
  assert.ok(picture.svg.querySelector(`path[d="${originalOutline}"][fill="#24263b"]`));
  assert.ok(picture.svg.querySelector(`path[d="${originalBody}"][fill="var(--monster-body)"]`));
  assert.equal(picture.dom.window.getComputedStyle(picture.svg).getPropertyValue('--monster-body').trim(), '#c5ed54');
  assert.equal(picture.svg.querySelector('.monster__sprouts, .monster__horns, .monster__wings, .monster__crown, .monster__tail'), null);
});

const stages: Array<{ stage: EvolutionStage; color: string; feature: string | null }> = [
  { stage: 0, color: '#c5ed54', feature: null },
  { stage: 1, color: '#62e0b6', feature: '.monster__sprouts' },
  { stage: 2, color: '#79b9ff', feature: '.monster__horns' },
  { stage: 3, color: '#c39aff', feature: '.monster__wings' },
  { stage: 4, color: '#ff9ab5', feature: '.monster__crown' },
];

test('all five stages render different geometry and apply their actual CSS body color', (t) => {
  const silhouettes = new Set<string>();
  for (const { stage, color, feature } of stages) {
    const picture = rendered({ state: 'IDLE', evolutionStage: stage });
    t.after(picture.close);
    const { svg, dom } = picture;
    assert.equal(svg.dataset.evolutionStage, String(stage));
    assert.equal(dom.window.getComputedStyle(svg).getPropertyValue('--monster-body').trim(), color);
    assert.ok(svg.querySelector('[fill="var(--monster-body)"]'), 'the palette must color actual body geometry');
    assert.ok(svg.querySelector('.monster__eyes [fill="#fffef1"]'), 'white eyes must survive recoloring');
    assert.ok(svg.querySelector(`path[d="${originalOutline}"][fill="#24263b"]`), 'the outline must retain its ink color');
    if (feature) assert.ok(svg.querySelector(`${feature} path`), `stage ${stage} needs visible geometry for ${feature}`);
    silhouettes.add([...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'));
  }
  assert.equal(silhouettes.size, 5, 'a palette or class change alone is not a new silhouette');
});

test('the final stage retains both wings, chunky body, horns, crown, tail and gold body accents', (t) => {
  const picture = rendered({ state: 'IDLE', evolutionStage: 4 });
  t.after(picture.close);
  const { svg } = picture;
  assert.equal(svg.querySelectorAll('.monster__wing').length, 2);
  for (const feature of ['.monster__grown-body', '.monster__horns', '.monster__crown', '.monster__tail']) {
    assert.ok(svg.querySelector(`${feature} path`), `${feature} should contain actual rendered paths`);
  }
  assert.ok(svg.querySelector('.monster__royal-details > path[fill="var(--monster-accent)"]'));
  assert.equal(picture.dom.window.getComputedStyle(svg).getPropertyValue('--monster-accent').trim(), '#ffe18a');
  assert.equal(picture.dom.window.getComputedStyle(svg).overflow, 'visible', 'evolved extremities must not be clipped to the original viewBox');
});

for (const state of ['IDLE', 'SEARCH', 'CHASE', 'EAT', 'ESCAPE', 'CAPTURED'] as MonsterState[]) {
  test(`final-stage anatomy preserves the ${state} expression and accessible description`, (t) => {
    const picture = rendered({ state, evolutionStage: 4 });
    t.after(picture.close);
    const { svg } = picture;
    assert.ok(svg.classList.contains(`monster--${state.toLowerCase()}`));
    assert.equal(svg.getAttribute('role'), 'img');
    assert.match(svg.getAttribute('aria-label')!, /小怪物.*进化阶段 5/);
    assert.ok(svg.querySelector('.monster__crown path'));
    assert.ok(svg.querySelector('.monster__tail path'));
    assert.equal(svg.querySelectorAll('.monster__wing').length, 2);
    if (state === 'CAPTURED') {
      assert.ok(svg.querySelector('.monster__dizzy path'));
      assert.ok(svg.querySelector('.monster__stars path'));
      assert.equal(svg.querySelector('.monster__eyes'), null);
    } else {
      assert.ok(svg.querySelector('.monster__eyes path'));
      assert.ok(svg.querySelector('.monster__mouth path'));
      assert.equal(Boolean(svg.querySelector('.monster__mouth--eating')), state === 'EAT');
      assert.equal(Boolean(svg.querySelector('.monster__alarm path')), state === 'ESCAPE');
    }
  });
}

test('happy and evolving moods add real marks and animation hooks without changing the selected anatomy', (t) => {
  for (const mood of ['happy', 'evolving'] as const) {
    const picture = rendered({ state: 'EAT', evolutionStage: 4, mood });
    t.after(picture.close);
    assert.ok(picture.svg.classList.contains(`monster--${mood}`));
    assert.ok(picture.svg.querySelector('.monster__crown path'));
    assert.ok(picture.svg.querySelector('.monster__mouth--eating path'));
    if (mood === 'happy') {
      assert.ok(picture.svg.querySelector('.monster__happy-marks path[fill], .monster__happy-marks[fill] path'));
      assert.equal(picture.svg.querySelector('.monster__evolution-aura'), null);
    } else {
      assert.ok(picture.svg.querySelector('.monster__evolution-ring'));
      assert.ok(picture.svg.querySelector('.monster__evolution-sparks path'));
      assert.match(picture.svg.getAttribute('aria-label')!, /正在进化/);
      assert.equal(picture.svg.querySelector('.monster__happy-marks'), null);
    }
  }
});

test('left-facing evolution mirrors the entire creature without dropping any geometry', (t) => {
  const left = rendered({ state: 'CHASE', evolutionStage: 4, facing: -1 });
  const right = rendered({ state: 'CHASE', evolutionStage: 4, facing: 1 });
  t.after(left.close);
  t.after(right.close);
  assert.ok(left.svg.querySelector(':scope > g[transform="translate(96 0) scale(-1 1)"]'));
  const paths = (svg: SVGSVGElement) => [...svg.querySelectorAll('path')].map(path => ({ d: path.getAttribute('d'), fill: path.getAttribute('fill') }));
  assert.deepEqual(paths(left.svg), paths(right.svg));
});
