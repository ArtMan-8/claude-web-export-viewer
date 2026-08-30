# План: поддержка формата выгрузки claude.ai от 2026-08-29

Статус: согласован, к реализации.
Источник: `claude-data/` (в git не попадает), manifest `version: "1.0"`, `created_at: 2026-08-29T18:02:22Z`.

---

## 1. Что в выгрузке

| Файл | Содержимое | Совпадает с текущими типами |
|---|---|---|
| `conversations-000.zip → conversations.json` | 9 бесед, 56 сообщений, 319 блоков | **нет**, вся дельта здесь |
| `projects-000.zip → projects/*.json` | 6 проектов, 54 документа | да, один в один |
| `light_metadata-000.zip → users.json` | 1 пользователь | да |
| `light_metadata-000.zip → login_history.json` | 14 событий входа | да |
| `manifest-*.json` | 3 записи `data_files` | да |

Замеры по беседам (использованы ниже как обоснование решений):

```
блоки                 tool_use 106, tool_result 106, thinking 59, text 48
инструменты(вызовы)   web_search 35, web_fetch 25, bash_tool 17, create_file 8,
                      present_files 7, project_knowledge_search 6, view 5, str_replace 3
display_content       tool_use:   json_block 25, text 8, table 7, null 66
                      tool_result: rich_link 17, json_block 17, text 13, rich_content 6, null 53
knowledge.text        n=284  max=110 644  медиана=1 103  сумма=779 295
text-фрагменты        n= 99  max= 16 916  медиана=2 845  сумма=260 882
input.file_text       n=  8  max= 13 653  сумма= 63 448
input.old_str/new_str n=  3  max=    802
bash-результат        15 из 17 — JSON {returncode, stdout, stderr}; 2 — простая строка
json_block ключи      tool_use: language, code, filename | tool_result: returncode, stdout, stderr
пустых бесед          3 из 9 (одна с 0 сообщений, две по 4 сообщения без единого блока)
citations             49; citations[].uuid не сопоставляется ни с чем (0 совпадений)
attachments / files   везде пустые массивы — формы не подтверждены
ветвления             нет; сирот tool_use/tool_result — 0
смешанных результатов нет: каждый tool_result содержит элементы ровно одного типа
```

**Суть дельты.** Раньше архив был «поисковым» (`web_search`, `web_fetch`, `project_knowledge_search`), теперь в нём появился исполнительно-файловый контур: `bash_tool`, `create_file`, `str_replace`, `view`, `present_files`. Текущая нормализация умеет извлекать из результата только `type: "text"` и `type: "knowledge"`, поэтому весь новый контур либо отображается сырым JSON, либо не отображается вовсе.

---

## 2. Карта покрытия формата

Легенда: ✅ обрабатывается · ⚠️ обрабатывается частично/неверно · ❌ теряется.

### 2.1 Блоки сообщений

| Путь в JSON | Сейчас | Целевое поведение |
|---|---|---|
| `content[].type = "text"` → `text`, `citations` | ✅ | без изменений |
| `content[].citations_grouping_mode` | ❌ | сохранить в модель, на рендер не влияет |
| `content[].type = "thinking"` → `summaries` | ✅ | без изменений |
| `thinking`, `thinking_hidden`, `truncated`, `cut_off`, `signature`, `alternative_display_type` | ⚠️ читается только `thinking`/`summaries` | `truncated`/`cut_off` → пометка «размышление оборвано»; остальное в белый список ключей |
| `content[].type = "tool_use"` → `id`, `name`, `input` | ✅ | + разбор `input` в `call` (см. 3.2) |
| `tool_use.message` | ❌ | подпись блока («Searching the web») вместо голого имени |
| `tool_use.integration_name`, `icon_name`, `integration_icon_url`, `tool_origin` | ❌ | в модель; `icon_name` — как запасной источник иконки |
| `tool_use.display_content.json_block.language` / `.filename` | ❌ | язык подсветки и имя файла (единственный источник) |
| `tool_use.display_content.type = "table"` | ❌ | не рендерим (дубль `input.filepaths`), сохраняем в модель |
| `tool_use.approval_*`, `context`, `is_mcp_app`, `mcp_server_url`, `tool_identifier`, `flags`, `hidden_in_chat` | ❌ | в белый список ключей, в модель не тянем (везде `null`) |
| `content[].type = "tool_result"` → `content[].type = "text"` | ✅ | остаётся; + распознавание JSON-вывода команды |
| `tool_result.content[].type = "knowledge"` | ⚠️ берём title/url/domain/text/is_missing | + `favicon_url`, `site_name`, `is_citable`, `prompt_context_metadata.{age, final_url, search_provider}` |
| `tool_result.content[].type = "local_resource"` | ❌ **блок рендерится пустым** | `ToolResult.files` + секция «Файлы беседы» |
| `tool_result.content[].uuid` | ❌ | сохранить (uuid чанка/ресурса) |
| `tool_result.display_content.json_block` (`returncode/stdout/stderr`) | ❌ | дубль текстового фрагмента; парсим фрагмент, `display_content` — резерв |
| `tool_result.display_content.rich_link` | ✅ (фолбэк) | остаётся фолбэком для `sources` |
| `tool_result.display_content.text` / `rich_content` | ❌ | `text` — подпись, `rich_content` в данных всегда пуст |
| `tool_result.meta.output_format_category` | ❌ | подсказка формата файла (`md`/`none`) |
| `tool_result.is_error` | ✅ | без изменений |
| неизвестный `type` блока | ✅ `kind: 'unknown'` | + предупреждение в `Archive.warnings` |

