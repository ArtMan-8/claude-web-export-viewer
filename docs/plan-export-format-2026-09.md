# План: поддержка формата выгрузки claude.ai от 2026-09-18

Статус: выполнен 2026-09-19, все пять слоёв (коммиты dd23973 → d6f6e91).
Источник: `claude-data/` (в git не попадает), manifest `version: "1.0"`, `created_at: 2026-09-18T17:35:52Z`.
Предыдущий план: `plan-export-format-2026-08.md` — все семь слоёв выполнены, этот план строится поверх.

---

## 1. Что в выгрузке

| Файл | Содержимое | Совпадает с текущими типами |
|---|---|---|
| `conversations-000.zip → conversations.json` | 26 бесед, 275 сообщений, 450 блоков | да, блоки распознаются полностью |
| `projects-000.zip → projects/*.json` | 10 проектов, 152 документа (79 с содержимым) | да |
| `frames-000.zip → artifacts/<id>/artifact.json` + `versions/<ver>.html` | 1 артефакт, 2 версии | **нет — новая категория** |
| `light_metadata-000.zip → users.json`, `login_history.json` | 1 пользователь, 23 события входа | да |
| `manifest-*.json` | 4 записи `data_files` | категория `frames` не входит в `KNOWN_CATEGORIES` |

Замеры (разовый прогон `buildArchive` по реальному архиву):

```
предупреждения        4: unknownObjectFormat ×1, jsonParseFailed ×2 (frames), unverifiedAttachments ×1
блоки                 tool 239, thinking 146, text 65; unknown 0
call.kind             command 71, query 76, fetch 27, filePresent 21, fileWrite 19, fileEdit 16, fileRead 9; raw 0
result.kind           command 69, sources 81, files 21, text 68; none 0
файлы бесед           15, все реконструированы (content !== null)
беседы без содержимого  14 из 26 (≈220 сообщений); плюс 1 с нулём сообщений
проекты без содержимого 4 из 10 (73 документа); плюс 1 без документов
attachments           1: {file_name:"", file_type:"txt", file_size:34087, extracted_content: 19 114 символов}
files                 4: {file_uuid, file_name: null | ""} — содержимого в экспорте нет
local_resource        новый ключ artifact_publishable: true (×37)
```

**Суть дельты.** Разбор блоков из августовского плана держится без единой поправки. Новое — три вещи вокруг блоков: (а) удалённые беседы и проекты экспортируются скелетом без содержимого, и читалка показывает их как «нет сообщений»; (б) артефакты приехали новой категорией `frames` и падают в предупреждения; (в) вложения пользователя (`attachments`/`files`) теперь встречаются в данных, их форма известна, но не рендерится. Плюс два независимых улучшения интерфейса: папки в документах проектов и нечитаемые блоки кода в светлой теме.

---

## 2. Установленные факты о данных

### 2.1 Удалённые записи

У 14 бесед есть сообщения (2…62), но у **каждого** `text: ""` и `content: []`, у беседы `name: ""`. У 4 проектов `name: ""`, все документы с `filename: ""` и `content: ""`. Это **удалённые** беседы и проекты, а не сбой экспорта — проверено двумя способами:

1. `updated_at` удалённой записи — момент удаления, и он совпадает по минутам между беседами и проектами, удалёнными одним действием:

   | Минута | Беседы | Проекты |
   |---|---|---|
   | 2026-08-21 15:42 | `5beae2e2` (0 сообщений) | `019f2416` (стартовый) |
   | 2026-08-29 11:32 | `6414b13a` | `01a04d3c` (без документов) |
   | 2026-09-18 16:57 | `e9c9614d`, `40d45a17` | `01a04d4b`, `01a05171` |

   Владелец архива подтвердил удаление `e9c9614d` («мастер-бриф») 18.09.

2. У живой беседы `updated_at` совпадает с последним сообщением (8 из 11, остальные — открывались позже). У удалённых разрыв есть всегда, до 465 часов.

Повторный экспорт содержимое не вернёт. Беседа с нулём сообщений (`5beae2e2`) — автоматически созданная вместе со стартовым проектом и удалённая вместе с ним; формально попадает под критерий удалённой.

