import { readdirSync } from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import type { Config } from "../config.js";
import { sanitizeFilename, getCookieArgs } from "../config.js";
import { _spawnPromise, validateUrl, getFormattedTimestamp, isYouTubeUrl } from "./utils.js";

/**
 * Downloads audio from a video URL in the best available quality.
 * 
 * @param url - The URL of the video to extract audio from
 * @param config - Configuration object for download settings
 * @returns Promise resolving to a success message with the downloaded file path
 * @throws {Error} When URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * // Download audio with default settings
 * const result = await downloadAudio('https://youtube.com/watch?v=...');
 * console.log(result);
 * 
 * // Download audio with custom config
 * const customResult = await downloadAudio('https://youtube.com/watch?v=...', {
 *   file: {
 *     downloadsDir: '/custom/path',
 *     // ... other config options
 *   }
 * });
 * console.log(customResult);
 * ```
 */
export async function downloadAudio(url: string, config: Config, outputFilename?: string): Promise<string> {
  const timestamp = getFormattedTimestamp();

  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  try {
    let outputTemplate: string;
    let sanitizedBase: string | undefined;
    if (outputFilename) {
      // Use the provided filename, ensuring it has no extension (yt-dlp adds it)
      const baseName = outputFilename.replace(/\.[^.]+$/, '');
      sanitizedBase = sanitizeFilename(baseName, config.file);
      outputTemplate = path.join(config.file.downloadsDir, sanitizedBase + '.%(ext)s');
    } else {
      outputTemplate = path.join(
        config.file.downloadsDir,
        sanitizeFilename(`%(title)s [%(id)s] ${timestamp}`, config.file) + '.%(ext)s'
      );
    }

    const format = isYouTubeUrl(url)
      ? "140/bestaudio[ext=m4a]/bestaudio"
      : "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio";

    await _spawnPromise("yt-dlp", [
      "--ignore-config",
      "--no-check-certificate",
      "--verbose",
      "--progress",
      "--newline",
      "--no-mtime",
      "-f", format,
      "--output", outputTemplate,
      ...getCookieArgs(config),
      url
    ]);

    const files = readdirSync(config.file.downloadsDir);
    let downloadedFile: string | undefined;
    if (sanitizedBase) {
      downloadedFile = files.find(file => file.startsWith(sanitizedBase));
    } else {
      downloadedFile = files.find(file => file.includes(timestamp));
    }
    if (!downloadedFile) {
      throw new Error("Download completed but file not found. Check Downloads folder permissions.");
    }
    const fullPath = path.join(config.file.downloadsDir, downloadedFile);
    const fileUrl = pathToFileURL(fullPath).href;
    return `Audio successfully downloaded as "${downloadedFile}" to ${config.file.downloadsDir}\nFile URL: ${fileUrl}`;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform.`);
      }
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      }
      if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error during audio extraction. Check your internet connection and retry.");
      }
    }
    throw error;
  }
} 
