import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { judge, runScenarios, suggestImprovements, type Judgement, type Scenarios, type Suggestion } from '../engine/analysis';
import { assessAffordability, type Affordability } from '../engine/affordability';
import { defaultPlan } from '../engine/defaults';
import type { Plan } from '../engine/types';
import { loadState, newSavedPlan, saveState, type SavedPlan, type StoreState } from '../storage/planStore';

export interface ViewPrefs {
  realValue: boolean; // 現在価値で表示
  axis: 'year' | 'age';
}

interface Ctx {
  state: StoreState;
  active: SavedPlan;
  plan: Plan;
  update: (mutate: (draft: Plan) => void) => void;
  scenarios: Scenarios;
  judgement: Judgement;
  suggestions: Suggestion[];
  affordability: Affordability;
  savedAt: Date | null;
  saveError: boolean;
  prefs: ViewPrefs;
  setPrefs: (p: Partial<ViewPrefs>) => void;
  // プラン管理
  selectPlan: (id: string) => void;
  addPlan: (name: string, plan?: Plan) => void;
  duplicatePlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  importPlans: (plans: SavedPlan[]) => void;
  resetAll: () => void;
}

const StoreContext = createContext<Ctx | null>(null);
const PREFS_KEY = 'creatlifeplan:prefs';

function loadPrefs(): ViewPrefs {
  const def: ViewPrefs = { realValue: false, axis: 'year' };
  try {
    return { ...def, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ViewPrefs>) };
  } catch {
    return def;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(() => loadState());
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [prefs, setPrefsState] = useState<ViewPrefs>(loadPrefs);
  const first = useRef(true);

  // 変更を自動保存（端末内のみ）
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const ok = saveState(state);
      setSaveError(!ok);
      if (ok) setSavedAt(new Date());
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  const setPrefs = useCallback((p: Partial<ViewPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* 保存できなくても表示は切り替える */
      }
      return next;
    });
  }, []);

  const active = state.plans.find((p) => p.id === state.activeId) ?? state.plans[0];
  const plan = active.plan;

  const update = useCallback((mutate: (draft: Plan) => void) => {
    setState((s) => ({
      ...s,
      plans: s.plans.map((p) => {
        if (p.id !== s.activeId) return p;
        const draft = structuredClone(p.plan);
        mutate(draft);
        return { ...p, plan: draft, updatedAt: new Date().toISOString() };
      }),
    }));
  }, []);

  const scenarios = useMemo(() => runScenarios(plan), [plan]);
  const judgement = useMemo(() => judge(scenarios), [scenarios]);
  const suggestions = useMemo(() => suggestImprovements(plan, judgement), [plan, judgement]);
  const affordability = useMemo(() => assessAffordability(plan), [plan]);

  const value: Ctx = {
    state,
    active,
    plan,
    update,
    scenarios,
    judgement,
    suggestions,
    affordability,
    savedAt,
    saveError,
    prefs,
    setPrefs,
    selectPlan: (id) => setState((s) => ({ ...s, activeId: id })),
    addPlan: (name, p) =>
      setState((s) => {
        const n = newSavedPlan(name, p ?? defaultPlan());
        return { plans: [...s.plans, n], activeId: n.id };
      }),
    duplicatePlan: (id) =>
      setState((s) => {
        const src = s.plans.find((p) => p.id === id);
        if (!src) return s;
        const n = newSavedPlan(`${src.name}のコピー`, structuredClone(src.plan));
        return { plans: [...s.plans, n], activeId: n.id };
      }),
    renamePlan: (id, name) =>
      setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === id ? { ...p, name } : p)) })),
    deletePlan: (id) =>
      setState((s) => {
        const plans = s.plans.filter((p) => p.id !== id);
        if (plans.length === 0) {
          const n = newSavedPlan('マイプラン');
          return { plans: [n], activeId: n.id };
        }
        return { plans, activeId: s.activeId === id ? plans[0].id : s.activeId };
      }),
    importPlans: (incoming) =>
      setState((s) => {
        const ids = new Set(s.plans.map((p) => p.id));
        const added = incoming.map((p) => (ids.has(p.id) ? { ...p, id: crypto.randomUUID(), name: `${p.name}（読込）` } : p));
        return { plans: [...s.plans, ...added], activeId: added[0]?.id ?? s.activeId };
      }),
    resetAll: () =>
      setState(() => {
        const n = newSavedPlan('マイプラン');
        return { plans: [n], activeId: n.id };
      }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const c = useContext(StoreContext);
  if (!c) throw new Error('StoreProvider がありません');
  return c;
}