**Критерий в модели.** Беседа удалена, если у неё ≥ 1 сообщения и у всех `content` пуст **и** `text` пуст. Проект удалён, если у него ≥ 1 документа и у всех пусты `filename` **и** `content`. Дата удаления — `updated_at`. Беседы с 0 сообщений и проекты с 0 документов остаются «пустыми» (`isEmpty`), как сейчас.

### 2.2 Артефакты (`frames`)

```
artifacts/<id>/artifact.json
  {id, kind: "artifact", visibility: "public", owner_account, updated_at, active_version,
   versions: [{id, title, description, created_at}]}
artifacts/<id>/versions/<version-id>.html   — самодостаточный HTML, без <script>, шрифты с fonts.googleapis.com
```

Связи артефакта с беседой в данных **нет**: `id` артефакта в `conversations.json` не встречается. Сейчас `load.ts` пытается разобрать `.html` как JSON (`jsonParseFailed` ×2), а `artifact.json` не подходит ни под один `looksLike*` (`unknownObjectFormat`).

### 2.3 Вложения

```
chat_messages[].attachments[]: {file_name: string, file_type: string, file_size: number, extracted_content: string}
chat_messages[].files[]:       {file_uuid: string, file_name: string | null}
```

`extracted_content` — текст, который реально прочитал Claude (здесь 19 114 символов при `file_size` 34 087). У `files[]` содержимого в экспорте нет вообще.

### 2.4 Cowork-сессии

Cowork-сессии (идентификаторы вида `cse_…`) в экспорт **не попадают** ни в каком виде — строка `cse_` в архиве не встречается. Их единственный след — документы, которые они положили в проект (например, папка `claude/` в «Дневнике снов», 9 из 10 файлов созданы одной пачкой). Читалка это не отмечает — догадка, а не данные.

### 2.5 Пути документов проектов

`filename` содержит `/`, глубина ≤ 2: `Контент завод` — 8 в корне + `target-architecture/` 6 + `ideas/` 4; `content-fabric-search-practice` — 14 в корне + `architecture/` 7 + `search-practice/architectures/` 7; `ИИ редакция` — три папки по сегментам; `Дневник снов` — все 10 в `claude/`. Дубликатов путей нет. Zip-экспорт документов уже раскладывает по папкам (`zip-all.ts:73`).

### 2.6 Блоки кода в светлой теме

Подключена тема `highlight.js/styles/github-dark-dimmed.css` (`index.css:7`), она красит фон и текст только у `code.hljs`. У блока **без языка** (весь вывод `bash_tool`, текстовые результаты инструментов, fenced-блоки без языка в тексте) класса `hljs` нет: `pre` прозрачный (`prose-pre:bg-transparent`, `markdown.tsx:26`) или `bg-background` (`truncated-code.tsx:19`), а цвет текста — `--tw-prose-pre-code` от `prose`, светло-серый `oklch(0.928 …)`, рассчитанный на тёмный фон. Подтверждено в браузере: `db12c4d2`, блок «Конвейер» и вывод `du -sh` — серый на белом.

---

## 3. Карта покрытия

Легенда: ✅ обрабатывается · ⚠️ частично/неверно · ❌ теряется.

| Путь | Сейчас | Целевое |
|---|---|---|
| удалённая беседа (сообщения без содержимого) | ⚠️ «В этой беседе нет сообщений», в списке как обычная | карточка на дашборде; из списков, маршрутов, поиска и zip-экспорта исключена |
| удалённый проект (документы без содержимого) | ⚠️ скрыт фильтром `isEmpty` молча | то же |
| `manifest.data_files[].category = "frames"` | ⚠️ неизвестная категория, файл всё равно читается | `KNOWN_CATEGORIES` + `'frames'` |
| `frames → artifacts/*/artifact.json` | ❌ `unknownObjectFormat` | `Archive.artifacts` |
| `frames → artifacts/*/versions/*.html` | ❌ `jsonParseFailed` | `Artifact.versions[].html` |
| `chat_messages[].attachments[]` | ❌ предупреждение «форма не проверена» | `Message.attachments`, чип в пузыре с раскрытием текста |
| `chat_messages[].files[]` | ❌ то же | `Message.files`, чип «не вошёл в экспорт» |
| `local_resource.artifact_publishable` | ⚠️ читается молча, детектор ключи элементов не проверяет | `ResultFile.isPublishable`, белый список ключей элементов |
| `docs[].filename` с `/` | ⚠️ плоский список | дерево папок |
| блок кода без языка в светлой теме | ⚠️ нечитаем | тема hljs по теме страницы |