### 2.2 Сообщения, беседы, прочее

| Путь | Сейчас | Целевое |
|---|---|---|
| `chat_messages[].text` | ✅ игнорируется (у ассистента — заглушки «This block is not supported…») | без изменений |
| `chat_messages[].attachments` / `.files` | ⚠️ типы есть, данных для проверки нет | оставить как есть; при непустом значении — предупреждение «форма не проверена» |
| `parent_message_uuid` + sentinel | ✅ | без изменений |
| `manifest.created_at` | ⚠️ читается в `loadRawArchive`, **теряется в `buildArchive`** | довести до `Archive.exportedAt`, показать на дашборде |
| `projects/*.json`, `users.json`, `login_history.json` | ✅ | без изменений |

---

## 3. Целевая доменная модель

Принцип (решение Q11): **вид рендера выбирается по форме данных, а не по имени инструмента**. Имя влияет только на иконку и подпись. Инструмент из следующей выгрузки, вернувший `returncode`, отрисуется терминалом без единой правки кода.

### 3.1 Расширение блока `tool`

```ts
type Block =
  | { kind: 'text'; text: string; citations: Citation[] }
  | { kind: 'thinking'; summaries: string[]; text: string; isTruncated: boolean }
  | {
      kind: 'tool'
      toolUseId: string
      name: string                    // 'bash_tool', 'web_search', …
      label: string | null            // tool_use.message — человекочитаемая подпись
      integrationName: string | null
      iconName: string | null         // icon_name из архива
      call: ToolCall
      result: ToolResult
      rawInput: unknown               // для режима «показать как есть»
      isError: boolean
      isPaired: boolean
    }
  | { kind: 'unknown'; blockType: string; raw: unknown }
```

### 3.2 `ToolCall` — распознавание по форме `input`

```ts
type ToolCall =
  | { kind: 'filePresent'; paths: string[] }                                       // filepaths[]
  | { kind: 'fileEdit'; path: string; oldText: string; newText: string; description: string }  // old_str+new_str
  | { kind: 'fileWrite'; path: string; text: string; language: string | null; description: string }  // file_text
  | { kind: 'command'; command: string; description: string; language: string | null }          // command
  | { kind: 'fetch'; url: string }                                                 // url
  | { kind: 'query'; query: string; maxResults: number | null }                    // query
  | { kind: 'fileRead'; path: string; range: [number, number] | null; description: string }     // path
  | { kind: 'raw'; input: unknown }
  | { kind: 'none' }                                                               // осиротевший tool_result
```

Порядок проверок — сверху вниз, он существенен: у `create_file` есть и `path`, и `file_text`, поэтому `fileWrite` проверяется раньше `fileRead`. `language` берётся из `display_content.json_block.language`, при его отсутствии — по расширению `path`, иначе `null`.

Соответствие фактическим формам из выгрузки:

```
filepaths                        → filePresent   (present_files, 7)
description,new_str,old_str,path → fileEdit      (str_replace, 3)
description,file_text,path       → fileWrite     (create_file, 8)
command,description              → command       (bash_tool, 17)
url [,html_extraction_method | text_content_token_limit] → fetch  (web_fetch, 25)
query [,max_text_results]        → query         (web_search 35, project_knowledge_search 6)
description,path [,view_range]   → fileRead      (view, 5)
```

