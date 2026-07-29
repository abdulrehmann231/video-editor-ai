import { randomUUID } from 'node:crypto';

/** Short, URL-safe, sortable-ish id: <base36 time>-<random>. */
export function newId(prefix = ''): string {
  const rand = randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}${rand}`;
}

/** Sanitize a user-provided filename for safe use inside an object key. */
export function safeFilename(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120) || 'file';
}
