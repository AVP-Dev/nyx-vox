// Single source of truth for service ids used across Settings UI.
// Keep in sync with `keys::Service` in src-tauri/src/keys.rs.
export const SERVICES = [
    { id: 'deepgram', url: 'https://console.deepgram.com' },
    { id: 'groq', url: 'https://console.groq.com/keys' },
    { id: 'gemini', url: 'https://aistudio.google.com/app/apikey' },
    { id: 'qwen', url: 'https://dashscope.console.aliyun.com/apiKey' },
    { id: 'deepseek', url: 'https://platform.deepseek.com' },
    { id: 'gigachat', url: 'https://developers.sber.ru' },
] as const;

export type ServiceId = typeof SERVICES[number]['id'];
