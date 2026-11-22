import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const html = readFileSync(resolve('docs/index.html'), 'utf8');
const script = readFileSync(resolve('docs/downloads.js'), 'utf8');
const releaseRoot = 'https://github.com/AVP-Dev/nyx-vox/releases';
const asset = (version: string, name: string) => ({
    name,
    browser_download_url: `${releaseRoot}/download/${version}/${name}`,
});

const versionPicker = '#download-version';
const buildPicker = '#download-build';
type DownloadWindow = Window & { updateDownloadLanguage: (language: string) => void };

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

function loadPage(response: unknown, status = 200) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.body.replaceChildren(...parsed.body.children);
    const fetchReleases = vi.fn(async () => new Response(JSON.stringify(response), { status }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    new Function('fetch', script)(fetchReleases);
    return window as unknown as DownloadWindow;
}

test('selects a stable release, switches builds and preserves selection across languages', async () => {
    const dmg = asset('v1.5.1', 'NYX.Vox_1.5.1_aarch64.dmg');
    const exe = asset('v1.5.1', 'NYX.Vox_1.5.1_x64-setup.exe');
    const msi = asset('v1.4.0', 'NYX.Vox_1.4.0_x64_en-US.msi');
    const page = loadPage([
        { tag_name: 'v1.6.0-beta.1', prerelease: true, assets: [asset('v1.6.0-beta.1', 'test.dmg')] },
        { tag_name: 'v1.4.0', assets: [msi] },
        { tag_name: 'v1.5.1', assets: [dmg, exe, asset('v1.5.1', 'archive.tar.gz')] },
        { tag_name: 'v1.9.0', draft: true, assets: [asset('v1.9.0', 'draft.dmg')] },
    ]);
    const version = page.document.querySelector<HTMLSelectElement>(versionPicker)!;
    const build = page.document.querySelector<HTMLSelectElement>(buildPicker)!;
    const download = page.document.querySelector<HTMLAnchorElement>('#download-button')!;
    await vi.waitFor(() => expect(version.value).toBe('v1.5.1'));
    expect(Array.from(version.options, option => option.value)).toEqual(['v1.5.1', 'v1.4.0', 'v1.6.0-beta.1']);
    expect(Array.from(build.options, option => option.text)).toEqual(['macOS · Apple Silicon · DMG', 'Windows · x64 · EXE']);
    build.value = exe.browser_download_url;
    build.dispatchEvent(new Event('change'));
    expect(download.href).toBe(exe.browser_download_url);

    version.value = 'v1.4.0';
    version.dispatchEvent(new Event('change'));
    expect(download.href).toBe(msi.browser_download_url);
    page.updateDownloadLanguage('ru');
    expect(version.value).toBe('v1.4.0');
    expect(version.options[0].text).toContain('Последняя');
});

test('keeps the GitHub releases link when the API fails', async () => {
    const page = loadPage({}, 403);
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(page.document.querySelector<HTMLElement>('#download-picker')?.hidden).toBe(true);
    expect(page.document.querySelector<HTMLAnchorElement>('#download-button')?.href).toBe(releaseRoot);
});

test('shows the Homebrew command before the version picker and offers curl alongside it', () => {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const install = page.querySelector('#download .hero-install');
    const commands = install?.querySelectorAll('code');
    expect(install?.nextElementSibling?.id).toBe('download-picker');
    expect(commands?.[0]?.textContent).toBe('brew install --cask AVP-Dev/apps/nyx-vox');
    expect(commands?.[1]?.textContent).toBe('curl -fsSL https://nyx-vox.avpdev.com/install.sh | /bin/bash');
    expect(install?.querySelectorAll('button[onclick="copyCommand(this)"]')).toHaveLength(2);
});