---

## 4. Целевая доменная модель

### 4.1 Удалённые записи

```ts
interface Conversation {
  // …существующие поля…
  /** Сообщения есть, но содержимое у всех стёрто — беседа удалена; updatedAt = момент удаления */
  isDeleted: boolean
}

interface Project {
  // …существующие поля…
  /** Документы есть, но у всех пусты имя и содержимое — проект удалён; updatedAt = момент удаления */
  isDeleted: boolean
  /** Число документов в архиве до фильтрации заглушек (у живого проекта совпадает с docs.length) */
  rawDocCount: number
}
```

`normalizeProject` сейчас отфильтровывает документы-заглушки — у удалённого проекта `docs` становится `[]`, поэтому число документов нужно снять до фильтра.

`ArchiveStats` дополняется:

```ts
deletedConversationCount: number
deletedMessageCount: number
deletedProjectCount: number
deletedDocCount: number
```

`emptyConversationCount` считает только беседы, которые пусты **и не удалены**.

### 4.2 Артефакты

```ts
interface ArtifactVersion {
  id: string
  title: string
  description: string
  createdAt: string
  html: string | null           // null, если версия объявлена в artifact.json, но файла нет
}

interface Artifact {
  id: string
  visibility: string
  ownerAccountUuid: string
  updatedAt: string
  activeVersionId: string | null
  versions: ArtifactVersion[]   // по createdAt, новые первыми
  title: string                 // заголовок активной версии, иначе последней
}

interface Archive {
  // …существующие поля…
  artifacts: Artifact[]
}
```

Сырая форма — `RawArtifactMeta` в `raw-types.ts` по 2.2. Сопоставление версии с файлом — по имени `versions/<id>.html`. HTML, для которого нет `artifact.json`, — предупреждение `artifactMetaMissing`; версия из `artifact.json` без файла — `html: null` и предупреждение `artifactVersionMissing`.

### 4.3 Вложения

```ts
interface MessageAttachment {
  name: string                  // file_name; пустое — UI подставит «Вложение»
  type: string                  // file_type: 'txt', …
  size: number | null           // file_size, байты
  extractedText: string         // extracted_content — то, что прочитал Claude
}

interface MessageFile {
  uuid: string                  // file_uuid
  name: string | null           // file_name
}

interface Message {
  // …существующие поля…
  attachments: MessageAttachment[]
  files: MessageFile[]
}
```

Два критерия намеренно различаются. `isEmpty` сообщения смотрит на блоки **и** вложения — сообщение с вложением без единого блока показывается, а не выпадает из ленты. Критерий удалённости из 2.1 смотрит только на `content` и `text`: у удалённых бесед `files[]` тоже встречаются (`e9c9614d`, `c1b0fe4d`, `a08e23d3` несут `{file_uuid, file_name: null}`), и учёт вложений сделал бы их «живыми».

### 4.4 Файлы результата

```ts
interface ResultFile {
  // …существующие поля…
  isPublishable: boolean        // artifact_publishable
}
```

### 4.5 Дерево документов проекта

Только в UI, модель не меняется:

```ts
interface DocTreeNode {
  kind: 'dir' | 'doc'
  name: string                  // сегмент пути
  path: string                  // полный путь до узла
  children: DocTreeNode[]       // только у dir; папки раньше файлов, внутри групп — по алфавиту
  doc?: ProjectDoc              // только у doc
}

function buildDocTree(docs: ProjectDoc[]): DocTreeNode[]
```

Функция чистая, живёт в `src/lib/archive/doc-tree.ts` с тестом. Документ без `/` — в корне. Пустой `filename` — в корне под именем «Без имени».

---

## 5. Принятые решения

