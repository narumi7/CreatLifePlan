import { describe, expect, it } from 'vitest';
import { assessAffordability, SAFE_REPAYMENT_RATIO, withPurchasePrice } from './affordability';
import { defaultPlan } from './defaults';
import { simulate } from './simulate';
import { MAN } from './standards';

const plan = () => defaultPlan(new Date('2026-06-01'));

describe('assessAffordability', () => {
  it('安心ライン ≤ 上限 で、上限の価格ならショートせず、少し上ではショートする', () => {
    const p = plan();
    const a = assessAffordability(p);
    expect(a.max).not.toBeNull();
    expect(a.safe).not.toBeNull();
    expect(a.safe!.price).toBeLessThanOrEqual(a.max!.price);
    expect(simulate(withPurchasePrice(p, a.max!.price)).summary.shortageYear).toBeNull();
    expect(simulate(withPurchasePrice(p, a.max!.price + 100 * MAN)).summary.shortageYear).not.toBeNull();
  });

  it('安心ラインは返済負担率の目安以内', () => {
    const a = assessAffordability(plan());
    expect(a.safe!.repaymentRatio).toBeLessThanOrEqual(SAFE_REPAYMENT_RATIO + 1e-9);
  });

  it('収入が増えると買える上限も上がる', () => {
    const p = plan();
    const base = assessAffordability(p).max!.price;
    p.self.income.annualGross *= 1.5;
    expect(assessAffordability(p).max!.price).toBeGreaterThan(base);
  });

  it('住宅なしでもショートする家計では上限なしとして助言する', () => {
    const p = plan();
    p.spouse.enabled = false;
    p.budget.variable[0].amount = 400_000;
    const a = assessAffordability(p);
    expect(a.max).toBeNull();
    expect(a.shortWithoutHouse).toBe(true);
    expect(a.advice[0]).toContain('見直し');
  });

  it('固定資産税は価格に比例する', () => {
    const p = plan();
    const q = withPurchasePrice(p, p.housing.purchase.price * 2);
    expect(q.housing.purchase.propertyTax).toBeCloseTo(p.housing.purchase.propertyTax * 2);
    expect(q.housing.purchase.enabled).toBe(true);
  });
});
