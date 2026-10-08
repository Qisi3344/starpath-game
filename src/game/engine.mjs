// Alpha shell: deterministic, testable business state. Values are prototype tuning, not final balance.
export const initialState = Object.freeze({
  day: 1, company: '未命名工作室', money: 200, reputation: 45,
  artistSigned: false, trained: false, jobAccepted: false,
  pr: null, settled: false, history: []
});
export function start(company) {
  const safeName = String(company ?? '').trim().slice(0, 20) || '星芒事务所';
  return { ...initialState, company: safeName, history: ['公司成立'] };
}
/** Single writer for state transitions; throws on invalid day/action combinations. */
export function reduceGame(state, action) {
  const next = (change, note) => ({ ...state, ...change, history: [...state.history, note] });
  switch (action.type) {
    case 'SIGN':
      if (state.day !== 1 || state.artistSigned) throw Error('仅在第1天签约初始艺人');
      return next({artistSigned: true,day:2}, '签约陆星遥');
    case 'TRAIN':
      if(state.day!==2 || !state.artistSigned) throw Error('第2天才可安排训练');
      if (state.money < 1) throw Error('资金不足');
      return next({trained:true,money:state.money-1,day:3},'安排唱跳训练');
    case 'SKIP_TRAIN':
      if(state.day!==2 || !state.artistSigned) throw Error('当前不可跳过训练');
      return next({day:3}, '优先寻找通告');
    case 'ACCEPT_JOB':
      if(state.day!==3 || state.jobAccepted===true) throw Error('当前不可接单');
      return next({jobAccepted:true,day:4},'接受《夏日邻座》通告');
    case 'ADVANCE':
      if (state.day!==4 || !state.jobAccepted) throw Error('现在不能推进');
      return next({day:5},'热搜舆论事件触发');
    case 'PR': {
      if (state.day!==5 || state.pr!==null) throw Error('该公关事件已经处理');
      const options={ lawyer:{cost:20,rep:5},statement:{cost:0,rep:2},cold:{cost:0,rep:-5} };
      const result=options[action.method];
      if (!result) throw Error('无效公关决策');
      if (state.money < result.cost) throw Error('资金不足');
      return next({pr:action.method,money:state.money-result.cost,reputation:state.reputation+result.rep,day:6},`公关选择：${action.method}`);
    }
    case 'TO_SETTLEMENT':
      if (state.day!==6 || !state.pr) throw Error('公关尚未完成');
      return next({day:7},'前往第一周结算');
    case 'SETTLE':
      if (state.day!==7 || state.settled || !state.jobAccepted) throw Error('不能重复结算');
      // 25 gross - platform fee 7.5 - artist split 5.25 - weekly operating cost 2.5 = 9.75
      return next({money:Number((state.money+9.75).toFixed(2)),settled:true},'第一周结算完成');
    default: throw Error('未知行动类型');
  }
}
export function getFans(state) { return 5000 + (state.settled ? (state.trained ? 3600 : 2400) : 0); }
