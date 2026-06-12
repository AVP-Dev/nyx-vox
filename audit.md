# NYX Vox — Полный аудит проекта

**Версия:** 1.1.0  
**Стек:** Tauri 2 + Next.js 16 + React 19 + Rust + TypeScript  
**Дата аудита:** 2026-06-12

---

## 1. Критические проблемы безопасности

### 1.1. `unsafe impl Send + Sync` на `EnigoWrapper`
**Файл:** `src-tauri/src/state.rs:82-83`
```rust
unsafe impl Send for EnigoWrapper {}
unsafe impl Sync for EnigoWrapper {}
```
`enigo::Enigo` не является потокобезопасным. Принудительная пометка может привести к data race. На macOS используется `core_graphics` для вставки, но `EnigoState` всё равно управляется и на macOS (`lib.rs:94`).

**Рекомендация:** Убрать `unsafe impl` для macOS, использовать `Enigo` только на Windows.

### 1.2. Захардкоженный nonce для legacy-шифрования
**Файл:** `src-tauri/src/keys.rs:113`
```rust
let nonce = Nonce::from_slice(b"NYXVOX_NONCE");
```
Фиксированный nonce в AES-GCM полностью компрометирует安全性 шифрования. Любой, кто знает nonce, может дешифровать ключи (при наличии зашифрованного текста).

**Рекомендация:** Миграция v1 → v2 уже реализована, но legacy-дешифрование всё ещё активно. Убрать `decrypt_legacy_key` после достаточного переходного периода.

### 1.3. `std::env::set_var` в main.rs (небезопасно в Rust ≥1.66)
**Файл:** `src-tauri/src/main.rs:5`
```rust
std::env::set_var("RUST_BACKTRACE", "1");
```
`set_var` небезопасен в многопоточных программах (UB в Rust editions 2024+). Tauri запускает tokio runtime до `main()`, что создаёт реальный риск.

**Рекомедация:** Использовать `std::env::set_var` только в debug-сборках (`#[cfg(debug_assertions)]`) или переменную окружения через `build.rs`.

### 1.4. CSP разрешает `unsafe-inline` и `unsafe-eval`
**Файл:** `src-tauri/tauri.conf.json:34`
```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```
Это серьёзно ослабляет защиту от XSS. Next.js + Tauri не требуют `unsafe-eval`.

**Рекомендация:** Убрать `unsafe-eval`, проверить работоспособность. `unsafe-inline` необходим для Tailwind, но может быть заменён на nonce-based подход.

### 1.5. Формспрей URL содержит email как form ID
**Файл:** `src/components/FeedbackModal.tsx:47`
```typescript
const FORMSPREE_URL = 'https://formspree.io/f/contact@avpdev.com';
```
Формат формы Formspree: `https://formspree.io/f/{form_id}`. Email не является валидным form ID. Форма не будет работать.

**Рекомендация:** Зарегистрировать форму на formspree.io и вставить настоящий ID.

---

## 2. Архитектурные проблемы

### 2.1. Дублирование логики очистки галлюцинаций
Логика фильтрации галлюцинаций Whisper дублируется в **4 местах**:
1. `src/app/page.tsx:135-217` — фронтенд `cleanHallucinations()`
2. `src-tauri/src/whisper.rs:16-42` — `HALLUCINATION_PATTERNS` (статический массив)
3. `src-tauri/src/utils.rs:158-184` — `remove_hallucinations()` (regex-based)
4. `src-tauri/src/utils.rs:186-217` — `clean_repetitive_phrases()` (вызывает `remove_hallucinations`)

При изменении списка галлюцинаций нужно обновлять **4 файла**. Фронтенд и бэкенд работают независимо, что приводит к рассинхронизации.

**Рекомендация:** Оставить очистку только на бэкенде. Фронтенд не должен дублировать эту логику — он получает уже очищенный текст от `stop_recording`.

### 2.2. Дублирование компонентов Welcome
Существуют **два** Nearly-идентичных компонента Welcome:
1. `src/components/WelcomeOverlay.tsx` — используется как overlay внутри main window
2. `src/app/welcome/page.tsx` — отдельная страница для window "welcome"

Они различаются только в деталях (микрофон permissions, social links). 90% кода скопировано.

**Рекомендация:** Объединить в один компонент с пропсами `mode: 'overlay' | 'standalone'`.

### 2.3. Монолитный page.tsx (1065 строк)
Главный компонент `Home` содержит:
- QuickMenu (44-118)
- Home (120-1065) с 30+ useState, 15+ useCallback, 10+ useEffect

Это делает код нечитаемым и не подлежащим тестированию.

**Рекомендация:** Вынести: QuickMenu, ResultView, EditingView, HeaderBar, ActionBar в отдельные компоненты. Вынести логику window management в custom hook.

### 2.4. FeedbackModal не используется
**Файл:** `src/components/FeedbackModal.tsx` — компонент экспортирован, но нигде не импортируется.

**Рекомендация:** Либо подключить (например, в InfoTab), либо удалить.