| № | Решение | Обоснование |
|---|---|---|
| Q1 | Удалённые записи описываются по факту в данных, без догадок о происхождении | читалка описывает данные; предположение про Cowork опровергнуто (2.4) |
| Q2/Q18/Q21/Q22 | Удалённые беседы и проекты живут **только** на дашборде: карточка со счётчиками и раскрывающейся таблицей. В списках, маршрутах, поиске и zip-экспорте их нет; в `index.md` экспорта — раздел с той же таблицей. «Сырой JSON» — как в архиве | показывать нечего; одна карточка закрывает единственную цель — человек знает, что записи удалены, а не спрятаны читалкой |
| Q4 | Счётчик «из них пустых» остаётся для реально пустых; удалённые — отдельная карточка, не `LoadWarning` | это факт о данных, а не ошибка читалки |
| Q5 | Артефакты — раздел `/artifacts` и `/artifacts/$id` по образцу проектов; пункт в сайдбаре скрыт при нуле артефактов | симметрия с беседами/проектами; старые выгрузки без `frames` не получают пустой раздел |
| Q6/Q19 | Просмотр в `<iframe sandbox srcdoc>` без `allow-*`; кнопка «Выполнять скрипты» перемонтирует iframe с `allow-scripts` (без `allow-same-origin`), действует до ухода с артефакта, не запоминается; рядом пояснение про сеть | безопасно по умолчанию; включение — явное действие каждый раз |
| Q7 | Переключатель версий, по умолчанию `active_version`; скачивание любой версии `.html` | ровно то, что есть в данных; diff HTML нечитаем |
| Q8 | Артефакт с беседой не связывается | связи в данных нет; эвристика по времени привела бы в удалённую беседу |
| Q9 | `extracted_content` — чип в пузыре пользователя, по клику раскрывается текст с усечением `TRUNCATE_BUDGET` | вложение там, где отправлено; механизм усечения уже есть |
| Q10 | `files[]` — чип «файл не вошёл в экспорт», uuid в подсказке | читалка не теряет молча |
| Q11 | Текст вложений в поисковый индекс не идёт | Q21 августовского плана: только текст диалога |
| Q12 | Папки развёрнуты по умолчанию, состояние в памяти компонента | ≤ 28 документов, прятать нечего |
| Q13 | Порядок как в файловом менеджере: папки, затем файлы, по алфавиту внутри групп | имена вида `01-part0…` уже задуманы под сортировку |
| Q14 | При поиске дерево сохраняется: папки без совпадений скрыты | контекст пути не теряется |
| Q15 | Единственная корневая папка не схлопывается | без особых случаев |
| Q16 | Порядок слоёв: 0 код → 1 удалённые → 2 вложения → 3 папки → 4 артефакты | от самого дешёвого и болезненного к самому объёмному; артефакты — единственный слой с новыми маршрутами |
| Q17/Q20 | Тема hljs по теме страницы: `github.css` в светлой, `github-dark-dimmed.css` в тёмной; фон блока задаёт `pre` (`bg-muted` + рамка в светлой, `#22272e` в тёмной), у `code.hljs` фон обнулён | блок отличим от страницы в обеих темах; решение «тёмный код всегда» отменяется |

---

## 6. Работы по слоям

### Слой 0 — блоки кода в светлой теме

Файлы: `src/index.css`, новые `src/styles/hljs-light.css` и `src/styles/hljs-dark.css`, `src/components/common/markdown.tsx`, `src/components/common/truncated-code.tsx`

- [x] 0.1 Скопировать `github.css` и `github-dark-dimmed.css` из `highlight.js@11.12.0` в `src/styles/`, у тёмной все селекторы под `.dark`; шапкой — версия и источник. Из обеих убрать правила `.hljs { background }` и `pre code.hljs { padding }` — фон и отступ задаёт контейнер
- [x] 0.2 `index.css`: убрать `@import 'highlight.js/styles/github-dark-dimmed.css'` и комментарий про «тёмный код всегда»; подключить обе темы; правило для `.prose pre` и `pre` внутри `TruncatedCode`: светлая — `bg-muted` + `border`, тёмная — `#22272e`; цвет текста по умолчанию (для блоков без `hljs`) — `--foreground` в светлой, `#adbac7` в тёмной
- [x] 0.3 `markdown.tsx`: убрать `prose-pre:bg-transparent`, оставить `prose-pre:p-0`, отступ переносится на общее правило `pre`
- [x] 0.4 `truncated-code.tsx`: убрать `bg-background` с обёртки — фон теперь у `pre`
- [x] 0.5 Ручная проверка в обеих темах: блок без языка (`bash_tool` stdout), блок с языком (`mermaid`, `markdown`), код внутри пузыря пользователя, файл беседы

**Критерий приёмки:** в `db12c4d2` блок «Конвейер» и вывод `du -sh` читаются в светлой и тёмной теме; блоки с языком и без выглядят одинаково по фону.

