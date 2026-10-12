import type {TabId, ViewLocation, OverlayKind} from '../game/types';

/** ADR-0005: 唯一正式五 Tab。UI 与类型必须使用同一 ID。 */
export const TABS: {id: TabId; label: string; icon: string}[] = [
  {id: 'company', label: '工作室', icon: '⌂'},
  {id: 'artists', label: '艺人', icon: '♧'},
  {id: 'map', label: '娱乐圈', icon: '◇'},
  {id: 'schedule', label: '日程', icon: '▤'},
  {id: 'gigs', label: '通告', icon: '✦'},
];

const emptyStacks = (): Record<TabId, string[]> => ({
  company: [], artists: [], map: [], schedule: [], gigs: [],
});
export const STUDIO_HOME: ViewLocation = {tab: 'company', stack: [], overlay: 'none'};

export type NavState = ViewLocation & {
  /** 每个 Tab 的二级页栈必须独立保存（切换 Tab 时恢复原栈） */
  stacks: Record<TabId, string[]>;
  /** 临时全屏层关闭时回到发起位置 */
  returnTo: {tab: TabId; stack: string[]} | null;
};

export type NavAction =
  | {type: 'SWITCH_TAB'; tab: TabId}
  | {type: 'PUSH'; page: string}
  | {type: 'BACK'}
  | {type: 'OPEN_OVERLAY'; kind: OverlayKind}
  | {type: 'CLOSE_OVERLAY'}
  | {type: 'RESET'; openStory?: boolean};

export function initialNav(): NavState {
  return {...STUDIO_HOME, stack: [], stacks: emptyStacks(), returnTo: null};
}

/** 唯一导航状态入口，既处理主 Tab 又处理「手机/档案/剧情」临时层。 */
export function reduceNav(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'RESET': {
      const fresh = initialNav();
      return action.openStory
        ? {...fresh, overlay: 'story', returnTo: {tab: 'company', stack: []}}
        : fresh;
    }
    case 'SWITCH_TAB':
      if (state.overlay !== 'none') return state;
      return {...state, tab: action.tab, stack: state.stacks[action.tab]};
    case 'PUSH': {
      if (state.overlay !== 'none') return state;
      const stack = [...state.stack, action.page];
      return {...state, stack, stacks: {...state.stacks, [state.tab]: stack}};
    }
    case 'BACK': {
      if (state.overlay !== 'none' || state.stack.length === 0) return state;
      const stack = state.stack.slice(0, -1);
      return {...state, stack, stacks: {...state.stacks, [state.tab]: stack}};
    }
    case 'OPEN_OVERLAY':
      if (state.overlay !== 'none' || action.kind === 'none') return state;
      return {...state, overlay: action.kind, returnTo: {tab: state.tab, stack: state.stack}};
    case 'CLOSE_OVERLAY': {
      if (state.overlay === 'none') return state;
      const back = state.returnTo ?? {tab: state.tab, stack: state.stack};
      return {...state, tab: back.tab, stack: back.stack, overlay: 'none', returnTo: null,
        stacks: {...state.stacks, [back.tab]: back.stack}};
    }
  }
}
