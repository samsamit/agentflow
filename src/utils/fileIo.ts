import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Creates a file at the specified path with the given content.
 * If the file already exists, returns { alreadyExists: true } without overwriting.
 * Throws on invalid arguments or I/O failure.
 */
export function createFile(
  filePath: string,
  content: string = "",
): { filePath: string; alreadyExists: boolean } {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new TypeError("Invalid file path. It must be a non-empty string.");
  }
  if (typeof content !== "string") {
    throw new TypeError("Invalid content. It must be a string.");
  }

  if (fs.existsSync(filePath)) {
    return { filePath, alreadyExists: true };
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf8");
  return { filePath, alreadyExists: false };
}

/**
 * Creates a folder at the specified path.
 * If the folder already exists, returns { alreadyExists: true } without failing.
 * Throws on invalid arguments or I/O failure.
 */
export function createFolder(folderPath: string): { folderPath: string; alreadyExists: boolean } {
  if (typeof folderPath !== "string" || folderPath.trim() === "") {
    throw new TypeError("Invalid folder path. It must be a non-empty string.");
  }

  if (fs.existsSync(folderPath)) {
    return { folderPath, alreadyExists: true };
  }

  fs.mkdirSync(folderPath, { recursive: true });
  return { folderPath, alreadyExists: false };
}

/**
 * Writes content to a file, creating parent directories if necessary.
 * Throws on invalid arguments or I/O failure.
 */
export function writeFile(
  targetPath: string,
  content: string,
): { targetPath: string; alreadyExists: boolean } {
  if (typeof targetPath !== "string" || targetPath.trim() === "") {
    throw new TypeError("Invalid destination path. It must be a non-empty string.");
  }

  const destinationDir = path.dirname(targetPath);
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, content, "utf8");
  return { targetPath, alreadyExists: false };
}

/**
 * Reads and returns the content of a file as a UTF-8 string.
 * Throws if the file does not exist or cannot be read.
 */
export function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Returns true if the file (or directory) at the given path exists.
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Returns the names (not full paths) of all subdirectories in the given directory.
 * Throws if the directory does not exist.
 */
export function listDirs(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Copies a file from sourcePath to destPath.
 * Creates parent directories at destPath if needed.
 * Throws if the source file does not exist or copying fails.
 */
export function copyFile(sourcePath: string, destPath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(sourcePath, destPath);
}

/**
 * Recursively copies all files from sourceDir into destDir.
 * Creates destDir if it does not exist.
 * Entries whose names appear in `exclude` are skipped (top-level only).
 * Throws if sourceDir does not exist.
 */
export function copyDirRecursive(sourceDir: string, destDir: string, exclude: string[] = []): void {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
