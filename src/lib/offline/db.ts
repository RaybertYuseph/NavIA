import Dexie, { type EntityTable } from 'dexie';
import type { QueueItem } from './types';

/** seq conserva el orden en que ocurrieron las cosas: el servidor las aplica igual. */
export type StoredItem = QueueItem & { seq?: number };

class NaviaDb extends Dexie {
  queue!: EntityTable<StoredItem, 'seq'>;
  constructor() {
    super('navia');
    this.version(1).stores({ queue: '++seq, id, kind, trip_id' });
  }
}

export const db = new NaviaDb();
