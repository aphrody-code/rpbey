import { InMemoryDatabase } from 'brackets-memory-db';
import { BracketsManager } from '../brackets-manager/index';
import { BracketsViewer } from './main';

if (typeof window !== 'undefined') {
    (window as any).bracketsViewer = new BracketsViewer();
    (window as any).inMemoryDatabase = new InMemoryDatabase();
    (window as any).bracketsManager = new BracketsManager((window as any).inMemoryDatabase);
}

export { BracketsViewer };
export * from './types';
