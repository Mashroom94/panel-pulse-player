import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const audioDirectory = fileURLToPath(new URL('../dist/audio/', import.meta.url));
const maximumHostedAssetSize = 5 * 1024 * 1024;

test('every bundled track is small enough to be served by static hosting', async () => {
  const filenames = (await readdir(audioDirectory)).filter(name => name.endsWith('.mp3'));
  assert.ok(filenames.length > 0, 'expected bundled MP3 tracks');

  for (const filename of filenames) {
    const file = await stat(join(audioDirectory, filename));
    assert.ok(
      file.size <= maximumHostedAssetSize,
      `${filename} is ${(file.size / 1024 / 1024).toFixed(2)} MiB`,
    );
  }
});

test('the public Molchat Doma tracks are bundled with the player', async () => {
  const filenames = await readdir(audioDirectory);
  const expectedTracks = [
    'molchat-doma-lyudi-nadoeli.mp3',
    'molchat-doma-sudno-boris-rizhiy.mp3',
    'molchat-doma-volny.mp3',
  ];

  for (const filename of expectedTracks) {
    assert.ok(filenames.includes(filename), `missing bundled track: ${filename}`);
  }
});
