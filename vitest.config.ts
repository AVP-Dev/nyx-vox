import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: [],
        // E2E tests are Playwright specs (e2e/) and must not run under Vitest.
        exclude: ['node_modules/**', 'e2e/**', 'dist/**', 'out/**', '.next/**'],
    },
});
