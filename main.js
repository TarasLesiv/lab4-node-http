// Лабораторна робота №4. Варіант 1.
// Простий HTTP-сервер на Node.js: читає файл даних bank_managers.json
// (JSON-масив) і повертає його обробленим за параметрами рядка запиту.

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

console.log('Параметри запуску:');
console.log('  input :', options.input);
console.log('  host  :', options.host);
console.log('  port  :', port);
console.log('  output:', options.output ?? '(не задано)');
