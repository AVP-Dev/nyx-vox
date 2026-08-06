use regex::Regex;
use std::sync::OnceLock;

struct TranslitEntry {
    patterns: &'static [&'static str],
    replacement: &'static str,
}

static TRANSLIT_TABLE: OnceLock<Vec<TranslitEntry>> = OnceLock::new();

fn table() -> &'static Vec<TranslitEntry> {
    TRANSLIT_TABLE.get_or_init(|| {
        vec![
            // ── Cloud / AI API services ────────────────────────────────────────
            TranslitEntry {
                patterns: &["groq", "грок"],
                replacement: "Groq",
            },
            TranslitEntry {
                patterns: &["deepgram", "дипграм", "дипгрэм"],
                replacement: "Deepgram",
            },
            TranslitEntry {
                patterns: &["whisper", "виспер", "уиспер"],
                replacement: "Whisper",
            },
            TranslitEntry {
                patterns: &["gemini", "джемини", "гемини", "гэмини", "джэмини"],
                replacement: "Gemini",
            },
            TranslitEntry {
                patterns: &["openai", "опенэй", "опенай", "опен-ай"],
                replacement: "OpenAI",
            },
            TranslitEntry {
                patterns: &["claude", "клод"],
                replacement: "Claude",
            },
            // ── Languages & runtimes ───────────────────────────────────────────
            TranslitEntry {
                patterns: &[
                    "node.js",
                    "node js",
                    "нод джей эс",
                    "нод-джей-эс",
                    "нода",
                    "ноджс",
                    "нод",
                ],
                replacement: "Node.js",
            },
            TranslitEntry {
                patterns: &[
                    "next.js",
                    "next js",
                    "нэкст джей эс",
                    "нэкст-джей-эс",
                    "нэкст",
                ],
                replacement: "Next.js",
            },
            TranslitEntry {
                patterns: &["react", "реакт", "реакт"],
                replacement: "React",
            },
            TranslitEntry {
                patterns: &["typescript", "тайпскрипт", "типскрипт", "type script"],
                replacement: "TypeScript",
            },
            TranslitEntry {
                patterns: &[
                    "javascript",
                    "джэйва скрипт",
                    "джава скрипт",
                    "ява скрипт",
                    "java script",
                ],
                replacement: "JavaScript",
            },
            TranslitEntry {
                patterns: &["python", "питон", "пайтон"],
                replacement: "Python",
            },
            TranslitEntry {
                patterns: &["rust", "раст"],
                replacement: "Rust",
            },
            TranslitEntry {
                patterns: &["bun", "бан"],
                replacement: "Bun",
            },
            TranslitEntry {
                patterns: &["deno", "дено"],
                replacement: "Deno",
            },
            TranslitEntry {
                patterns: &["swift", "свифт"],
                replacement: "Swift",
            },
            TranslitEntry {
                patterns: &["kotlin", "котлин"],
                replacement: "Kotlin",
            },
            TranslitEntry {
                patterns: &["dart", "дарт"],
                replacement: "Dart",
            },
            // ── Frameworks & libraries ─────────────────────────────────────────
            TranslitEntry {
                patterns: &["tailwind", "тейлвинд", "таилвинд"],
                replacement: "Tailwind",
            },
            TranslitEntry {
                patterns: &["prisma", "призма"],
                replacement: "Prisma",
            },
            TranslitEntry {
                patterns: &["supabase", "супрабэйс", "супра база", "супабейс"],
                replacement: "Supabase",
            },
            TranslitEntry {
                patterns: &["docker", "дакер", "докер"],
                replacement: "Docker",
            },
            TranslitEntry {
                patterns: &["kubernetes", "кубернетес", "куб"],
                replacement: "Kubernetes",
            },
            TranslitEntry {
                patterns: &["tauri", "таури"],
                replacement: "Tauri",
            },
            TranslitEntry {
                patterns: &["vue", "вью"],
                replacement: "Vue",
            },
            TranslitEntry {
                patterns: &["angular", "ангуляр", "ангулар"],
                replacement: "Angular",
            },
            TranslitEntry {
                patterns: &["express", "экспресс"],
                replacement: "Express",
            },
            TranslitEntry {
                patterns: &["redux", "редакс"],
                replacement: "Redux",
            },
            TranslitEntry {
                patterns: &["mongoose", "мангуст", "монгус"],
                replacement: "Mongoose",
            },
            TranslitEntry {
                patterns: &["sequelize", "сиквелайз", "сиквелиз"],
                replacement: "Sequelize",
            },
            TranslitEntry {
                patterns: &["django", "джанго"],
                replacement: "Django",
            },
            TranslitEntry {
                patterns: &["flask", "фласк", "фласк"],
                replacement: "Flask",
            },
            TranslitEntry {
                patterns: &["spring", "спринг"],
                replacement: "Spring",
            },
            TranslitEntry {
                patterns: &["nestjs", "нест джей эс", "нест", "nest js"],
                replacement: "NestJS",
            },
            // ── Data & databases ───────────────────────────────────────────────
            TranslitEntry {
                patterns: &["postgresql", "постгрес кюэль", "постгрес", "постгри"],
                replacement: "PostgreSQL",
            },
            TranslitEntry {
                patterns: &["sql", "эс кю эль", "сиквел"],
                replacement: "SQL",
            },
            TranslitEntry {
                patterns: &["redis", "редис"],
                replacement: "Redis",
            },
            TranslitEntry {
                patterns: &["mongodb", "монгодэ", "монго"],
                replacement: "MongoDB",
            },
            TranslitEntry {
                patterns: &["graphql", "граф кюэль", "граф"],
                replacement: "GraphQL",
            },
            TranslitEntry {
                patterns: &["mysql", "май эс кю эль", "май сиквел", "май-сиквел"],
                replacement: "MySQL",
            },
            TranslitEntry {
                patterns: &["sqlite", "эс кю лайт", "сиквел лайт", "сиквел-лайт"],
                replacement: "SQLite",
            },
            TranslitEntry {
                patterns: &["dynamodb", "динамо дэ", "дайнамо"],
                replacement: "DynamoDB",
            },
            TranslitEntry {
                patterns: &["firebase", "файербейс", "фаербейс", "файрбейс"],
                replacement: "Firebase",
            },
            // ── DevOps & tools ─────────────────────────────────────────────────
            TranslitEntry {
                patterns: &["github", "гит хаб", "гит", "гитхаб", "гит-хаб"],
                replacement: "GitHub",
            },
            TranslitEntry {
                patterns: &["gitlab", "гит лаб", "гитлаб", "гит-лаб"],
                replacement: "GitLab",
            },
            TranslitEntry {
                patterns: &["nginx", "энжин икс", "нжинкс", "энгинкс"],
                replacement: "Nginx",
            },
            TranslitEntry {
                patterns: &["vscode", "ви-эс-код", "визуал студио код", "вижуал студио"],
                replacement: "VS Code",
            },
            TranslitEntry {
                patterns: &["cursor", "курсор"],
                replacement: "Cursor",
            },
            TranslitEntry {
                patterns: &["webpack", "вебпак", "веб пак"],
                replacement: "Webpack",
            },
            TranslitEntry {
                patterns: &["vite", "вит", "вите"],
                replacement: "Vite",
            },
            TranslitEntry {
                patterns: &["eslint", "эс-линт", "ес линт"],
                replacement: "ESLint",
            },
            TranslitEntry {
                patterns: &["prettier", "преттиер", "преттир"],
                replacement: "Prettier",
            },
            // ── OS & platforms ─────────────────────────────────────────────────
            TranslitEntry {
                patterns: &["macos", "мак ос", "макос"],
                replacement: "macOS",
            },
            TranslitEntry {
                patterns: &["linux", "линукс"],
                replacement: "Linux",
            },
            TranslitEntry {
                patterns: &["ios", "ай-ос", "айос", "айос"],
                replacement: "iOS",
            },
            TranslitEntry {
                patterns: &["android", "андроид"],
                replacement: "Android",
            },
            TranslitEntry {
                patterns: &["windows", "виндовс", "виндоус"],
                replacement: "Windows",
            },
            TranslitEntry {
                patterns: &["aws", "а-вэ-эс", "амазон"],
                replacement: "AWS",
            },
            TranslitEntry {
                patterns: &["gcp", "гэ-цэ-пэ", "гугл клауд"],
                replacement: "GCP",
            },
            TranslitEntry {
                patterns: &["azure", "ажур", "эйжур"],
                replacement: "Azure",
            },
            // ── General tech terms ─────────────────────────────────────────────
            TranslitEntry {
                patterns: &["api", "апи", "эй-пи-ай", "эпейай"],
                replacement: "API",
            },
            TranslitEntry {
                patterns: &["cli", "си-эль-ай", "кли"],
                replacement: "CLI",
            },
            TranslitEntry {
                patterns: &["ui", "ю-ай", "уи", "юай"],
                replacement: "UI",
            },
            TranslitEntry {
                patterns: &["ux", "ю-икс", "юай-икс", "юэкс"],
                replacement: "UX",
            },
            TranslitEntry {
                patterns: &["json", "джейсон", "джэйсон"],
                replacement: "JSON",
            },
            TranslitEntry {
                patterns: &["base64", "бейз сиксуэль"],
                replacement: "Base64",
            },
            TranslitEntry {
                patterns: &["jwt", "джей дабл ю ти", "джот"],
                replacement: "JWT",
            },
            TranslitEntry {
                patterns: &["html", "эйч-ти-эм-эль", "хтэмэль"],
                replacement: "HTML",
            },
            TranslitEntry {
                patterns: &["css", "си-эс-эс", "цэ-эс-эс"],
                replacement: "CSS",
            },
            TranslitEntry {
                patterns: &["yaml", "я-мэ-эль", "йамл"],
                replacement: "YAML",
            },
            TranslitEntry {
                patterns: &["sdk", "эс-дэ-ка", "эс дэ ка"],
                replacement: "SDK",
            },
            TranslitEntry {
                patterns: &["ide", "ай-ди-и", "идэ"],
                replacement: "IDE",
            },
            TranslitEntry {
                patterns: &["npm", "эн-пэ-эм"],
                replacement: "npm",
            },
            TranslitEntry {
                patterns: &["yarn", "ярн"],
                replacement: "Yarn",
            },
            TranslitEntry {
                patterns: &["pnpm", "пэ-эн-пэ-эм"],
                replacement: "pnpm",
            },
            TranslitEntry {
                patterns: &["push", "пуш"],
                replacement: "push",
            },
            TranslitEntry {
                patterns: &["pull", "пул"],
                replacement: "pull",
            },
            TranslitEntry {
                patterns: &["commit", "коммит"],
                replacement: "commit",
            },
            TranslitEntry {
                patterns: &["merge", "мердж", "мерж"],
                replacement: "merge",
            },
            TranslitEntry {
                patterns: &["branch", "бранч"],
                replacement: "branch",
            },
            TranslitEntry {
                patterns: &["deploy", "диплой", "деплой"],
                replacement: "deploy",
            },
            TranslitEntry {
                patterns: &["endpoint", "ендпойнт", "эндпойнт"],
                replacement: "endpoint",
            },
            TranslitEntry {
                patterns: &["token", "токен"],
                replacement: "token",
            },
            TranslitEntry {
                patterns: &["cache", "кэш", "кеш"],
                replacement: "cache",
            },
            TranslitEntry {
                patterns: &["debug", "дибаг", "дебаг"],
                replacement: "debug",
            },
            TranslitEntry {
                patterns: &["error", "эррор"],
                replacement: "error",
            },
            TranslitEntry {
                patterns: &["server", "сёрвер", "сервер"],
                replacement: "server",
            },
            TranslitEntry {
                patterns: &["client", "клейент", "клиент"],
                replacement: "client",
            },
            TranslitEntry {
                patterns: &["webhook", "вебхук", "веб хук"],
                replacement: "webhook",
            },
            TranslitEntry {
                patterns: &["middleware", "мидлвэр", "миддлвэр"],
                replacement: "middleware",
            },
            TranslitEntry {
                patterns: &["frontend", "фронтенд"],
                replacement: "frontend",
            },
            TranslitEntry {
                patterns: &["backend", "бекенд", "бэкенд"],
                replacement: "backend",
            },
            TranslitEntry {
                patterns: &["authentication", "аутентификация"],
                replacement: "authentication",
            },
            TranslitEntry {
                patterns: &["authorization", "авторизация"],
                replacement: "authorization",
            },
        ]
    })
}