### Слой 1 — удалённые беседы и проекты

Файлы: `src/lib/archive/model.ts`, `normalize.ts`, `stats.ts`, `src/components/dashboard/dashboard-page.tsx`, `conversation-list-panel.tsx`, `project-list-panel.tsx`, `src/routes/conversations/$uuid.tsx`, `src/routes/projects/$uuid.tsx`, `src/store/archive-store.tsx`, `src/lib/export/zip-all.ts`, i18n

- [x] 1.1 `model.ts`: `Conversation.isDeleted`, `Project.isDeleted`, `Project.rawDocCount`
- [x] 1.2 `normalize.ts`: критерий из 2.1 в `normalizeConversation` и `normalizeProject`; `rawDocCount` до фильтра заглушек; `isEmpty` сообщения учитывает вложения (4.3)
- [x] 1.3 `stats.ts`: четыре счётчика из 4.1; `emptyConversationCount` без удалённых
- [x] 1.4 Списки: `conversation-list-panel.tsx:44` и `project-list-panel.tsx:20` исключают `isDeleted`; поисковые индексы в `archive-store.tsx` строятся без удалённых
- [x] 1.5 Маршруты `$uuid`: удалённая запись → «не найдено» (как для несуществующего uuid) — прямых ссылок на них в UI нет
- [x] 1.6 Дашборд: карточка «Удалённые» (счётчики: беседы + сообщения, проекты + документы) с `Collapsible`-таблицей: тип, uuid, создано, удалено (`updatedAt`), сообщений/документов. Рисуется только при ненулевых счётчиках. Без подсказок о причинах
- [x] 1.7 `zip-all.ts`: удалённые беседы и проекты пропускаются; в `index.md` — раздел «Удалённые» с той же таблицей. `json.ts` не трогать
- [x] 1.8 i18n: `dashboard.deleted`, `dashboard.deletedConversations`, `dashboard.deletedProjects`, `dashboard.deletedTable.*`, `export.deletedHeading`
- [x] 1.9 Тесты `normalize.test.ts`: беседа с сообщениями без содержимого → `isDeleted`; беседа с 0 сообщений → `isEmpty`, не `isDeleted`; проект из заглушек → `isDeleted`, `rawDocCount`; сообщение с вложением и без блоков → не `isEmpty`. `stats` — счётчики. `zip-all` — удалённые не в файлах, есть в `index.md`

**Критерий приёмки:** на выгрузке дашборд показывает «14 бесед (217 сообщений), 5 проектов (74 документа)» — стартовый `019f2416` с единственной заглушкой тоже удалён по критерию 2.1 и попадает в таблицу (совпадает с ним же в таблице удалений), «из них пустых: 1» — `5beae2e2` с нулём сообщений остаётся пустой, как и требует критерий; в списках 11 бесед и 4 проекта (плюс 1 пустой проект `01a04d3c` — он не удалён по критерию, `docs.length === 0`, скрыт существующим фильтром `isEmpty`); zip не содержит пустых `.md`.

### Слой 2 — вложения

Файлы: `src/lib/archive/raw-types.ts`, `model.ts`, `normalize.ts`, новый `src/components/conversation/message-attachments.tsx`, `message-item.tsx`, `src/lib/export/markdown.ts`, i18n

- [x] 2.1 `raw-types.ts`: `RawAttachment` и `RawFile` — точные формы из 2.3 вместо `[key: string]: unknown`
- [x] 2.2 `model.ts`: `MessageAttachment`, `MessageFile`, `Message.attachments/files`; `ResultFile.isPublishable`
- [x] 2.3 `normalize.ts`: заполнение; белые списки `ATTACHMENT_KEYS`, `FILE_KEYS`, `LOCAL_RESOURCE_KEYS` (+ `artifact_publishable`), ключи вне списка — `unknownKeys` через существующий детектор; `recordUnverifiedAttachment` и код `unverifiedAttachments` удаляются
- [x] 2.4 `message-attachments.tsx`: над текстом в пузыре — чипы. Вложение: `Paperclip`, «имя · тип · размер» (пустое имя → `conversation.attachmentUntitled`), по клику `Collapsible` с `TruncatedCode` (язык `null`). Файл: `File`, «имя или «Файл» · не вошёл в экспорт», `title` = uuid
- [x] 2.5 `message-item.tsx`: рендер чипов для `human` над блоками; для `assistant` — тоже, если вдруг встретятся
- [x] 2.6 `markdown.ts`: вложение — подзаголовок «Вложение: имя (тип, размер)» и fenced-блок с текстом без усечения; файл — строка «Файл: имя — не вошёл в экспорт»
- [x] 2.7 i18n: `conversation.attachment`, `conversation.attachmentUntitled`, `conversation.fileNotExported`, `export.attachment`, `export.fileNotExported`; удалить `errors.unverifiedAttachments`
- [x] 2.8 Тесты: нормализация обеих форм; неизвестный ключ во вложении → предупреждение; markdown с вложением

