import { describe, expect, it } from 'vitest';
import { createBackup, isEncrypted, PasswordRequiredError, readBackup } from './backup';
import { loadState, newSavedPlan, saveState } from './planStore';

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('planStore', () => {
  it('保存して読み込める', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const a = newSavedPlan('A');
    const b = newSavedPlan('B');
    saveState({ plans: [a, b], activeId: b.id }, storage);
    const s = loadState(storage);
    expect(s.plans.map((p) => p.name)).toEqual(['A', 'B']);
    expect(s.activeId).toBe(b.id);
  });
  it('壊れたデータなら初期状態', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    storage.setItem('creatlifeplan:v1', '{broken');
    expect(loadState(storage).plans).toHaveLength(1);
  });
});

describe('backup', () => {
  it('暗号化なしで往復できる', async () => {
    const text = await createBackup([newSavedPlan('A')]);
    expect(isEncrypted(text)).toBe(false);
    const plans = await readBackup(text);
    expect(plans[0].name).toBe('A');
  });

  it('パスワードで暗号化して往復でき、中身は平文で読めない', async () => {
    const text = await createBackup([newSavedPlan('ひみつのプラン')], 'pass1234');
    expect(isEncrypted(text)).toBe(true);
    expect(text).not.toContain('ひみつ');
    await expect(readBackup(text)).rejects.toBeInstanceOf(PasswordRequiredError);
    await expect(readBackup(text, 'wrong')).rejects.toThrow('パスワードが違います');
    const plans = await readBackup(text, 'pass1234');
    expect(plans[0].name).toBe('ひみつのプラン');
  });
});
