import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// UI 路由纯函数运行在 TS 源码中，用本项目已有 TypeScript 依赖编译后测试。
// import type 会被移除，逻辑本身不依赖 React 或浏览器 DOM。
const source = readFileSync(new URL('../src/ui/navigation.ts', import.meta.url), 'utf8');
const out = ts.transpileModule(source, {compilerOptions:{
  module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022,
}}).outputText;
const {TABS, initialNav, reduceNav} =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(out));

test('唯一确认的五 Tab 顺序、工作室默认入口', () => {
  assert.deepEqual(TABS.map(x => x.label), ['工作室','艺人','娱乐圈','日程','通告']);
  assert.deepEqual(TABS.map(x => x.id), ['company','artists','map','schedule','gigs']);
  assert.equal(initialNav().tab, 'company');
});
test('切换 Tab 保留每个 Tab 自己的二级页栈', () => {
  let s = initialNav();
  s = reduceNav(s, {type:'SWITCH_TAB', tab:'map'});
  s = reduceNav(s, {type:'PUSH', page:'district:east'});
  s = reduceNav(s, {type:'SWITCH_TAB', tab:'artists'});
  s = reduceNav(s, {type:'PUSH', page:'artist:lu'});
  s = reduceNav(s, {type:'SWITCH_TAB', tab:'map'});
  assert.deepEqual(s.stack, ['district:east']);
  s = reduceNav(s, {type:'BACK'});
  assert.deepEqual(s.stack, []);
  s = reduceNav(s, {type:'SWITCH_TAB', tab:'artists'});
  assert.deepEqual(s.stack, ['artist:lu']);
});
test('手机和档案覆盖层关闭后回到原页面', () => {
  let s=initialNav();
  s=reduceNav(s,{type:'SWITCH_TAB',tab:'map'});
  s=reduceNav(s,{type:'PUSH',page:'district:south'});
  for(const kind of ['phone','profile','story']){
    let opened=reduceNav(s,{type:'OPEN_OVERLAY',kind});
    assert.equal(opened.overlay,kind);
    opened=reduceNav(opened,{type:'SWITCH_TAB',tab:'company'});
    assert.equal(opened.tab,'map');
    const closed=reduceNav(opened,{type:'CLOSE_OVERLAY'});
    assert.equal(closed.tab,'map');
    assert.deepEqual(closed.stack,['district:south']);
    s=closed;
  }
});
test('重开序章清理所有导航栈，保留正确的工作室返回点', () => {
  let s=reduceNav(initialNav(),{type:'SWITCH_TAB',tab:'gigs'});
  s=reduceNav(s,{type:'PUSH',page:'gig:demo'});
  s=reduceNav(s,{type:'RESET',openStory:true});
  assert.equal(s.tab,'company');
  assert.equal(s.overlay,'story');
  assert.deepEqual(s.stacks.gigs,[]);
  s=reduceNav(s,{type:'CLOSE_OVERLAY'});
  assert.equal(s.tab,'company');
});
