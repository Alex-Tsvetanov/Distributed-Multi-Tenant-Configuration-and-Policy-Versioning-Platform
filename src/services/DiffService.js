const deepDiff = require('deep-diff');
const _ = require('lodash');

class DiffService {
    static computeDiff(oldData, newData) {
        const differences = deepDiff.diff(oldData, newData);
        
        if (!differences) {
            return {
                hasChanges: false,
                changes: [],
                summary: 'No changes detected'
            };
        }

        const changes = differences.map(diff => ({
            type: this.getChangeType(diff),
            path: diff.path ? diff.path.join('.') : 'root',
            oldValue: diff.lhs,
            newValue: diff.rhs
        }));

        const summary = this.generateSummary(changes);

        return {
            hasChanges: true,
            changes,
            summary,
            added: changes.filter(c => c.type === 'added').length,
            modified: changes.filter(c => c.type === 'modified').length,
            deleted: changes.filter(c => c.type === 'deleted').length
        };
    }

    static getChangeType(diff) {
        if (diff.kind === 'N') return 'added';
        if (diff.kind === 'D') return 'deleted';
        if (diff.kind === 'E') return 'modified';
        if (diff.kind === 'A') return 'array_modified';
        return 'unknown';
    }

    static generateSummary(changes) {
        const counts = {
            added: changes.filter(c => c.type === 'added').length,
            modified: changes.filter(c => c.type === 'modified').length,
            deleted: changes.filter(c => c.type === 'deleted').length
        };

        const parts = [];
        if (counts.added > 0) parts.push(`${counts.added} added`);
        if (counts.modified > 0) parts.push(`${counts.modified} modified`);
        if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);

        return parts.join(', ') || 'No changes';
    }

    static applyPatch(original, patch) {
        const result = _.cloneDeep(original);
        
        for (const change of patch.changes || []) {
            if (change.type === 'added' || change.type === 'modified') {
                _.set(result, change.path, change.newValue);
            } else if (change.type === 'deleted') {
                _.unset(result, change.path);
            }
        }

        return result;
    }

    static generateChangeLog(diff, maxLength = 200) {
        if (!diff.hasChanges) {
            return 'No changes';
        }

        const changeDescriptions = diff.changes.slice(0, 3).map(change => {
            if (change.type === 'added') {
                return `Added ${change.path}`;
            } else if (change.type === 'modified') {
                return `Modified ${change.path}`;
            } else if (change.type === 'deleted') {
                return `Deleted ${change.path}`;
            }
            return `Changed ${change.path}`;
        });

        let description = changeDescriptions.join('; ');
        if (diff.changes.length > 3) {
            description += ` (+${diff.changes.length - 3} more)`;
        }

        return description.length > maxLength 
            ? description.substring(0, maxLength) + '...' 
            : description;
    }
}

module.exports = DiffService;
