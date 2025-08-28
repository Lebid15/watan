'use client';
import ar from './ar.json';

type Dict = Record<string, any>;
const dict: Dict = ar as any;

function resolve(key: string): string {
  const parts = key.split('.');
  let cur: any = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) cur = cur[p]; else return key;
  }
  return typeof cur === 'string' ? cur : key;
}

function interpolate(s: string, vars?: Record<string, any>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function t(key: string, vars?: Record<string, any>) {
  return interpolate(resolve(key), vars);
}

export function useT() {
  return (key: string, vars?: Record<string, any>) => t(key, vars);
}

export default useT;
