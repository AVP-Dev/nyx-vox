import { describe, it, expect } from 'vitest';
import { cleanHallucinations } from './text';

describe('cleanHallucinations', () => {
    // ── Empty / null / undefined ─────────────────────────────────────────────

    it('returns empty string for undefined', () => {
        expect(cleanHallucinations(undefined)).toBe('');
    });

    it('returns empty string for null', () => {
        expect(cleanHallucinations(null)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(cleanHallucinations('')).toBe('');
    });

    it('returns empty string for whitespace-only', () => {
        expect(cleanHallucinations('   ')).toBe('');
    });

    // ── Capitalize ──────────────────────────────────────────────────────────

    it('capitalizes first letter', () => {
        expect(cleanHallucinations('hello world')).toBe('Hello world');
    });

    it('keeps already capitalized text', () => {
        expect(cleanHallucinations('Hello world')).toBe('Hello world');
    });

    // ── Music / sound markers ───────────────────────────────────────────────

    it('removes [music]', () => {
        expect(cleanHallucinations('[music] hello world')).toBe('Hello world');
    });

    it('removes [silence]', () => {
        expect(cleanHallucinations('hello [silence] world')).toBe('Hello world');
    });

    it('removes [noise]', () => {
        expect(cleanHallucinations('hello world [noise]')).toBe('Hello world');
    });

    it('removes ♪ markers', () => {
        expect(cleanHallucinations('♪ hello world ♪')).toBe('Hello world');
    });

    it('removes (музыка)', () => {
        expect(cleanHallucinations('(музыка) привет мир')).toBe('Привет мир');
    });

    // ── Subtitle credits ────────────────────────────────────────────────────

    it('removes "subtitles by" pattern', () => {
        expect(cleanHallucinations('hello world subtitles by amara.org')).toBe('Hello world');
    });

    it('removes "редактор субтитров"', () => {
        expect(cleanHallucinations('привет мир редактор субтитров')).toBe('Привет мир');
    });

    it('removes "translated by" (not following words)', () => {
        // "translated by" is removed but "someone" remains
        expect(cleanHallucinations('hello world translated by someone')).toBe('Hello world someone');
    });

    // ── Common hallucinations ───────────────────────────────────────────────

    it('removes DimaTorzok', () => {
        expect(cleanHallucinations('hello DimaTorzok world')).toBe('Hello world');
    });

    it('removes "продолжение следует"', () => {
        expect(cleanHallucinations('текст продолжение следует')).toBe('Текст');
    });

    it('removes "to be continued"', () => {
        expect(cleanHallucinations('text to be continued')).toBe('Text');
    });

    it('removes amara.org', () => {
        expect(cleanHallucinations('text amara.org')).toBe('Text');
    });

    // ── YouTube / video endings ─────────────────────────────────────────────

    it('removes "подпишитесь на канал"', () => {
        expect(cleanHallucinations('текст подпишитесь на канал')).toBe('Текст');
    });

    it('removes "спасибо за просмотр"', () => {
        expect(cleanHallucinations('текст спасибо за просмотр')).toBe('Текст');
    });

    // ── Technical markers ───────────────────────────────────────────────────

    it('removes "end of transcript"', () => {
        expect(cleanHallucinations('text end of transcript')).toBe('Text');
    });

    it('removes "конец записи"', () => {
        expect(cleanHallucinations('текст конец записи')).toBe('Текст');
    });

    it('preserves real vocabulary words like "тишина", "партнёр", "реклама"', () => {
        expect(cleanHallucinations('привет тишина мир наш партнёр')).toBe('Привет тишина мир наш партнёр');
    });

    // ── Trailing junk ───────────────────────────────────────────────────────

    it('removes trailing ...', () => {
        expect(cleanHallucinations('hello world...')).toBe('Hello world');
    });

    it('removes trailing —', () => {
        expect(cleanHallucinations('hello world —')).toBe('Hello world');
    });

    it('removes trailing …', () => {
        expect(cleanHallucinations('hello world…')).toBe('Hello world');
    });

    // ── Too short after cleanup ─────────────────────────────────────────────

    it('returns empty if only junk remains', () => {
        expect(cleanHallucinations('[music]')).toBe('');
    });

    it('preserves single character answer', () => {
        expect(cleanHallucinations('[music] a [noise]')).toBe('A');
        expect(cleanHallucinations('5')).toBe('5');
    });

    // ── Normal text preserved ───────────────────────────────────────────────

    it('preserves normal Russian text', () => {
        expect(cleanHallucinations('привет мир как дела')).toBe('Привет мир как дела');
    });

    it('preserves normal English text', () => {
        expect(cleanHallucinations('hello world how are you')).toBe('Hello world how are you');
    });

    it('preserves text with punctuation', () => {
        expect(cleanHallucinations('hello, world! How are you?')).toBe('Hello, world! How are you?');
    });

    // ── Multiple spaces ─────────────────────────────────────────────────────

    it('collapses multiple spaces', () => {
        expect(cleanHallucinations('hello   world')).toBe('Hello world');
    });
});
