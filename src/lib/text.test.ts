import { describe, it, expect } from 'vitest';
import { splitCommittedAndDraft } from './text';

describe('splitCommittedAndDraft', () => {
    it('handles empty and null inputs', () => {
        expect(splitCommittedAndDraft('')).toEqual({ committed: '', draft: '' });
        expect(splitCommittedAndDraft(null)).toEqual({ committed: '', draft: '' });
        expect(splitCommittedAndDraft(undefined)).toEqual({ committed: '', draft: '' });
    });

    it('returns all as draft when 2 or fewer words', () => {
        expect(splitCommittedAndDraft('Привет')).toEqual({ committed: '', draft: 'Привет' });
        expect(splitCommittedAndDraft('Привет мир')).toEqual({ committed: '', draft: 'Привет мир' });
    });

    it('splits into committed prefix and 2-word draft tail for longer sentences', () => {
        expect(splitCommittedAndDraft('Привет как дела сегодня')).toEqual({
            committed: 'Привет как',
            draft: 'дела сегодня',
        });
        expect(splitCommittedAndDraft('Мы разрабатываем приложение для голосового ввода')).toEqual({
            committed: 'Мы разрабатываем приложение для',
            draft: 'голосового ввода',
        });
    });
});