### 2.5. useAudioRecorder hook не используется
**Файл:** `src/hooks/useAudioRecorder.ts` — хук определён, но нигде не вызывается. Вся логика записи дублируется в `page.tsx`.

**Рекомендация:** Использовать хук или удалить.

### 2.6. Zustand store частично не используется
**Файл:** `src/store/useStore.ts`
- `isRecording` — не используется (в page.tsx используется локальный `phase`)
- `language` — не используется (в page.tsx используется локальный `appLanguage`)

Хранит только `transcriptText` и `isProcessing`, для чего достаточно локального state.

**Рекомендация:** Либо перенести всё в store, либо убрать store и использовать локальный state.

---

## 3. Потенциальные баги

### 3.1. Polling разрешений каждые 2 секунды
**Файлы:** `WelcomeOverlay.tsx:49`, `SettingsPanel.tsx:154`, `welcome/page.tsx:46`
```typescript
const interval = setInterval(checkPerms, 2000);
```
Три компонента независимо poll'ят permissions каждые 2 секунды. Это:
- 3 IPC-вызова в Rust каждые 2 секунды
- Постоянное потребление CPU
- Конкуренция за ресурсы

**Рекомендация:** Poll при фокусе окна (`visibilitychange` event) или при конкретных действиях пользователя, а не на таймере.

### 3.2. `reverse()` мутирует массив
**Файл:** `src/app/history/page.tsx:37`
```typescript
setEntries(history.reverse());
```
`Array.reverse()` мутирует исходный массив. Если `invoke` вернёт ссылку на тот же объект — данные повредятся.

**Рекомендация:** `setEntries([...history].reverse())` или `setEntries(history.toReversed())`.

### 3.3. Рейс-состояние при остановке записи
**Файл:** `src-tauri/src/commands/audio.rs:190-193`
```rust
if !recording_flag.0.load(Ordering::SeqCst) {
    return Err("ALREADY_IDLE".to_string());
}
recording_flag.0.store(false, Ordering::SeqCst);
```
Проверка и установка флага — не атомарная операция. Два быстрых вызова `stop_recording` могут оба пройти проверку.

**Рекомендация:** Использовать `compare_exchange`:
```rust
recording_flag.0.compare_exchange(true, false, SeqCst, SeqCst)
    .map_err(|_| "ALREADY_IDLE")?;
```

### 3.4. Whisper context загружается без await
**Файл:** `src-tauri/src/whisper.rs:153-166`
```rust
std::thread::spawn(move || {
    // ... загрузка модели
});
```
Модель загружается в отдельном потоке, но запись начинается сразу. Если пользователь начнёт говорить до загрузки модели — результат будет пустым или ошибочным.

**Рекомендация:** Загружать модель до начала записи или показывать индикатор "загрузка модели".

### 3.5. `handlePaste` вызывается без await
**Файл:** `src/app/page.tsx:586`
```typescript
if (autoPaste) {
    handlePaste(cleanedText); // Нет await!
    return;
}
```
`handlePaste` — async функция, но вызывается без await. Ошибки вставки не будут перехвачены.

### 3.6. Простой ресемплинг без anti-aliasing
**Файл:** `src-tauri/src/utils.rs:70-82`
```rust
pub fn resample_to_16k(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    // ...
    result.push(samples[i as usize]); // Nearest-neighbor
}
```
Nearest-neighbor ресемплинг вносит aliasing-артефакты. Для речи это может снижать качество STT.

**Рекомендация:** Использовать линейную интерполяцию или `rubato` crate для качественного ресемплинга.

### 3.7. `resizeWindow` имеет побочные эффекты
**Файл:** `src/app/page.tsx:289-317`
Функция зависит от `alwaysOnTop` и `phase`, но также вызывается из `useEffect`, который пересоздаётся при изменении этих зависимостей. Это может вызвать лишние ресайзы при каждом изменении фазы.

---

## 4. Проблемы с кодом

### 4.1. Пустой/мёртвый код
- `src-tauri/src/bin_test.rs` — пустой файл (только `fn main() {}`)
- `src-tauri/src/check_perm.rs` — функция `check_accessibility()` не используется (дублируется в `commands/audio.rs`)
- `FeedbackModal.tsx` — не используется
- `useAudioRecorder.ts` — не используется
- `CreatorSignature.tsx` — не используется

### 4.2. Смешение языков в сообщениях об ошибках
Бэкенд возвращает сообщения на русском:
- `"API ключ Deepgram не найден."` (deepgram.rs:170)
- `"Ошибка ключа Deepgram"` (page.tsx:667)
- `"Микрофон не найден"` (deepgram.rs:41)

Но некоторые на английском:
- `"No mic"` (whisper.rs:173)
- `"ALREADY_IDLE"` (audio.rs:191)
- `"WAV data empty"` (ai_provider.rs:178)

**Рекомендация:** Использовать коды ошибок, а не строки. Форматировать сообщения на фронтенде.

### 4.3. Магические числа и строки
- `page.tsx:380-386` — размеры окон захардкожены
- `page.tsx:716` — `setTimeout(() => setAiStatus(''), 600)` — магическое время
- `utils.rs:116` — `rms < 0.0004` — порог без объяснения
- `utils.rs:267` — `rms < 0.0001` — другой порог для Whisper
- `ai_provider.rs:150` — `rms < 0.00005` — третий порог для Groq