### 3.3 `ToolResult` — распознавание по форме `content[]`

```ts
interface ResultFile { path: string; name: string; mimeType: string | null; uuid: string }

type ToolResult =
  | { kind: 'command'; exitCode: number | null; stdout: string; stderr: string; rawText: string }
  | { kind: 'files'; files: ResultFile[] }
  | { kind: 'sources'; sources: KnowledgeSource[] }
  | { kind: 'text'; text: string; fragments: string[] }
  | { kind: 'none' }
```

Правила: `local_resource` → `files`; `knowledge` → `sources`; единственный `text`-фрагмент, парсящийся как JSON с ключом `returncode`, → `command`; остальной `text` → `text`. Смеси в данных нет, но если появится — приоритет `command > files > sources > text`, а невошедшее уходит в предупреждение (см. слой 6). Два bash-результата из семнадцати JSON-ом **не** парсятся («Command output contains invalid UTF-8 data») — фолбэк на `kind: 'text'` обязателен.

### 3.4 Источники

```ts
interface KnowledgeSource {
  title: string
  url: string
  finalUrl: string | null        // prompt_context_metadata.final_url
  domain: string
  siteName: string | null        // metadata.site_name
  faviconUrl: string | null      // metadata.favicon_url
  publishedAt: string | null     // prompt_context_metadata.age («October 24, 2024»)
  snippet: string
  isMissing: boolean
  isCitable: boolean
}
```

### 3.5 Файлы беседы

```ts
interface ConversationFileRevision {
  messageUuid: string
  toolUseId: string
  op: 'create' | 'edit'
  at: string                     // start_timestamp
  sizeAfter: number
}

interface ConversationFile {
  path: string
  name: string                   // basename либо local_resource.name
  mimeType: string | null
  language: string | null
  revisions: ConversationFileRevision[]
  isPresented: boolean           // был ли present_files
  content: string | null         // null, если реконструкция не прошла проверку
  reconstructionError: 'noCreate' | 'ambiguousEdit' | 'missingEdit' | null
  finalSize: number | null
}

interface Conversation {
  // …существующие поля…
  files: ConversationFile[]
}
```

**Алгоритм реконструкции и его проверка.** Файл целиком встречается в архиве ровно один раз — в `create_file.input.file_text`; `str_replace` хранит только фрагменты. Содержимое собирается применением правок по порядку `start_timestamp`, и каждый шаг **верифицируется**: `old_str` обязан встретиться в текущем содержимом ровно один раз. Ноль вхождений → `missingEdit`, больше одного → `ambiguousEdit`, правка без `create_file` → `noCreate`. При любой ошибке `content = null` и скачивание недоступно — молча неверный файл отдать невозможно.

Проверено на выгрузке: 8 файлов из 8 воспроизводятся, включая правившийся трижды (`00-мастер-бриф-v0.2.md`, 14 702 символа после трёх правок).

### 3.6 Архив

```ts
interface Archive {
  // …существующие поля…
  exportedAt: string | null      // manifest.created_at, сейчас теряется
}
```

---

## 4. Принятые решения

