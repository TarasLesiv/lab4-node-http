// Лабораторна робота №4. Варіант 1.
// Простий HTTP-сервер на Node.js: читає файл даних bank_managers.json
// (JSON-масив) і повертає його обробленим за параметрами рядка запиту.
//
// Робота з файлами — ЛИШЕ колбек-API модуля fs:
// fs.readFile, fs.writeFile, fs.access. Без Sync, без promises, без async/await.

import http from 'node:http';
import fs from 'node:fs';
import { Command } from 'commander';

// ---------------------------------------------------------------
// 1. Параметри командного рядка
// ---------------------------------------------------------------
const program = new Command();

program
  .name('main.js')
  .description(
    'HTTP-сервер, що читає файл даних і повертає його обробленим за параметрами рядка запиту'
  )
  // commander за замовчуванням забирає -h під довідку,
  // тому лишаємо для довідки тільки довгий варіант --help,
  // а короткий -h віддаємо під --host.
  .helpOption('--help', 'показати довідку')
  .requiredOption('-i, --input <path>', 'шлях до файлу даних (обов’язково)')
  .requiredOption('-h, --host <address>', 'адреса сервера (обов’язково)')
  .requiredOption('-p, --port <number>', 'порт сервера (обов’язково)')
  .option('-o, --output <path>', 'файл, у який записується остання надіслана відповідь');

program.parse(process.argv);

const options = program.opts();

// Порт має бути цілим числом у допустимому діапазоні.
const port = Number(options.port);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Помилка: --port має бути цілим числом від 0 до 65535');
  process.exit(1);
}

// ---------------------------------------------------------------
// 2. Перевірка, що файл даних існує й доступний для читання
// ---------------------------------------------------------------
fs.access(options.input, fs.constants.R_OK, (accessError) => {
  if (accessError) {
    console.error(`Cannot find input file: ${options.input}`);
    process.exit(1);
  }

  startServer();
});

// ---------------------------------------------------------------
// 3. HTTP-сервер
// ---------------------------------------------------------------
function startServer() {
  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });

  server.listen(port, options.host, () => {
    console.log(`Сервер слухає http://${options.host}:${port}`);
    console.log(`Файл даних: ${options.input}`);
    if (options.output) {
      console.log(`Файл виводу: ${options.output}`);
    }
  });

  server.on('error', (serverError) => {
    console.error(`Помилка сервера: ${serverError.message}`);
    process.exit(1);
  });
}

// ---------------------------------------------------------------
// 4. Обробник запиту
// ---------------------------------------------------------------
function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Дані віддаються лише за маршрутом «/», будь-який інший шлях — 404.
  if (url.pathname !== '/') {
    sendJson(res, 404, { error: 'Маршрут не знайдено' });
    return;
  }

  // Параметри рядка запиту. Значення завжди є рядками, тому
  // числові й логічні значення перетворюємо явно.
  const flags = readFlags(url.searchParams);

  if (flags.error) {
    sendJson(res, 400, { error: flags.error });
    return;
  }

  // Файл даних перечитується на кожен запит — асинхронно, через колбек.
  fs.readFile(options.input, 'utf8', (readError, rawData) => {
    if (readError) {
      sendJson(res, 500, { error: 'Не вдалося прочитати файл даних' });
      return;
    }

    let records;
    let result;

    try {
      records = parseData(rawData);
      result = buildResponse(records, flags);
    } catch (parseError) {
      sendJson(res, 500, { error: 'Файл даних пошкоджено (некоректний JSON)' });
      return;
    }

    sendResponse(res, result);
  });
}

// ---------------------------------------------------------------
// 5. Надсилання успішної відповіді
//    Якщо задано --output, та сама відповідь спершу записується у файл.
// ---------------------------------------------------------------
function sendResponse(res, payload) {
  const body = JSON.stringify(payload);

  if (!options.output) {
    sendBody(res, 200, body);
    return;
  }

  fs.writeFile(options.output, body, 'utf8', (writeError) => {
    if (writeError) {
      sendJson(res, 500, { error: 'Не вдалося записати відповідь у файл' });
      return;
    }

    sendBody(res, 200, body);
  });
}

// ---------------------------------------------------------------
// 6. Параметри рядка запиту (варіант 1)
//    ?mfo=true    — показувати код МФО (поле MFO)
//    ?normal=true — лише банки зі станом 1 («Нормальний», поле COD_STATE)
// Прапорець увімкнено лише тоді, коли його значення — саме «true».
// ---------------------------------------------------------------
const ALLOWED_PARAMS = ['mfo', 'normal'];

function readFlags(searchParams) {
  // Невідомий параметр — це помилка клієнта (400), а не мовчазне ігнорування.
  for (const name of new Set(searchParams.keys())) {
    if (!ALLOWED_PARAMS.includes(name)) {
      return { error: `Невідомий параметр запиту: ${name}` };
    }
  }

  return {
    mfo: searchParams.get('mfo') === 'true',
    normal: searchParams.get('normal') === 'true',
    error: null,
  };
}

// ---------------------------------------------------------------
// 7. Формування відповіді: лише поля варіанта, у заданому порядку
//    mfo_code ← MFO (якщо mfo=true), name ← SHORTNAME, state_code ← COD_STATE
// ---------------------------------------------------------------
function buildResponse(records, flags) {
  const result = [];

  for (const item of records) {
    if (item === null || typeof item !== 'object') {
      continue;
    }

    const stateCode = toNumber(item.COD_STATE);

    // Фільтр ?normal=true — строга рівність 1.
    if (flags.normal && stateCode !== 1) {
      continue;
    }

    const record = {};

    if (flags.mfo) {
      record.mfo_code = toNumber(item.MFO);
    }

    record.name = toText(item.SHORTNAME);
    record.state_code = stateCode;

    result.push(record);
  }

  return result;
}

// ---------------------------------------------------------------
// 8. Перетворення значень
// ---------------------------------------------------------------
function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();

  if (text === '') {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

function toText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : String(value);
}

// ---------------------------------------------------------------
// 9. Розбір даних: звичайний JSON-документ або NDJSON
// ---------------------------------------------------------------
function parseData(rawData) {
  const text = rawData.trim();

  if (text === '') {
    return [];
  }

  // Спершу пробуємо звичайний JSON (масив або одиничний об’єкт).
  try {
    const parsed = JSON.parse(text);

    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (jsonError) {
    // Не вдалося — отже, це може бути NDJSON: один JSON-об’єкт на рядок.
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');

    return lines.map((line) => JSON.parse(line));
  }
}

// ---------------------------------------------------------------
// 10. Надсилання JSON-відповіді
// ---------------------------------------------------------------
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function sendJson(res, statusCode, payload) {
  sendBody(res, statusCode, JSON.stringify(payload));
}

function sendBody(res, statusCode, body) {
  res.writeHead(statusCode, JSON_HEADERS);
  res.end(body);
}
