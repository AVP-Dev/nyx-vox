(() => {
    const releaseApi = 'https://api.github.com/repos/AVP-Dev/nyx-vox/releases';
    const assetRoot = 'https://github.com/AVP-Dev/nyx-vox/releases/download/';
    const picker = document.getElementById('download-picker');
    const versionSelect = document.getElementById('download-version');
    const buildSelect = document.getElementById('download-build');
    const download = document.getElementById('download-button');
    const versions = new Intl.Collator('en', { numeric: true });
    const preferWindows = /^win/i.test(navigator.userAgentData?.platform || navigator.platform);
    let releases = [];
    let language = document.documentElement.lang;

    function installer(asset) {
        if (typeof asset?.name !== 'string') return null;
        const format = asset.name.match(/\.(dmg|exe|msi)$/i)?.[1].toUpperCase();
        if (!format || typeof asset.browser_download_url !== 'string') return null;
        if (!asset.browser_download_url.startsWith(assetRoot)) return null;

        const windows = format !== 'DMG';
        const architecture = /universal/i.test(asset.name) ? 'universal'
            : /(?:aarch64|arm64)/i.test(asset.name) ? 'arm64'
            : /(?:x86_64|x64|amd64)/i.test(asset.name) ? 'x64' : '';
        return { url: asset.browser_download_url, format, architecture, windows };
    }

    function releaseWithInstallers(release) {
        if (release?.draft || typeof release?.tag_name !== 'string') return null;
        if (!Array.isArray(release.assets)) return null;
        const builds = release.assets.map(installer).filter(Boolean);
        return builds.length ? { tag: release.tag_name, beta: release.prerelease === true, builds } : null;
    }

    async function fetchReleases() {
        const result = [];
        const pageSize = 100;
        for (let page = 1; ; page++) {
            const response = await fetch(`${releaseApi}?per_page=${pageSize}&page=${page}`, {
                signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) throw new Error(`GitHub Releases returned ${response.status}`);
            const entries = await response.json();
            if (!Array.isArray(entries)) throw new Error('Unexpected GitHub release list');
            result.push(...entries.map(releaseWithInstallers).filter(Boolean));
            if (entries.length < pageSize) break;
        }
        return result.sort((left, right) =>
            Number(left.beta) - Number(right.beta) || versions.compare(right.tag, left.tag));
    }

    function populate(select, options, preferred) {
        select.replaceChildren(...options.map(({ label, value }) => new Option(label, value)));
        if (options.some(({ value }) => value === preferred)) select.value = preferred;
    }

    function buildLabel(build) {
        const platform = build.windows ? 'Windows' : 'macOS';
        const macNames = { arm64: 'Apple Silicon', x64: 'Intel', universal: 'Universal' };
        const architecture = build.windows ? build.architecture : macNames[build.architecture];
        return [platform, architecture, build.format].filter(Boolean).join(' · ');
    }

    function updateDownload() {
        if (buildSelect.value) download.href = buildSelect.value;
    }

    function updateBuilds() {
        const release = releases.find(({ tag }) => tag === versionSelect.value);
        if (!release) return;
        const preferred = release.builds.find(({ windows }) => windows === preferWindows);
        populate(buildSelect, release.builds.map(build => ({
            label: buildLabel(build),
            value: build.url,
        })), preferred?.url);
        updateDownload();
    }

    function localizeVersions() {
        const ru = language === 'ru';
        const selected = versionSelect.value;
        populate(versionSelect, releases.map(({ tag, beta }, index) => {
            const suffix = beta ? ' · Beta' : index === 0 ? (ru ? ' · Последняя' : ' · Latest') : '';
            return { label: tag + suffix, value: tag };
        }), selected);
        download.querySelector('[data-en]').textContent = 'Download installer';
        download.querySelector('[data-ru]').textContent = 'Скачать установщик';
    }

    window.updateDownloadLanguage = (lang) => {
        language = lang;
        if (releases.length) localizeVersions();
    };
    versionSelect.addEventListener('change', updateBuilds);
    buildSelect.addEventListener('change', updateDownload);

    fetchReleases().then((available) => {
        if (!available.length) return;
        releases = available;
        const stable = releases.find(({ beta }) => !beta);
        if (stable) document.getElementById('version-tag').textContent = stable.tag;
        localizeVersions();
        updateBuilds();
        picker.hidden = false;
    }).catch(error => console.warn('Could not load NYX Vox installers', error));
})();