| № | Решение | Обоснование |
|---|---|---|
| Q1 | Паритет рендера с claude.ai **и** полнота извлечения | читалка, а не парсер, но терять данные молча нельзя |
| Q2 | Усечение тел с «показать полностью», бюджет ~2 000 символов | один источник `web_fetch` — до 110 644 символов в DOM |
| Q3 | *Отменено решением Q21* | поиск по инструментам убирается — индексировать нечего |
| Q4 | Рукописные фикстуры + разовый прогон по реальному архиву | `claude-data/` в `.gitignore`, личные данные в репозиторий не едут |
| Q5 | План в `docs/plan-export-format-2026-08.md` | датирован под конкретную версию формата |
| Q6 | Первичны `input`/`content`; `display_content` — источник метаданных | покрывает лишь половину блоков и не содержит крупных тел |
| Q7 | Расширить `kind: 'tool'` полями `call`/`result` | у `Block` шесть потребителей; разбор в UI оставил бы экспорт и поиск с сырым текстом |
| Q8 | Файлы беседы отдельной секцией; скачивание — после верификации | 8 из 8 воспроизводятся; проверка строгая |
| Q9 | Детектор незнакомых типов и ключей → `Archive.warnings` + плашка | сегодня новое поле обнаруживается только вручную |
| Q10 | Заголовки источников — все; усечению подлежат только тела, бюджет 2 000 на блок | ценность списка источников — в самих ссылках |
| Q11 | Диспетчеризация по форме данных, имя инструмента — только иконка и подпись | переживёт следующую выгрузку |
| Q12 | Ссылка на автора в футере сайдбара + `author`/`repository` в `package.json` | сейчас автор не указан нигде |
| Q13 | Пункт меню, отделённый `Separator`, приглушённый | подпись схлопнулась бы в icon-режиме |
| Q14 | Инлайн-SVG логотипа GitHub | в lucide 1.37 бренд-иконок нет; `User` конфликтует с «Аккаунт» |
| Q15 | Скачивание для всех верифицированных файлов + подпись «собрано из истории правок» | ограничение «без правок» отсекало самые ценные файлы |
| Q16 | Секции с подзаголовками и сворачиванием: «Предъявленные» / «Промежуточные»; пустая секция не рисуется | единственная группировка, несущая новое знание |
| Q17 | Секция «Файлы» в markdown-экспорте всегда; при `includeTools` блок `create_file` печатает якорь вместо тела | содержимое в документе ровно один раз |
| Q18 | Файлы в поисковый индекс не идут | следствие Q21 |
| Q19 | Шапка сайдбара — `SidebarMenuButton size="lg"` с иконкой `Archive`, ссылка на дашборд | схлопывание умеет только `SidebarMenuButton` |
| Q21 | Поиск — только по тексту диалога. Убираются: область поиска (`SearchScope`), regex и **весь язык запросов** — `tool/`, `has:`, `from:`, `to:`, `in:` | «обычно ищут по ключевым словам» |
| Q22 | Единый механизм для двух областей: беседы ищутся по беседам, документы — по документам; поиск добавляется в список проектов | симметрия без бессмысленных для документов фильтров |
| U1 | Удаляются **все** префиксные фильтры, включая `from:`/`to:`/`in:` | запрос — это просто слова; `parseQuery` исчезает целиком |
| U2 | Матчинг **не меняется**: точная подстрока, нижний регистр, порядок слов строгий. AND по словам и точная фраза в кавычках — отклонены | обычный поиск, без скрытых правил |
| U3 | Поиск в списке проектов — по имени, описанию и содержимому документов, счётчик совпавших документов на карточке | симметрия со списком бесед |
| Q23 | Работы по слоям, 7 коммитов | границы слоёв совпадают с границами существующих тестов |

---

## 5. Поиск: было и стало

**Было** (`lib/search/query.ts`, `lib/search/index.ts`):

- язык запросов: `tool/<имя>`, `from:`, `to:`, `in:"проект"`, `has:tools|thinking|sources`, значения с пробелами в кавычках;
- свободные слова склеивались обратно в одну строку (`freeWords.join(' ')`) и искались **точной подстрокой** — `сновидений дневник` не находило «дневник сновидений»;
- три области поиска, переключаемые кнопками: текст диалога, размышления, результаты инструментов;
- regex-режим с показом ошибки компиляции;
- индекс по всем блокам: 383 записи на этой выгрузке;
- поиск в проектах — отдельный `includes`, только внутри открытого проекта, в списке проектов поиска нет.

**Стало:**

- **никакого языка запросов** — вся строка запроса ищется как есть;
- матчинг **прежний**: точная подстрока, нижний регистр, порядок слов строгий. Единственная нормализация — `trim` и схлопывание нескольких пробелов в один (сегодня это происходит побочным эффектом парсера, после его удаления надо сделать явно, иначе `дневник⎵⎵сновидений` перестанет находиться);
- одна область — текст диалога; `thinking` и результаты инструментов не индексируются;
- regex удалён;
- индекс по `text`-блокам: 48 записей на этой выгрузке;
- один и тот же матчер обслуживает две области: беседы ищутся по беседам, документы — по документам; в списке проектов появляется поле поиска со счётчиком совпавших документов.

Из старого поведения меняется ровно одно: исчезают префиксы и переключатели. Как именно сопоставляется текст — не трогаем.