### 4.4. Избыточные вызовы `invoke` при старте
**Файл:** `src/app/page.tsx:402-415`
13 последовательных `invoke` вызовов при загрузке. Каждый — IPC-вызов через Tauri bridge.

**Рекомендация:** Создать один `get_all_settings` command, возвращающий все настройки за один вызов.

### 4.5. TypeScript: `Record<string, any>` в переводах
**Файл:** `src/app/page.tsx:13`
```typescript
interface TranslationDict {
    settings: Record<string, any>;
    guide: Record<string, any>;
    welcome: Record<string, any>;
}
```
Полная потеря типизации для переводов.

---

## 5. Проблемы производительности

### 5.1. Целевой апп poll'ится каждые 500мс
**Файл:** `src-tauri/src/lib.rs:248-272`
```rust
loop {
    // ...get_frontmost_app_info() — вызов osascript + CGWindowListCopyWindowInfo
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
}
```
Каждые 500мс вызывается `osascript` для получения bundle ID — это дорогостоящая операция.

**Рекомендация:** Poll только когда окно видимо (уже частично реализовано), увеличить интервал до 1-2 секунд, или использовать `NSWorkspace` notification вместо polling.

### 5.2. Regex компилируется каждый вызов
**Файл:** `src-tauri/src/utils.rs:178-183`
```rust
for pattern in patterns {
    if let Ok(re) = regex::Regex::new(&format!(r"(?i)\b?{}\b?", regex::escape(pattern))) {
        cleaned = re.replace_all(&cleaned, "").to_string();
    }
}
```
70+ regex паттернов компилируются при каждом вызове `remove_hallucinations`.

**Рекомендация:** Использовать `lazy_static` или `once_cell` для кэширования regex. Или использовать `aho-corasick` для multi-pattern matching.

### 5.3. History загружается полностью
**Файл:** `src-tauri/src/history.rs:17-23`
Все 1000 записей загружаются разом. Для UI это может вызвать lag при большом количестве записей.

**Рекомендация:** Реализовать пагинацию (limit/offset).

---

## 6. Проблемы с инфраструктурой

### 6.1. CI/CD собирает только macOS
**Файл:** `.github/workflows/release.yml:17`
```yaml
platform: [macos-latest]
```
Windows и Linux не собираются, хотя код поддерживает обе платформы.

### 6.2. Нет тестов
- Фронтенд: **0 тестов**
- Бэкенд: **2 тривиальных теста** (`diag.rs:36-48`)
- Нет E2E тестов
- Нет snapshot тестов для UI

### 6.3. `tauri-plugin-window-state` на RC-версии
**Файл:** `src-tauri/Cargo.toml:47`
```toml
tauri-plugin-window-state = "2.0.0-rc"
```
RC-версия в production-сборке — риск нестабильности.

### 6.4. Нет `.env.example`
API ключи (Deepgram, Groq, Gemini, Qwen, DeepSeek) не документированы в `.env.example`.

---

## 7. UX проблемы

### 7.1. Нет retry логики для API-вызовов
При ошибке сети или 429 (rate limit) — приложение просто показывает ошибку. Нет автоматического retry с exponential backoff.

### 7.2. Auto-paste требует Accessibility, но нет clear guidance
Пользователь включает auto-paste → текст не вставляется → нет объяснения почему. Welcome overlay показывает permissions, но не связывает их с auto-paste.

### 7.3. Нет keyboard shortcuts в UI
Горячие клавиши `⌥ + Space` упоминаются только в welcome/FAQ. Нет визуальной подсказки в основном UI.

### 7.4. Окно истории не сохраняет состояние
При закрытии и повторном открытии — сбрасывается позиция, поиск, выбранный элемент.

---

## 8. Рекомендации по приоритету

### Высокий приоритет
1. Исправить `unsafe impl Send/Sync` (безопасность)
2. Убрать `std::env::set_var` из main (稳定性)
3. Заменить nearest-neighbor ресемплинг на линейную интерполяцию (качество STT)
4. Использовать `compare_exchange` для recording flag (рейс-состояние)
5. Исправить Formspree URL (FeedbackModal)
6. Убрать legacy nonce-based decryption (keys.rs)

### Средний приоритет
7. Вынести page.tsx в подкомпоненты (читаемость)
8. Убрать дублирование галлюцинаций (поддерживаемость)
9. Объединить WelcomeOverlay + WelcomePage (DRY)
10. Заменить polling permissions на event-based (производительность)
11. Кэшировать regex в utils.rs (производительность)
12. Добавить `get_all_settings` command (производительность при старте)

### Низкий приоритет
13. Удалить мёртвый код (bin_test.rs, check_perm.rs, FeedbackModal, useAudioRecorder)
14. Добавить тесты
15. Добавить CI для Windows/Linux
16. Добавить пагинацию для history
17. Исправить смешение языков в ошибках
18. Обновить tauri-plugin-window-state с RC на stable
