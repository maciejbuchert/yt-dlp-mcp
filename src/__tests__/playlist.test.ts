// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import { listPlaylistEntries } from '../modules/playlist.js';
import type { PlaylistResponse } from '../modules/playlist.js';
import { CONFIG } from '../config.js';

// Clear Python environment to avoid yt-dlp issues
delete process.env.PYTHONPATH;
delete process.env.PYTHONHOME;

// Integration tests require network access - opt-in via RUN_INTEGRATION_TESTS=1
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';

describe('Playlist Listing', () => {
  describe('listPlaylistEntries - validation', () => {
    test('should throw error for invalid URL', async () => {
      await expect(
        listPlaylistEntries('not-a-valid-url', undefined, undefined, false, CONFIG)
      ).rejects.toThrow('Invalid or unsupported URL format');
    });

    test('should throw error for empty string URL', async () => {
      await expect(
        listPlaylistEntries('', undefined, undefined, false, CONFIG)
      ).rejects.toThrow('Invalid or unsupported URL format');
    });
  });

  (RUN_INTEGRATION ? describe : describe.skip)('listPlaylistEntries - integration', () => {
    // Using a well-known public YouTube playlist
    const testPlaylistUrl = 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';

    test('should list entries from a playlist URL', async () => {
      const result = await listPlaylistEntries(
        testPlaylistUrl,
        5, undefined, false, CONFIG
      );
      const data: PlaylistResponse = JSON.parse(result);

      expect(data).toHaveProperty('playlistTitle');
      expect(data).toHaveProperty('entryCount');
      expect(data).toHaveProperty('entries');
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.entryCount).toBeGreaterThan(0);
      expect(data.entryCount).toBeLessThanOrEqual(5);

      // Check entry structure
      if (data.entries.length > 0) {
        const entry = data.entries[0];
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('title');
        expect(entry).toHaveProperty('url');
      }
    }, 60000);

    test('should handle limit parameter', async () => {
      const result = await listPlaylistEntries(
        testPlaylistUrl,
        2, undefined, false, CONFIG
      );
      const data: PlaylistResponse = JSON.parse(result);

      expect(data.entryCount).toBeLessThanOrEqual(2);
    }, 60000);

    test('should handle start parameter', async () => {
      const result = await listPlaylistEntries(
        testPlaylistUrl,
        2, 2, false, CONFIG
      );
      const data: PlaylistResponse = JSON.parse(result);

      expect(data.entryCount).toBeGreaterThan(0);
      expect(data.entryCount).toBeLessThanOrEqual(2);
    }, 60000);

    test('should handle single video URL gracefully', async () => {
      const result = await listPlaylistEntries(
        'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        undefined, undefined, false, CONFIG
      );
      const data: PlaylistResponse = JSON.parse(result);

      expect(data.entryCount).toBe(1);
      expect(data.entries[0]).toHaveProperty('id');
      expect(data.entries[0].id).toBe('jNQXAC9IVRw');
    }, 60000);

    test('should handle channel URL', async () => {
      const result = await listPlaylistEntries(
        'https://www.youtube.com/@jaboratory/videos',
        3, undefined, false, CONFIG
      );
      const data: PlaylistResponse = JSON.parse(result);

      expect(data.entryCount).toBeGreaterThan(0);
      expect(data.entryCount).toBeLessThanOrEqual(3);
    }, 60000);
  });
});
