const DiffService = require('../services/DiffService');

describe('DiffService', () => {
    describe('computeDiff', () => {
        it('should detect no changes for identical objects', () => {
            const obj = { a: 1, b: 2 };
            const result = DiffService.computeDiff(obj, obj);

            expect(result.hasChanges).toBe(false);
            expect(result.changes).toEqual([]);
            expect(result.summary).toBe('No changes detected');
        });

        it('should detect added fields', () => {
            const oldData = { a: 1 };
            const newData = { a: 1, b: 2 };

            const result = DiffService.computeDiff(oldData, newData);

            expect(result.hasChanges).toBe(true);
            expect(result.added).toBe(1);
            expect(result.changes[0].type).toBe('added');
            expect(result.changes[0].path).toBe('b');
        });

        it('should detect modified fields', () => {
            const oldData = { a: 1 };
            const newData = { a: 2 };

            const result = DiffService.computeDiff(oldData, newData);

            expect(result.hasChanges).toBe(true);
            expect(result.modified).toBe(1);
            expect(result.changes[0].type).toBe('modified');
            expect(result.changes[0].path).toBe('a');
            expect(result.changes[0].oldValue).toBe(1);
            expect(result.changes[0].newValue).toBe(2);
        });

        it('should detect deleted fields', () => {
            const oldData = { a: 1, b: 2 };
            const newData = { a: 1 };

            const result = DiffService.computeDiff(oldData, newData);

            expect(result.hasChanges).toBe(true);
            expect(result.deleted).toBe(1);
            expect(result.changes[0].type).toBe('deleted');
            expect(result.changes[0].path).toBe('b');
        });

        it('should handle nested objects', () => {
            const oldData = { config: { retry: 3 } };
            const newData = { config: { retry: 5, timeout: 1000 } };

            const result = DiffService.computeDiff(oldData, newData);

            expect(result.hasChanges).toBe(true);
            expect(result.changes.length).toBeGreaterThan(0);
        });

        it('should generate correct summary', () => {
            const oldData = { a: 1, b: 2, c: 3 };
            const newData = { a: 2, b: 2, d: 4 };

            const result = DiffService.computeDiff(oldData, newData);

            expect(result.summary).toContain('modified');
            expect(result.summary).toContain('added');
            expect(result.summary).toContain('deleted');
        });
    });

    describe('generateChangeLog', () => {
        it('should return "No changes" for empty diff', () => {
            const diff = { hasChanges: false };
            const result = DiffService.generateChangeLog(diff);

            expect(result).toBe('No changes');
        });

        it('should generate changelog for changes', () => {
            const diff = {
                hasChanges: true,
                changes: [
                    { type: 'added', path: 'timeout' },
                    { type: 'modified', path: 'retry' },
                ],
            };

            const result = DiffService.generateChangeLog(diff);

            expect(result).toContain('Added timeout');
            expect(result).toContain('Modified retry');
        });

        it('should truncate long changelogs', () => {
            const changes = Array(10).fill(null).map((_, i) => ({
                type: 'added',
                path: `field${i}`,
            }));

            const diff = { hasChanges: true, changes };
            const result = DiffService.generateChangeLog(diff, 20);

            expect(result).toContain('...');
        });
    });

    describe('applyPatch', () => {
        it('should apply added changes', () => {
            const original = { a: 1 };
            const patch = {
                changes: [{ type: 'added', path: 'b', newValue: 2 }],
            };

            const result = DiffService.applyPatch(original, patch);

            expect(result).toEqual({ a: 1, b: 2 });
        });

        it('should apply modified changes', () => {
            const original = { a: 1 };
            const patch = {
                changes: [{ type: 'modified', path: 'a', newValue: 2 }],
            };

            const result = DiffService.applyPatch(original, patch);

            expect(result.a).toBe(2);
        });

        it('should apply deleted changes', () => {
            const original = { a: 1, b: 2 };
            const patch = {
                changes: [{ type: 'deleted', path: 'b' }],
            };

            const result = DiffService.applyPatch(original, patch);

            expect(result).toEqual({ a: 1 });
            expect(result.b).toBeUndefined();
        });

        it('should not mutate original object', () => {
            const original = { a: 1 };
            const patch = {
                changes: [{ type: 'added', path: 'b', newValue: 2 }],
            };

            const result = DiffService.applyPatch(original, patch);

            expect(original).toEqual({ a: 1 });
            expect(result).toEqual({ a: 1, b: 2 });
        });
    });
});