Цена решения зафиксирована явно: искать по содержимому прочитанных страниц, созданных файлов и вывода команд станет нельзя — при том, что диалог занимает 48 блоков, а прочее содержимое архива превышает миллион символов. Это осознанный выбор в пользу выдачи без шума.

---

## 6. Работы по слоям

### Слой 1 — доменная модель и нормализация

Файлы: `src/lib/archive/raw-types.ts`, `model.ts`, `normalize.ts`, `build-archive.ts`, `load.ts`

- [x] 1.1 `raw-types.ts`: добавить в `RawToolUseBlock` — `message`, `integration_name`, `integration_icon_url`, `icon_name`, `tool_origin`, `display_content`; в `RawToolResultBlock` — `meta`, элементы `local_resource`; расширить `RawKnowledgeItem` (`favicon_url`, `is_citable`, `prompt_context_metadata`); в `RawThinkingBlock` — `truncated`, `cut_off`, `signature`, `alternative_display_type`; типы `RawDisplayContent` (`text` | `json_block` | `table` | `rich_link` | `rich_content`)
- [x] 1.2 `model.ts`: типы `ToolCall`, `ToolResult`, `ResultFile`, расширенный `KnowledgeSource`, `ConversationFile`, `ConversationFileRevision`; `Block.tool` по разделу 3.1; `Conversation.files`; `Archive.exportedAt`; `Block.thinking.isTruncated`
- [x] 1.3 `normalize.ts`: `parseToolCall(input, displayContent)` — распознавание по форме, порядок из 3.2
- [x] 1.4 `normalize.ts`: `parseToolResult(content, displayContent)` — распознавание по форме, включая парсинг `{returncode, stdout, stderr}` с фолбэком на текст
- [x] 1.5 `normalize.ts`: `parseDisplayContent` — извлечение `language`/`filename` из `json_block`, подписи из `text`, ссылки из `rich_link`
- [x] 1.6 `normalize.ts`: расширить `extractSources` до полного `KnowledgeSource`
- [x] 1.7 `normalize.ts`: `collectConversationFiles(messages)` — сборка по `path`, реконструкция с верификацией (3.5)
- [x] 1.8 `build-archive.ts`: довести `manifestCreatedAt` до `Archive.exportedAt`
- [x] 1.9 `link-projects.ts`: перевести на `result.kind === 'text' ? result.fragments : []` (эвристика по первой строке фрагмента сохраняется — она рабочая: uuid чанков не совпадают с uuid документов, альтернативы нет)
- [x] 1.10 `stats.ts`: `topTools` считать по `block.name` (без изменений логики), добавить `fileCount` по `conversation.files`
- [x] 1.11 Тесты `normalize.test.ts`: по одному кейсу на каждый `ToolCall.kind` и `ToolResult.kind`; bash с невалидным JSON; `local_resource`; реконструкция файла с тремя правками; все три ошибки реконструкции
- [x] 1.12 Тест `link-projects.test.ts`: не сломан после смены источника фрагментов

**Критерий приёмки:** `npm test` зелёный; `npx tsc -b` без ошибок; ручной прогон `buildArchive` по `claude-data/` — 8 файлов найдены, все с `content !== null`.

### Слой 2 — рендер инструментов

Файлы: `src/components/conversation/blocks/tool-block.tsx` (+ новые подкомпоненты), `src/components/common/markdown.tsx`, `src/i18n/locales/*.json`

- [ ] 2.1 Каркас `ToolBlock`: подпись из `label ?? t('tools.<name>', name)`, иконка по `name`, затем по `iconName`, затем по `call.kind`, затем `Wrench`
- [ ] 2.2 `CommandCall` + `CommandResult`: код команды с подсветкой по `language`; результат — `stdout`/`stderr` раздельно, код возврата бейджем, ненулевой — как ошибка
- [ ] 2.3 `FileWriteCall`: путь заголовком, содержимое как код с подсветкой по `language`
- [ ] 2.4 `FileEditCall`: два блока — удалено/добавлено, с цветовой разметкой (`old_str`/`new_str` короткие, максимум 802 символа, усечение не нужно)
- [ ] 2.5 `FileReadCall`: путь и диапазон строк; результат — код (в архиве уже с номерами строк)
- [ ] 2.6 `FilesResult` (`local_resource`): имя, путь, mime; ссылка-якорь на секцию «Файлы беседы» — **закрывает пустой блок `present_files`**
- [ ] 2.7 `SourcesResult`: все заголовки со ссылками + `favicon`, домен (`siteName ?? domain`), дата публикации (`publishedAt`); пометка «источник недоступен» при `isMissing`
- [ ] 2.8 Усечение тел: общий бюджет 2 000 символов на блок, кнопка «показать полностью» с указанием полного размера; заголовки источников не режутся
- [ ] 2.9 `TextResult`: моноширинный, с тем же усечением
- [ ] 2.10 Фолбэк `raw`: текущий вид (`JSON.stringify`) — для незнакомых форм
- [ ] 2.11 i18n: `tools.create_file`, `tools.present_files`, `tools.str_replace`; ключи `common.showFull`, `common.truncatedChars`, `common.exitCode`, `common.stderr`, `common.sourceUnavailable`, `common.publishedAt` — в `ru.json` и `en.json`
- [ ] 2.12 `ThinkingBlock`: пометка при `isTruncated`

