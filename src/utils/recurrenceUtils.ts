import { RecurrenceRule } from "../domain/entities/Task";

export interface Occurrence {
  date: string;
  time: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generateOccurrencesBetween(
  startDate: string,
  endDate: string,
  rule: RecurrenceRule,
  ruleStartDate: string,
  defaultTime: string | null
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const anchor = parseDate(ruleStartDate);

  if (start > end) {
    return occurrences;
  }

  const times = normalizeTimes(rule, defaultTime);
  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    if (current < anchor) {
      continue;
    }

    if (!matchesRecurrence(current, anchor, rule, interval)) {
      continue;
    }

    const dateStr = formatDate(current);
    for (const time of times) {
      occurrences.push({ date: dateStr, time });
      if (rule.count && occurrences.length >= rule.count) {
        return occurrences;
      }
    }
  }

  return occurrences;
}

export function getOccurrencesForDate(
  date: string,
  rule: RecurrenceRule,
  ruleStartDate: string,
  defaultTime: string | null
): Occurrence[] {
  if (rule.count && rule.count > 0) {
    return generateOccurrencesBetween(ruleStartDate, date, rule, ruleStartDate, defaultTime)
      .filter((occ) => occ.date === date);
  }

  const target = parseDate(date);
  const anchor = parseDate(ruleStartDate);
  if (target < anchor) {
    return [];
  }

  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;
  if (!matchesRecurrence(target, anchor, rule, interval)) {
    return [];
  }

  const times = normalizeTimes(rule, defaultTime);
  return times.map(time => ({ date, time }));
}

function matchesRecurrence(date: Date, anchor: Date, rule: RecurrenceRule, interval: number): boolean {
  switch (rule.frequency) {
    case 'daily':
      return daysBetween(anchor, date) % interval === 0;
    case 'weekly': {
      const weeksBetween = Math.floor(daysBetween(anchor, date) / 7);
      if (weeksBetween % interval !== 0) return false;
      const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek
        : [getIsoDayOfWeek(anchor)];
      return daysOfWeek.includes(getIsoDayOfWeek(date));
    }
    case 'monthly': {
      const monthsBetween = monthDifference(anchor, date);
      if (monthsBetween % interval !== 0) return false;
      const dayOfMonth = rule.dayOfMonth || anchor.getDate();
      return date.getDate() === dayOfMonth;
    }
    case 'yearly': {
      const yearsBetween = date.getFullYear() - anchor.getFullYear();
      if (yearsBetween % interval !== 0) return false;
      return date.getMonth() === anchor.getMonth() && date.getDate() === anchor.getDate();
    }
    default:
      return false;
  }
}

function normalizeTimes(rule: RecurrenceRule, defaultTime: string | null): (string | null)[] {
  if (rule.times && rule.times.length > 0) {
    const unique = Array.from(new Set(rule.times.filter(Boolean)));
    return unique.length > 0 ? unique : [null];
  }
  if (defaultTime) {
    return [defaultTime];
  }
  return [null];
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((stripTime(end).getTime() - stripTime(start).getTime()) / MS_PER_DAY);
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthDifference(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function getIsoDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}
