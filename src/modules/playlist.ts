import type { Config } from "../config.js";
import { getCookieArgs } from "../config.js";
import {
  _spawnPromise,
  validateUrl
} from "./utils.js";

/**
 * Represents a single entry in a playlist (flat extraction)
 */
export interface PlaylistEntry {
  /** Video identifier */
  id?: string;
  /** Video title */
  title?: string;
  /** Video URL */
  url?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Uploader/channel name */
  uploader?: string;
}

/**
 * Response structure for playlist listing
 */
export interface PlaylistResponse {
  /** Title of the playlist */
  playlistTitle: string | null;
  /** Number of entries returned */
  entryCount: number;
  /** Array of playlist entries */
  entries: PlaylistEntry[];
}

/**
 * List entries in a playlist, channel, or video URL using yt-dlp's --flat-playlist option.
 * This extracts minimal metadata for each entry without downloading or fully probing each video,
 * making it significantly faster than full extraction.
 *
 * @param url - The URL of the playlist, channel, or video
 * @param limit - Maximum number of entries to return (maps to --playlist-end)
 * @param start - Starting index, 1-based (maps to --playlist-start)
 * @param includeMetadata - When true, include extended fields available in flat mode
 * @param config - Configuration object for cookie handling
 * @returns Promise resolving to JSON string with playlist entries
 * @throws {Error} When URL is invalid or extraction fails
 *
 * @example
 * ```typescript
 * const result = await listPlaylistEntries(
 *   'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
 *   10, 1, false, CONFIG
 * );
 * console.log(result);
 * ```
 */
export async function listPlaylistEntries(
  url: string,
  limit?: number,
  start?: number,
  includeMetadata?: boolean,
  _config?: Config
): Promise<string> {
  // Validate the URL
  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  const args = [
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--no-check-certificate",
  ];

  // Add playlist range options
  if (start !== undefined && start >= 1) {
    args.push("--playlist-start", String(start));
  }

  if (limit !== undefined && limit >= 1) {
    const end = (start !== undefined && start >= 1) ? start + limit - 1 : limit;
    args.push("--playlist-end", String(end));
  }

  // Add cookie arguments if configured
  if (_config) {
    args.push(...getCookieArgs(_config));
  }

  args.push(url);

  try {
    // Execute yt-dlp to get playlist entries
    const output = await _spawnPromise("yt-dlp", args);

    // Parse line-delimited JSON output
    const lines = output.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      const response: PlaylistResponse = {
        playlistTitle: null,
        entryCount: 0,
        entries: []
      };
      return JSON.stringify(response, null, 2);
    }

    let playlistTitle: string | null = null;
    const entries: PlaylistEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Extract playlist title from the first entry if available
        if (playlistTitle === null && entry.playlist_title) {
          playlistTitle = entry.playlist_title;
        }

        if (includeMetadata) {
          entries.push({
            id: entry.id || undefined,
            title: entry.title || undefined,
            url: entry.url || entry.webpage_url || undefined,
            duration: entry.duration || undefined,
            uploader: entry.uploader || entry.channel || undefined,
          });
        } else {
          entries.push({
            id: entry.id || undefined,
            title: entry.title || undefined,
            url: entry.url || entry.webpage_url || undefined,
            duration: entry.duration || undefined,
            uploader: entry.uploader || entry.channel || undefined,
          });
        }
      } catch {
        // Skip malformed JSON lines
        continue;
      }
    }

    const response: PlaylistResponse = {
      playlistTitle,
      entryCount: entries.length,
      entries
    };

    let result = JSON.stringify(response, null, 2);

    // Check character limit
    if (_config && result.length > _config.limits.characterLimit) {
      // Truncate entries to fit within limit
      while (result.length > _config.limits.characterLimit && response.entries.length > 1) {
        response.entries.pop();
        response.entryCount = response.entries.length;
        result = JSON.stringify(response, null, 2);
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("is not a valid URL") || errorMessage.includes("Unsupported URL")) {
      throw new Error("Unsupported URL or no playlist found at the given URL");
    }
    
    if (errorMessage.includes("Private playlist") || errorMessage.includes("private video")) {
      throw new Error("Playlist is private or unavailable. Configure cookies for authenticated access.");
    }

    throw new Error(`Failed to list playlist entries: ${errorMessage}`);
  }
}