/// Fix Latin letters that appear inside predominantly Cyrillic words.
/// e.g. "Nужно" → "Нужно", "Hастроить" → "Настроить"
fn fix_mixed_script(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut word_start = 0;
    let chars: Vec<char> = text.chars().collect();

    for (i, &ch) in chars.iter().enumerate() {
        let is_boundary = !ch.is_alphanumeric() && ch != '-';
        if is_boundary || i == chars.len() - 1 {
            let word_end = if is_boundary { i } else { i + 1 };
            if word_end > word_start {
                let word: String = chars[word_start..word_end].iter().collect();
                result.push_str(&fix_word_mixed_script(&word));
            }
            if is_boundary {
                result.push(ch);
            }
            word_start = i + 1;
        }
    }

    result
}

fn fix_word_mixed_script(word: &str) -> String {
    let cyrillic_count = word.chars().filter(|c| is_cyrillic(*c)).count();
    let latin_count = word.chars().filter(|c| c.is_ascii_alphabetic()).count();

    // Only fix if word is predominantly Cyrillic with a few Latin chars mixed in
    if cyrillic_count == 0 || latin_count == 0 || latin_count > cyrillic_count {
        return word.to_string();
    }

    let mut result = String::with_capacity(word.len());
    for ch in word.chars() {
        if ch.is_ascii_alphabetic() && is_cyrillic_lookalike(ch) {
            result.push(cyrillic_replacement(ch));
        } else {
            result.push(ch);
        }
    }
    result
}