**Критерий приёмки:** ни один блок из выгрузки не рендерится пустым; `present_files` показывает файл; `bash_tool` показывает stdout читаемым текстом, а не JSON-строкой с `\n`.

### Слой 3 — файлы беседы

Файлы: `src/components/conversation/conversation-view.tsx`, новый `conversation-files.tsx`, `src/lib/download.ts`

- [ ] 3.1 Секция «Файлы беседы» в шапке беседы, свёрнута по умолчанию, счётчик в заголовке; не рендерится при нуле файлов
- [ ] 3.2 Подсекции «Предъявленные» / «Промежуточные» (`Collapsible`); пустая подсекция не рисуется; при единственной непустой — заголовок подсекции не показывается
- [ ] 3.3 Карточка файла: имя, путь, размер, число правок (`revisions`), время создания и последней правки, пометка «предъявлен»
- [ ] 3.4 Просмотр содержимого: раскрытие с усечением 2 000 и «показать полностью»
- [ ] 3.5 Скачивание через существующий `lib/download.ts`; кнопка только при `content !== null`; подпись «собрано из истории правок»; при ошибке — пояснение вместо кнопки (`noCreate` / `ambiguousEdit` / `missingEdit`)
- [ ] 3.6 Якоря `id` на карточках — цель ссылок из блоков `present_files`
- [ ] 3.7 i18n: `conversation.files*`, `conversation.filePresented`, `conversation.fileRevisions`, `conversation.fileReconstructed`, три текста ошибок реконструкции

**Критерий приёмки:** в беседе `e9c9614d…` секция показывает 8 файлов, у `00-мастер-бриф-v0.2.md` — 3 правки, скачивание даёт 14 702 символа.

### Слой 4 — поиск

Файлы: `src/lib/search/query.ts`, `index.ts`, `src/components/conversation/conversation-list-panel.tsx`, `src/components/project/project-list-panel.tsx`, `src/store/archive-store.tsx`, i18n

- [ ] 4.1 `query.ts`: удалить `parseQuery`, `ParsedQuery`, `TOKEN_RE`, `HAS_VALUES` — язык запросов уходит целиком (U1). На замену — `normalizeQuery(query): string`: `trim`, схлопывание пробелов, нижний регистр
- [ ] 4.2 `query.ts`: `matchesQuery(haystack, needle)` — прежний `includes` по нижнему регистру, порядок слов строгий (U2). Из `compileTextMatcher` убрать `regexMode`, а `regexError` — по всей цепочке
- [ ] 4.3 `index.ts`: `buildSearchIndex` — только `kind: 'text'` (48 записей вместо 383); удалить `SearchScope`, `DEFAULT_SEARCH_SCOPE`, `SearchBlockKind`, `toolName`, `SearchOptions`
- [ ] 4.4 `index.ts`: `runSearch(index, query)` — параметры `projects`, `projectLinks`, `options` больше не нужны (были нужны только для `in:` и области поиска); `SearchOutcome` схлопывается в массив результатов, `regexError` исчезает
- [ ] 4.5 `index.ts`: `buildDocIndex(projects)` — записи `{projectUuid, docUuid, filename, text}` (имя + описание проекта + содержимое, U3); `runProjectSearch` на том же `matchesQuery`
- [ ] 4.6 `conversation-list-panel.tsx`: удалить кнопки «Regex», «Искать в размышлениях», «Искать в инструментах», состояния `scope`/`regexMode`, блок ошибки regex и импорты `Button`/`Tooltip`, если осели без применения
- [ ] 4.7 `project-list-panel.tsx`: поле поиска, число совпавших документов на карточке, состояние «ничего не найдено»
- [ ] 4.8 `project-view.tsx`: перевести локальный фильтр документов на `matchesQuery`; **починить рассинхрон** — `selectedDoc` искать по отфильтрованному списку (`project-view.tsx:44`)
- [ ] 4.9 i18n: удалить `conversation.regex`, `conversation.regexTooltip`, `searchThinking`, `searchThinkingTooltip`, `searchTools`, `searchToolsTooltip`; заменить `conversation.searchPlaceholder` (сейчас рекламирует удаляемый синтаксис `tool/web_search from:2026-08-01 in:"project"`); добавить `project.searchPlaceholder`, `project.matchesCount`
- [ ] 4.10 Тесты `query.test.ts` переписать: регистронезависимость, схлопывание пробелов, пустой запрос, кавычки и двоеточия как обычные символы (`from:2026` и `tool/web_search` теперь ищутся буквально)

