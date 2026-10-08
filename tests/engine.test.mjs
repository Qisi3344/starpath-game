import test from 'node:test';
import assert from 'node:assert/strict';
import {start,reduceGame,getFans} from '../src/game/engine.mjs';
function run(actions){return actions.reduce(reduceGame,start('星芒事务所'))}
const prefix=[{type:'SIGN'},{type:'TRAIN'},{type:'ACCEPT_JOB'},{type:'ADVANCE'}];
test('first week training + statement settlement',()=>{
 const s=run([...prefix,{type:'PR',method:'statement'},{type:'TO_SETTLEMENT'},{type:'SETTLE'}]);
 assert.equal(s.company,'星芒事务所');assert.equal(s.day,7);assert.equal(s.money,208.75);assert.equal(s.reputation,47);assert.equal(getFans(s),8600);
});
test('lawyer choice costs 20 and improves rep',()=>{
 const s=run([...prefix,{type:'PR',method:'lawyer'}]);
 assert.equal(s.money,179);assert.equal(s.reputation,50);
});
test('settlement cannot run twice',()=>{
 const s=run([...prefix,{type:'PR',method:'cold'},{type:'TO_SETTLEMENT'},{type:'SETTLE'}]);
 assert.throws(()=>reduceGame(s,{type:'SETTLE'}),/不能重复结算/);
});
test('cannot accept job before first signature',()=>assert.throws(()=>reduceGame(start(''),{type:'ACCEPT_JOB'})));