**Критерий приёмки:** в `9530de99` первое сообщение показывает чип «Вложение · txt · 33 КБ» с раскрытием текста; в `a08e23d3` — нет (удалена); предупреждений на дашборде о вложениях нет.

### Слой 3 — папки в документах проектов

Файлы: новый `src/lib/archive/doc-tree.ts` (+тест), новый `src/components/project/doc-tree.tsx`, `project-view.tsx`

- [x] 3.1 `doc-tree.ts`: `buildDocTree(docs)` по 4.5
- [x] 3.2 `doc-tree.tsx`: рекурсивный список; папка — `Collapsible` с `Folder`/`FolderOpen` и шевроном, отступ по глубине; файл — существующая кнопка с `FileText`; выбранный подсвечен как сейчас
- [x] 3.3 `project-view.tsx`: дерево строится из `filteredDocs` (папки без совпадений исчезают сами); состояние «свёрнуто» — `Set<string>` путей в `useState`, сбрасывается при смене проекта; при непустом фильтре все папки принудительно развёрнуты
- [x] 3.4 Тесты `doc-tree.test.ts`: корень + папки, вложенность 2, сортировка, пустой `filename`, файл без `/`

**Критерий приёмки:** «Контент завод» — 8 файлов в корне и две папки; `content-fabric-search-practice` — папка `search-practice` с вложенной `architectures`; поиск «architecture» скрывает `ideas/`.

### Слой 4 — артефакты

Файлы: `src/lib/archive/manifest.ts`, `raw-types.ts`, `model.ts`, `load.ts`, `normalize.ts`, `build-archive.ts`, `stats.ts`, новые `src/routes/artifacts/{route,index,$id}.tsx`, `src/components/artifact/{artifact-list-panel,artifact-view}.tsx`, `app-shell.tsx`, `dashboard-page.tsx`, `zip-all.ts`, i18n

- [x] 4.1 `manifest.ts`: `'frames'` в `ArchiveCategory` и `KNOWN_CATEGORIES`
- [x] 4.2 `raw-types.ts`: `RawArtifactMeta` по 2.2
- [x] 4.3 `load.ts`: `collectJsonEntries` → `collectEntries`: записи с любым расширением; `.html` не парсится как JSON, а собирается в `LoadedRawData.artifactHtml: Map<path, string>`; `artifact.json` распознаётся по `kind === 'artifact'` и `versions` в `classifyAndCollect` → `LoadedRawData.artifacts`. Файлы иных расширений — по-прежнему `fileSkipped`
- [x] 4.4 `normalize.ts`: `normalizeArtifact(meta, htmlByPath, warnings)` — сопоставление версий с файлами по `artifacts/<id>/versions/<ver>.html`, предупреждения `artifactMetaMissing` / `artifactVersionMissing`, сортировка версий
- [x] 4.5 `build-archive.ts`: `Archive.artifacts`; `stats.ts`: `artifactCount`
- [x] 4.6 Маршруты и панели по образцу проектов: список (заголовок, число версий, дата последней), просмотр — заголовок, `visibility`, переключатель версий (`Tabs` или `DropdownMenu`: дата + описание), `<iframe sandbox srcdoc={html} className="h-full w-full">`, кнопка «Скачать .html» через `downloadText`, кнопка «Выполнять скрипты» (Q19) с пояснением
- [x] 4.7 `app-shell.tsx`: пункт «Артефакты» (`Frame`) между «Проекты» и «Аккаунт», рендерится при `archive.artifacts.length > 0`
- [x] 4.8 Дашборд: карточка «Артефакты» с числом (только при > 0)
- [x] 4.9 `zip-all.ts`: `artifacts/<slug-title>/<version-id>.html` для всех версий; в `index.md` — раздел «Артефакты» со ссылками
- [x] 4.10 i18n: `nav.artifacts`, `artifact.*` (title, versions, activeVersion, visibility, download, runScripts, runScriptsHint, notFound, selectPrompt, noArtifacts), `errors.artifactMetaMissing`, `errors.artifactVersionMissing`, `export.artifactsHeading`, `dashboard.artifacts`
- [x] 4.11 Тесты `load.test.ts`: zip с `artifact.json` + двумя `.html` → один артефакт, две версии, 0 предупреждений; `.html` без `artifact.json` → предупреждение; `manifest.test.ts`: `frames` известна