**Критерий приёмки:** `дневник сновидений` находит то же, что и раньше; `сновидений дневник` не находит ничего (порядок слов строгий — так и задумано); `tool/web_search` ищется как обычный текст; поиск в списке проектов находит проект по тексту внутри документа; в `lib/search` не осталось упоминаний regex, области поиска и префиксных фильтров.

### Слой 5 — экспорт

Файлы: `src/lib/export/markdown.ts`, `json.ts`, `zip-all.ts`, i18n

- [ ] 5.1 `renderTool` по `call.kind`: команда — fenced-блок с языком; правка — два fenced-блока; чтение — путь и диапазон; запрос/загрузка — строкой
- [ ] 5.2 `renderTool` по `result.kind`: команда — stdout/stderr с кодом возврата; источники — список ссылок с датами; файлы — ссылки на якоря секции «Файлы»; текст — fenced-блок
- [ ] 5.3 Секция «Файлы» в конце документа, всегда; содержимое целиком, **без усечения**
- [ ] 5.4 При `includeTools: true` блок `create_file` печатает якорь вместо тела — содержимое ровно один раз (Q17)
- [ ] 5.5 `json.ts` / `zip-all.ts`: проверить, что режим «сырой JSON» не затронут (он опирается на `conversation.raw`)
- [ ] 5.6 i18n: `export.filesHeading`, `export.fileMeta`, `export.exitCode`
- [ ] 5.7 Тесты `markdown.test.ts`: каждый `call.kind`/`result.kind`; секция файлов; отсутствие дубля содержимого при `includeTools: true`

**Критерий приёмки:** экспорт беседы `e9c9614d…` содержит все 8 файлов один раз каждый; `npm test` зелёный.

### Слой 6 — детектор незнакомого

Файлы: `src/lib/archive/normalize.ts`, `model.ts`, `src/components/dashboard/dashboard-page.tsx`, i18n

- [ ] 6.1 Белые списки ключей по типам блоков (составлены по фактическим данным, см. 2.1) и по типам элементов результата
- [ ] 6.2 Сбор предупреждений при нормализации: неизвестный `type` блока, неизвестный `type` элемента результата, неизвестный `display_content.type`, ключи вне белого списка, непустые `attachments`/`files`
- [ ] 6.3 Агрегация: одно предупреждение на вид с числом вхождений, а не по одному на блок
- [ ] 6.4 Плашка на дашборде: «в архиве есть данные, которых читалка не знает» со списком видов и счётчиками
- [ ] 6.5 i18n: `errors.unknownBlockType`, `errors.unknownResultItem`, `errors.unknownKeys`, `errors.unverifiedAttachments`
- [ ] 6.6 Тест: подложить блок с выдуманным полем — предупреждение появляется, рендер не падает

**Критерий приёмки:** на текущей выгрузке предупреждений **ноль**; на выгрузке с искусственно добавленным полем — ровно одно, с верным счётчиком.

### Слой 7 — интерфейсные правки

Файлы: `src/components/layout/app-shell.tsx`, `package.json`, i18n

