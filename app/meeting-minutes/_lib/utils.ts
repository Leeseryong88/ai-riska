import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function quarterOfMonth(m: number): number {
  return Math.floor((m - 1) / 3) + 1;
}
