import type {TabId, ViewLocation, OverlayKind} from '../game/types';

/**
 * 底部 Tab 的唯一配置点（页面树文档第三节）。
 * 当前为 V1.6.2 原案；玩家确认新提案后只改这里，页面组件不动。
 */
export const TABS: {id: TabId; label: string; icon: string}[] = [
  {id: 'map', label: '大地图', icon: '✧'},
  {id: 'company', label: '公司', icon: '⌂'},
  {id: 'artists', label: '艺人', icon: '♧'},
  {id: 'gigs', label: '通告', icon: '✦'},
  {id: 'profile', label: '我的', icon: '❀'},
];

/** 每个 Tab 的默认落点（工作室总览 = 公司 Tab 首屏） */
export const STUDIO_HOME: ViewLocation = {tab: 'company', stack: [], overlay: 'none'};

export type NavState = ViewLocation & {
  /** 全屏层从哪个业务位置发起，关闭时回到这里 */
  returnTo: {tab: TabId; stack: string[]} | null;
};

export type NavAction =
  | {type: 'SWITCH_TAB'; tab: TabId}
  | {type: 'PUSH'; page: string}
  | {type: 'BACK'}
  | {type: 'OPEN_OVERLAY'; kind: OverlayKind}
  | {type: 'CLOSE_OVERLAY'};

export function initialNav(): NavState {
  return {...STUDIO_HOME, returnTo: null};
}

/** 单一写入者：切 Tab 保留各自二级栈；overlay 不叠放；返回链到 Tab 首屏为止 */
export function reduceNav(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'SWITCH_TAB':
      return {...state, tab: action.tab, stack: [], overlay: 'none', returnTo: null};
    case 'PUSH':
      return state.overlay !== 'none' ? state : {...state, stack: [...state.stack, action.page]};
    case 'BACK':
      return state.stack.length === 0 ? state : {...state, stack: state.stack.slice(0, -1)};
    case 'OPEN_OVERLAY': {
      if (state.overlay !== 'none') return state;
      return {...state, overlay: action.kind, returnTo: {tab: state.tab, stack: state.stack}};
    }
    case 'CLOSE_OVERLAY': {
      if (state.overlay === 'none') return state;
      const back = state.returnTo ?? {tab: state.tab, stack: state.stack};
      return {...state, tab: back.tab, stack: back.stack, overlay: 'none', returnTo: null};
    }
  }
}