fn is_cyrillic(ch: char) -> bool {
    matches!(ch, '\u{0400}'..='\u{04FF}' | '\u{0500}'..='\u{052F}')
}

fn is_cyrillic_lookalike(ch: char) -> bool {
    static MAP: &[char] = &[
        'A', 'B', 'C', 'E', 'H', 'K', 'M', 'N', 'O', 'P', 'S', 'T', 'X', 'Y', 'a', 'c', 'e', 'o',
        'p', 'x', 'y',
    ];
    MAP.contains(&ch)
}

fn cyrillic_replacement(ch: char) -> char {
    match ch {
        'A' => 'А',
        'B' => 'В',
        'C' => 'С',
        'E' => 'Е',
        'H' => 'Н',
        'K' => 'К',
        'M' => 'М',
        'N' => 'Н',
        'O' => 'О',
        'P' => 'Р',
        'S' => 'С',
        'T' => 'Т',
        'X' => 'Х',
        'Y' => 'У',
        'a' => 'а',
        'c' => 'с',
        'e' => 'е',
        'o' => 'о',
        'p' => 'р',
        'x' => 'х',
        'y' => 'у',
        _ => ch,
    }
}

pub fn fix_transliterations(text: &str) -> String {
    let text_lower = text.to_lowercase();
    let mut result = text.to_string();
    let table = table();

    for entry in table {
        for pattern in entry.patterns {
            let lower_pattern = pattern.to_lowercase();
            if text_lower.contains(&lower_pattern) {
                // Use word-boundary replacement to avoid partial matches
                let re_str = format!(r"(?i)\b{}\b", regex::escape(pattern));
                if let Ok(re) = Regex::new(&re_str) {
                    result = re.replace_all(&result, entry.replacement).to_string();
                }
            }
        }
    }

    // Fix mixed Latin/Cyrillic characters in words
    result = fix_mixed_script(&result);

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_transliteration() {
        assert_eq!(
            fix_transliterations("нужно задеплоить апи"),
            "нужно задеплоить API"
        );
    }

    #[test]
    fn test_react() {
        assert_eq!(fix_transliterations("реакт компонент"), "React компонент");
    }

    #[test]
    fn test_github() {
        assert_eq!(
            fix_transliterations("запушить на гитхаб"),
            "запушить на GitHub"
        );
    }

    #[test]
    fn test_nodejs() {
        assert_eq!(
            fix_transliterations("установить нода"),
            "установить Node.js"
        );
    }

    #[test]
    fn test_postgres() {
        assert_eq!(fix_transliterations("постгрес база"), "PostgreSQL база");
    }

    #[test]
    fn test_case_preservation() {
        let result = fix_transliterations("React компонент и Vue компонент");
        assert!(result.contains("React"));
        assert!(result.contains("Vue"));
    }

    #[test]
    fn test_term_chain() {
        let result = fix_transliterations("нужно задеплоить апи endpoint на нода с PostgreSQL");
        assert_eq!(
            result,
            "нужно задеплоить API endpoint на Node.js с PostgreSQL"
        );
    }

    #[test]
    fn test_mixed_script_fix() {
        assert_eq!(fix_transliterations("Nужно упростить"), "Нужно упростить");
    }

    #[test]
    fn test_mixed_script_preserves_english_words() {
        // Should NOT change pure English words
        assert_eq!(fix_transliterations("Hello world"), "Hello world");
    }

    #[test]
    fn test_mixed_script_preserves_tech_terms() {
        // Should NOT change tech terms (they go through transliteration table)
        assert_eq!(fix_transliterations("React компонент"), "React компонент");
    }
}
