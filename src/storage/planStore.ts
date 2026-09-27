// プランの保存。データはこの端末のブラウザ（localStorage）だけに保存し、外部には送信しない。

import { defaultPlan, normalizePlan, uid } from '../engine/defaults';
import type { Plan } from '../engine/types';

export interface SavedPlan {
  id: string;
  name: string;
  updatedAt: string;
  plan: Plan;
}

export interface StoreState {
  plans: SavedPlan[];
  activeId: string;
}

const KEY = 'creatlifeplan:v1';

export function newSavedPlan(name: string, plan: Plan = defaultPlan()): SavedPlan {
  return { id: uid(), name, updatedAt: new Date().toISOString(), plan };
}

export function initialState(): StoreState {
  const first = newSavedPlan('マイプラン');
  return { plans: [first], activeId: first.id };
}

export function normalizeSaved(raw: unknown): SavedPlan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<SavedPlan>;
  return {
    id: typeof r.id === 'string' ? r.id : uid(),
    name: typeof r.name === 'string' && r.name ? r.name : '読み込んだプラン',
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
    plan: normalizePlan(r.plan),
  };
}

export function loadState(storage: Storage | undefined = globalThis.localStorage): StoreState {
  try {
    const text = storage?.getItem(KEY);
    if (!text) return initialState();
    const raw = JSON.parse(text) as { plans?: unknown[]; activeId?: string };
    const plans = (raw.plans ?? []).map(normalizeSaved).filter((p): p is SavedPlan => p !== null);
    if (plans.length === 0) return initialState();
    const activeId = plans.some((p) => p.id === raw.activeId) ? raw.activeId! : plans[0].id;
    return { plans, activeId };
  } catch {
    return initialState();
  }
}

export function saveState(state: StoreState, storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* 保存領域が使えない環境では何もしない */
  }
}
