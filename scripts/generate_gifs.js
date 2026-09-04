const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function renderGif(lang, outputFile) {
    console.log(`Generating GIF for [${lang}] -> ${outputFile}...`);
    const tempDir = path.join(__dirname, `temp_frames_${lang}`);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    const browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 780, height: 360 },
        deviceScaleFactor: 2
    });

    const page = await context.newPage();
    const htmlPath = 'file://' + path.resolve(__dirname, 'widget_preview.html');
    await page.goto(htmlPath);

    const isRu = lang === 'ru';
    const words = isRu
        ? ["Создай", "асинхронную", "функцию", "fetchUserData", "с", "обработкой", "ошибок", "через", "try-catch", "и", "TypeScript."]
        : ["Create", "an", "async", "function", "fetchUserData", "with", "try-catch", "error", "handling", "and", "TypeScript", "types."];

    const formattedHtml = isRu
        ? 'Создай асинхронную функцию <code>fetchUserData</code> с обработкой ошибок через try-catch и добавь типизацию интерфейса <code>UserResponse</code> в TypeScript.'
        : 'Create an async function <code>fetchUserData</code> with try-catch error handling and add TypeScript typing for the <code>UserResponse</code> interface.';

    const targetLabel = isRu ? 'В VS CODE' : 'TO VS CODE';

    let frameIdx = 0;
    const targetElement = page.locator('#capture-target');

    async function captureFrame() {
        const framePath = path.join(tempDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
        await targetElement.screenshot({ path: framePath, omitBackground: true });
        frameIdx++;
    }

    // Step 1: Idle start (2 frames)
    for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
            window.setWidgetState({ isRecording: false, text: '...', isResult: false, waveIndex: 0 });
        });
        await captureFrame();
    }

    // Step 2: Speech typing (streaming words)
    let currentText = '';
    for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];
        await page.evaluate(({ text, waveIndex }) => {
            window.setWidgetState({ isRecording: true, text, isResult: false, waveIndex });
        }, { text: currentText, waveIndex: i });
        await captureFrame();
    }

    // Step 3: VAD silence stop (2 frames)
    for (let i = 0; i < 2; i++) {
        await page.evaluate(({ text }) => {
            window.setWidgetState({ isRecording: false, text, isResult: false, waveIndex: 0 });
        }, { text: currentText });
        await captureFrame();
    }

    // Step 4: Formatted Result with Target App (6 frames to allow reading)
    for (let i = 0; i < 6; i++) {
        await page.evaluate(({ text, formattedHtml, targetLabel }) => {
            window.setWidgetState({
                isRecording: false,
                text,
                isResult: true,
                formattedHtml,
                target: targetLabel,
                waveIndex: 0
            });
        }, { text: currentText, formattedHtml, targetLabel });
        await captureFrame();
    }

    await browser.close();

    // Assemble frames with Python Pillow
    const pyScript = `
from PIL import Image
import os, glob

frames_dir = "${tempDir}"
frame_files = sorted(glob.glob(os.path.join(frames_dir, "frame_*.png")))
images = [Image.open(f) for f in frame_files]

# Set durations: recording words ~180ms, result view ~400ms per frame
durations = []
for i in range(len(images)):
    if i < 2:
        durations.append(300)
    elif i < len(images) - 6:
        durations.append(180)
    else:
        durations.append(500)

output_path = "${outputFile}"
images[0].save(
    output_path,
    save_all=True,
    append_images=images[1:],
    duration=durations,
    loop=0,
    optimize=True
)
print("Saved GIF successfully:", output_path, "Size:", os.path.getsize(output_path), "bytes")
`;

    fs.writeFileSync(path.join(tempDir, 'make_gif.py'), pyScript);
    execSync(`python3 "${path.join(tempDir, 'make_gif.py')}"`, { stdio: 'inherit' });

    // Clean up frames
    fs.rmSync(tempDir, { recursive: true, force: true });
}

(async () => {
    try {
        const enGif = path.resolve(__dirname, '../docs/demo.gif');
        const ruGif = path.resolve(__dirname, '../docs/demo.ru.gif');

        await renderGif('en', enGif);
        await renderGif('ru', ruGif);

        console.log('All GIFs generated successfully!');
    } catch (err) {
        console.error('Error generating GIFs:', err);
        process.exit(1);
    }
})();
