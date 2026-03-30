// ============================================================
// FILE: indexer.js
// ============================================================

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, '..');
const ASSETS_ROOT = path.join(REPOSITORY_ROOT, 'Assets');
const OUTPUT_FILE_PATH = path.join(PROJECT_ROOT, 'cards.json');
const ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const CARD_FOLDERS = [
  {
    type: 'hero',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'Heroes'),
    publicBasePath: '/Assets/Cards/Heroes'
  },
  {
    type: 'mainhero',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'MainHeroes'),
    publicBasePath: '/Assets/Cards/MainHeroes'
  },
  {
    type: 'monster',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'Monsters'),
    publicBasePath: '/Assets/Cards/Monsters'
  }
];

function normalizeToPublicPath(basePath, filename) {
  const joined = path.posix.join(basePath, filename);
  return joined.startsWith('/') ? joined : `/${joined}`;
}

function readImageFiles(folderPath) {
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  const directoryEntries = fs.readdirSync(folderPath, { withFileTypes: true });

  return directoryEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => ACCEPTED_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

function buildCards() {
  const cards = [];
  const counts = {
    hero: 0,
    mainhero: 0,
    monster: 0
  };

  let currentId = 1;

  for (const folder of CARD_FOLDERS) {
    const filenames = readImageFiles(folder.absolutePath);

    for (const filename of filenames) {
      const cardName = path.basename(filename, path.extname(filename));

      cards.push({
        id: currentId,
        name: cardName,
        path: normalizeToPublicPath(folder.publicBasePath, filename),
        type: folder.type
      });

      currentId += 1;
    }

    counts[folder.type] = filenames.length;
  }

  return { cards, counts };
}

function main() {
  const { cards, counts } = buildCards();

  console.log(`Heroes found: ${counts.hero}`);
  console.log(`MainHeroes found: ${counts.mainhero}`);
  console.log(`Monsters found: ${counts.monster}`);

  if (cards.length === 0) {
    console.error('No card images found in Heroes, MainHeroes, or Monsters folders.');
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(cards, null, 2), 'utf8');
  console.log(`cards.json generated with ${cards.length} cards.`);
}

main();
