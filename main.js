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

  sendJson(res, 200, []);
}

// ---------------------------------------------------------------
// 5. Надсилання JSON-відповіді
// ---------------------------------------------------------------
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
