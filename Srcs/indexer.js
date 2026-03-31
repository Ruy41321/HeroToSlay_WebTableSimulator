// ============================================================
// FILE: indexer.js
// ============================================================

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, '..');
const ASSETS_ROOT = path.join(REPOSITORY_ROOT, 'Assets');
const OUTPUT_FILE_PATH = path.join(PROJECT_ROOT, 'cards.json');
const BACKGROUNDS_OUTPUT_FILE_PATH = path.join(PROJECT_ROOT, 'public', 'backgrounds.json');
const ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const CARD_FOLDERS = [
  {
    type: 'MainHero',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'Heroes'),
    publicBasePath: '/Assets/Cards/Heroes'
  },
  {
    type: 'DeckCards',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'Deck'),
    publicBasePath: '/Assets/Cards/Deck'
  },
  {
    type: 'Monsters',
    absolutePath: path.join(ASSETS_ROOT, 'Cards', 'Monsters'),
    publicBasePath: '/Assets/Cards/Monsters'
  }
];

function normalizeToPublicPath(basePath, relativePath) {
  const joined = path.posix.join(basePath, relativePath);
  return joined.startsWith('/') ? joined : `/${joined}`;
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function walkImageFilesRecursive(folderPath, relativeRoot = '') {
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  const directoryEntries = fs.readdirSync(folderPath, { withFileTypes: true });
  const imagePaths = [];

  for (const entry of directoryEntries) {
    const absoluteEntryPath = path.join(folderPath, entry.name);
    const relativeEntryPath = relativeRoot ? path.join(relativeRoot, entry.name) : entry.name;

    if (entry.isDirectory()) {
      imagePaths.push(...walkImageFilesRecursive(absoluteEntryPath, relativeEntryPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!ACCEPTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    imagePaths.push(toPosixPath(relativeEntryPath));
  }

  return imagePaths.sort((a, b) => a.localeCompare(b));
}

function buildCards() {
  const cards = [];
  const counts = {
    MainHero: 0,
    DeckCards: 0,
    Monsters: 0
  };

  let currentId = 1;

  for (const folder of CARD_FOLDERS) {
    if (!fs.existsSync(folder.absolutePath)) {
      console.warn(`Skipped missing folder: ${folder.absolutePath}`);
      continue;
    }

    const relativeImagePaths = walkImageFilesRecursive(folder.absolutePath);

    if (relativeImagePaths.length === 0) {
      console.warn(`No supported images found in: ${folder.absolutePath}`);
    }

    for (const relativeImagePath of relativeImagePaths) {
      const cardName = path.basename(relativeImagePath, path.extname(relativeImagePath));

      cards.push({
        id: currentId,
        name: cardName,
        path: normalizeToPublicPath(folder.publicBasePath, relativeImagePath),
        type: folder.type
      });

      currentId += 1;
    }

    counts[folder.type] = relativeImagePaths.length;
  }

  return { cards, counts };
}

function buildBackgrounds() {
  const backgroundsFolderPath = path.join(ASSETS_ROOT, 'Miscellaneous');

  if (!fs.existsSync(backgroundsFolderPath)) {
    console.warn(`Skipped missing folder: ${backgroundsFolderPath}`);
    return [];
  }

  const relativeImagePaths = walkImageFilesRecursive(backgroundsFolderPath);

  if (relativeImagePaths.length === 0) {
    console.warn(`No supported background images found in: ${backgroundsFolderPath}`);
  }

  return relativeImagePaths.map((relativeImagePath) =>
    normalizeToPublicPath('/Assets/Miscellaneous', relativeImagePath)
  );
}

function main() {
  const { cards, counts } = buildCards();
  const backgrounds = buildBackgrounds();

  console.log(`MainHero found: ${counts.MainHero}`);
  console.log(`DeckCards found: ${counts.DeckCards}`);
  console.log(`Monsters found: ${counts.Monsters}`);

  if (cards.length === 0) {
    console.error('No card images found in Heroes, Deck, or Monsters folders.');
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(cards, null, 2), 'utf8');
  fs.writeFileSync(BACKGROUNDS_OUTPUT_FILE_PATH, JSON.stringify(backgrounds, null, 2), 'utf8');
  console.log(`cards.json generated with ${cards.length} cards.`);
  console.log(`backgrounds.json generated with ${backgrounds.length} backgrounds.`);
}

main();
