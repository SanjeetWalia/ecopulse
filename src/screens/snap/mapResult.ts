// src/screens/snap/mapResult.ts
//
// Turns an analyze-snap result into the shapes the reads render. Anything the
// model couldn't read comes back null, and the read shows the correction
// prompt instead of inventing a value.

import type { MenuReadData, LabelReadData, ShelfReadData, ReceiptReadData } from './Reads';

const LB = 2.20462;
const kgToLb = (kg: unknown) => Number(((Number(kg) || 0) * LB).toFixed(1));

export function menuFrom(r: any): MenuReadData | null {
  const dishes = r?.menu?.dishes;
  if (!Array.isArray(dishes) || dishes.length === 0) return null;
  const mapped = dishes.slice(0, 8).map((d: any, i: number) => ({
    id: `d${i}`,
    name: String(d.name ?? 'Dish'),
    lb: kgToLb(d.kg),
    kcal: [Math.round(Number(d.kcal_lo) || 0), Math.round(Number(d.kcal_hi) || 0)] as [number, number],
    price: d.price ? Number(d.price) : undefined,
  }));
  const sorted = [...mapped].sort((a, b) => a.lb - b.lb);
  const median = sorted[Math.floor(sorted.length / 2)].lb;
  // "Lighter" = the lightest third of what's on this menu.
  const cut = sorted[Math.max(0, Math.ceil(sorted.length / 3) - 1)].lb;
  return {
    restaurant: r.menu.restaurant ?? '',
    dishes: mapped.map((d) => ({ ...d, lighter: d.lb <= cut })),
    // Until the backend reads the user's usual order from memory, compare
    // against the middle of this menu.
    usualLb: median,
  };
}

export function labelFrom(r: any): LabelReadData | null {
  const l = r?.label_read;
  if (!l) return null;
  return {
    brand: l.brand ?? '',
    product: l.product ?? r.label ?? 'Product',
    size: l.size ?? '',
    lb: kgToLb(r.co2_kg),
    packaging: l.packaging ?? 'Packaging not readable',
    facts: Array.isArray(l.facts) ? l.facts.slice(0, 4).map((f: any) => ({ label: String(f.label ?? 'On the label'), text: String(f.text ?? '') })) : [],
    nutrition: l.nutrition
      ? { kcal: Number(l.nutrition.kcal) || 0, proteinG: Number(l.nutrition.protein_g) || 0, sugarG: Number(l.nutrition.sugar_g) || 0, per: String(l.nutrition.per ?? 'per serving') }
      : { kcal: 0, proteinG: 0, sugarG: 0, per: '' },
    source: 'Read from the label',
  };
}

export function shelfFrom(r: any): ShelfReadData | null {
  const a = r?.shelf?.a;
  const b = r?.shelf?.b;
  if (!a || !b) return null;
  const side = (p: any) => ({
    name: String(p.name ?? 'Product'),
    lb: kgToLb(p.kg),
    usdPerUnit: Number(p.unit_price) || 0,
    unit: String(p.unit ?? 'unit'),
    kcal: Number(p.kcal) || 0,
    proteinG: Number(p.protein_g) || 0,
  });
  return { a: side(a), b: side(b) };
}

export function receiptFrom(r: any): ReceiptReadData | null {
  const lines = r?.receipt?.lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const byCat: Record<string, { lb: number; usd: number }> = {};
  lines.forEach((l: any) => {
    const c = String(l.category ?? 'Other');
    byCat[c] = byCat[c] ?? { lb: 0, usd: 0 };
    byCat[c].lb += (Number(l.kg) || 0) * LB;
    byCat[c].usd += Number(l.usd) || 0;
  });
  return {
    store: String(r.receipt.store ?? 'Your'),
    totalUsd: Number(r.receipt.total_usd) || Object.values(byCat).reduce((t, v) => t + v.usd, 0),
    lines: Object.entries(byCat).map(([cat, v]) => ({ cat, lb: v.lb, usd: v.usd })),
    // Swaps come from the fact library in a later pass; none is shown until then.
    swap: { text: '', lb: 0, usd: 0 },
  };
}

export function receiptProducts(r: any): { name: string; brand: string }[] {
  const lines = r?.receipt?.lines;
  if (!Array.isArray(lines)) return [];
  // Receipts usually lead with the brand ("OATLY BARISTA 32OZ"), so the first
  // word stands in for it. The matcher still needs a product word too.
  return lines
    .slice(0, 40)
    .map((l: any) => {
      const name = String(l.name ?? '').trim();
      return { name, brand: name.split(/\s+/)[0] ?? '' };
    })
    .filter((l: any) => l.name && l.brand.length >= 3);
}

export interface GenericData {
  title: string;
  value: string;
  unit: string;
  line: string;
  rows: { label: string; text: string }[];
  asks?: string;
}

export function genericFrom(kind: string, r: any): GenericData | null {
  if (!r) return null;
  const lb = kgToLb(r.co2_kg);
  switch (kind) {
    case 'fuel':
      return r.fuel
        ? { title: r.label, value: lb.toFixed(0), unit: 'lb CO₂e', line: `${r.fuel.gallons} gallons${r.fuel.grade ? `, ${r.fuel.grade}` : ''}.`, rows: r.fuel.total_usd ? [{ label: 'Cost', text: `$${Number(r.fuel.total_usd).toFixed(2)}` }] : [] }
        : null;
    case 'fridge':
      return Array.isArray(r.fridge)
        ? {
            title: r.label,
            value: (r.fridge.reduce((t: number, i: any) => t + (Number(i.kg) || 0), 0) * LB).toFixed(1),
            unit: 'lb at risk',
            line: 'Close to their best days.',
            rows: r.fridge.slice(0, 5).map((i: any) => ({ label: String(i.name), text: `About ${i.days_left} ${Number(i.days_left) === 1 ? 'day' : 'days'} left.` })),
          }
        : null;
    case 'tag':
      return Array.isArray(r.tag)
        ? { title: r.tag.map((f: any) => `${f.pct}% ${f.fibre}`).join(', '), value: lb.toFixed(0), unit: 'lb CO₂e', line: 'Most of a garment’s footprint is made before you wear it.', rows: [] }
        : null;
    case 'bin':
      return r.bin
        ? { title: String(r.bin.item ?? r.label), value: String(r.bin.stream ?? '').replace(/^\w/, (c: string) => c.toUpperCase()), unit: '', line: String(r.bin.why ?? ''), rows: [{ label: 'Check', text: 'Rules vary by city. Your city’s guide has the final word.' }] }
        : null;
    case 'bill':
      return { title: r.label, value: lb.toFixed(0), unit: 'lb CO₂e', line: r.bill ? `${r.bill.kwh} kWh over ${r.bill.period_days} days.` : '', rows: [] };
    default:
      return null;
  }
}