- [ ] 7.1 Шапка сайдбара → `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton size="lg"` со ссылкой на `/`, иконка `Archive`, `tooltip` с названием — заголовок перестаёт наплывать в icon-режиме (Q19)
- [ ] 7.2 Футер: `Separator`, затем пункт «Автор: ArtMan-8» → `https://github.com/ArtMan-8`, `target="_blank" rel="noreferrer"`, приглушённый, с `tooltip` (Q12, Q13)
- [ ] 7.3 Инлайн-SVG логотипа GitHub как компонент-иконка (в lucide 1.37 бренд-иконок нет) (Q14)
- [ ] 7.4 `package.json`: `author`, `repository`, `homepage`
- [ ] 7.5 i18n: `nav.author`, `nav.authorTooltip`
- [ ] 7.6 Проверка в свёрнутом сайдбаре: видны только иконки, у обеих новых точек есть tooltip

**Критерий приёмки:** сайдбар в обоих состояниях без наплыва текста; ссылка открывается в новой вкладке.

---

## 7. Верификация

1. `npm test` — зелёный после каждого слоя.
2. `npx tsc -b` — без ошибок.
3. `npm run build` — сборка проходит.
4. **Разовый прогон по реальному архиву** (Q4): скрипт во временной директории вызывает `buildArchive` по `claude-data/` и печатает: число бесед/проектов/файлов, `warnings`, распределение `call.kind`/`result.kind`, результат реконструкции каждого файла. Ожидание: 9 бесед, 6 проектов, 8 файлов, 0 предупреждений, все файлы воспроизведены. Скрипт в репозиторий не коммитится, данные из `claude-data/` не покидают машину.
5. Ручной осмотр в браузере: беседа `e9c9614d…` (все семь инструментов, файлы), `a6dcb4cc…` (источники и цитаты), пустая беседа `91d23c23…`.

---

## 8. Риски

| Риск | Смягчение |
|---|---|
| Распознавание по форме ошибётся на инструменте с необычным `input` | последний вариант — `kind: 'raw'` с текущим видом; данные не теряются |
| Реконструкция файла даст неверное содержимое | верификация вхождения `old_str`; при провале файл не отдаётся |
| Удаление поиска по инструментам и regex необратимо ухудшит чей-то сценарий | решение зафиксировано (Q21); откат — один коммит слоя 4 |
| `attachments`/`files` в следующей выгрузке окажутся другой формы | предупреждение при непустом значении (6.2) |
| Порог усечения 2 000 окажется мал для чтения выдачи | вынести константу в одно место, менять одной правкой |
| Фикстуры разойдутся с реальным форматом | формы скопированы из фактических данных; проверка пунктом 7.4 |

---

## 9. Todo

**Слой 1 — модель и нормализация** ☑ 1.1 ☑ 1.2 ☑ 1.3 ☑ 1.4 ☑ 1.5 ☑ 1.6 ☑ 1.7 ☑ 1.8 ☑ 1.9 ☑ 1.10 ☑ 1.11 ☑ 1.12
**Слой 2 — рендер инструментов** ☐ 2.1 ☐ 2.2 ☐ 2.3 ☐ 2.4 ☐ 2.5 ☐ 2.6 ☐ 2.7 ☐ 2.8 ☐ 2.9 ☐ 2.10 ☐ 2.11 ☐ 2.12
**Слой 3 — файлы беседы** ☐ 3.1 ☐ 3.2 ☐ 3.3 ☐ 3.4 ☐ 3.5 ☐ 3.6 ☐ 3.7
**Слой 4 — поиск** ☐ 4.1 ☐ 4.2 ☐ 4.3 ☐ 4.4 ☐ 4.5 ☐ 4.6 ☐ 4.7 ☐ 4.8 ☐ 4.9 ☐ 4.10
**Слой 5 — экспорт** ☐ 5.1 ☐ 5.2 ☐ 5.3 ☐ 5.4 ☐ 5.5 ☐ 5.6 ☐ 5.7
**Слой 6 — детектор незнакомого** ☐ 6.1 ☐ 6.2 ☐ 6.3 ☐ 6.4 ☐ 6.5 ☐ 6.6
**Слой 7 — интерфейс** ☐ 7.1 ☐ 7.2 ☐ 7.3 ☐ 7.4 ☐ 7.5 ☐ 7.6

Отметки проставляются в чек-листах раздела 6 по мере выполнения; этот раздел — сводка для быстрого взгляда.

Порядок коммитов: 1 → 2 → 3 → 4 → 5 → 6 → 7. Слои 1–3 связаны (модель, её рендер, её потребитель); 4–7 независимы между собой и могут переставляться.