**Критерий приёмки:** 0 предупреждений на дашборде; раздел «Артефакты» показывает «Хакатонный радар 2026» с двумя версиями, активная — от 12:18; iframe рендерит страницу; скачанный `.html` совпадает с файлом из zip побайтно.

---

## 7. Верификация

1. `npm test` — зелёный после каждого слоя.
2. `npx tsc -b` — без ошибок.
3. `npm run build` — сборка проходит.
4. Разовый прогон по реальному архиву (скрипт во временной директории, в репозиторий не коммитится). Ожидание: 26 бесед (14 удалённых, 1 пустая — `5beae2e2`), 10 проектов (5 удалённых, 1 пустой), 1 артефакт с 2 версиями, 14 файлов, 1 вложение, 4 файла без содержимого, **0 предупреждений**. Факт 2026-09-19: совпадает.
5. Ручной осмотр: дашборд (карточки «Удалённые» и «Артефакты», нет плашки предупреждений); `9530de99` (вложение); `db12c4d2` (код в обеих темах); «Контент завод» и `content-fabric-search-practice` (дерево); артефакт (версии, песочница, скачивание).

---

## 8. Риски

| Риск | Смягчение |
|---|---|
| Критерий удалённости (всё пусто) совпадёт с живой беседой, где Claude ни разу не ответил | у живой беседы хотя бы первое сообщение человека имеет `content` или `text`; проверить на фикстуре |
| В следующей выгрузке у удалённых записей появится содержимое или изменится форма | критерий — строгое «всё пусто»; частично пустая запись живой останется и покажется как есть |
| `artifact.json` без `kind` или с другим `kind` | распознавание по `kind === 'artifact'` **и** массиву `versions`; иначе `unknownObjectFormat`, как сейчас |
| HTML артефакта с внешними ресурсами офлайн | шрифты не загрузятся — системный запасной; `sandbox` не даёт скриптов, ломаться нечему |
| `allow-scripts` без `allow-same-origin` — сеть доступна | пояснение под кнопкой; выбор не запоминается |
| Дерево из `filteredDocs` при поиске меняет набор узлов и сбрасывает состояние сворачивания | при непустом фильтре состояние игнорируется — всё развёрнуто (3.3) |
| Скопированные темы hljs разойдутся с версией пакета | шапка файла с версией; обновление пакета — повод перекопировать |

---

## 9. Todo

**Слой 0 — код в светлой теме** ☑ 0.1 ☑ 0.2 ☑ 0.3 ☑ 0.4 ☑ 0.5
**Слой 1 — удалённые записи** ☑ 1.1 ☑ 1.2 ☑ 1.3 ☑ 1.4 ☑ 1.5 ☑ 1.6 ☑ 1.7 ☑ 1.8 ☑ 1.9
**Слой 2 — вложения** ☑ 2.1 ☑ 2.2 ☑ 2.3 ☑ 2.4 ☑ 2.5 ☑ 2.6 ☑ 2.7 ☑ 2.8
**Слой 3 — папки документов** ☑ 3.1 ☑ 3.2 ☑ 3.3 ☑ 3.4
**Слой 4 — артефакты** ☑ 4.1 ☑ 4.2 ☑ 4.3 ☑ 4.4 ☑ 4.5 ☑ 4.6 ☑ 4.7 ☑ 4.8 ☑ 4.9 ☑ 4.10 ☑ 4.11

Порядок коммитов: 0 → 1 → 2 → 3 → 4, по коммиту на слой. Слои независимы друг от друга, кроме 1.2 ↔ 2.x (`isEmpty` сообщения учитывает вложения — поле появляется в слое 2, в слое 1 пока считается по блокам).
