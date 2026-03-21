import * as fs from 'fs';
import * as path from 'path';
import type { Try } from '../types.js';

/**
 * Creates a file at the specified path with the given content.
 * If the file already exists, it will not overwrite it.
 * @param filePath - The path of the file to create (must be a valid string).
 * @param content - The content to write into the file (defaults to an empty string).
 */
export async function createFile(filePath: string, content: string = ''): Promise<Try<{ filePath: string, alreadyExists: boolean }>> {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
        throw new TypeError('Invalid file path. It must be a non-empty string.');
    }
    if (typeof content !== 'string') {
        throw new TypeError('Invalid content. It must be a string.');
    }

    try {
        // Check if the file already exists
        if (fs.existsSync(filePath)) {
            console.log(`File already exists: ${filePath}`);
            return { success: true, filePath, alreadyExists: true };
        }

        // Ensure the directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Create the file with the provided content
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, filePath, alreadyExists: false };
    } catch (error) {
        console.error(`Error creating file at ${filePath}:`, error);
        return { success: false, filePath, alreadyExists: false };
    }
}

/**
 * Creates a folder at the specified path.
 * If the folder already exists, it will not recreate it.
 * @param folderPath - The path of the folder to create (must be a valid string).
 */
export async function createFolder(folderPath: string): Promise<Try<{ folderPath: string, alreadyExists: boolean }>> {
    if (typeof folderPath !== 'string' || folderPath.trim() === '') {
        throw new TypeError('Invalid folder path. It must be a non-empty string.');
    }

    try {
        // Check if the folder already exists
        if (fs.existsSync(folderPath)) {
            console.log(`Folder already exists: ${folderPath}`);
            return { success: true, folderPath, alreadyExists: true };
        }

        // Create the folder
        fs.mkdirSync(folderPath, { recursive: true });
        return { success: true, folderPath, alreadyExists: false };
    } catch (error) {
        console.error(`Error creating folder at ${folderPath}:`, error);
        return { success: false, folderPath, alreadyExists: false };
    }
}

/**
 * Writes a file using the content of a template file.
 * If the destination file already exists, it will not overwrite it.
 * @param templatePath - The path of the template file to read from.
 * @param destinationPath - The path of the file to create.
 */
export async function writeFile(targetPath: string, content: string): Promise<Try<{ targetPath: string, alreadyExists: boolean }>> {
    if (typeof targetPath !== 'string' || targetPath.trim() === '') {
        throw new TypeError('Invalid destination path. It must be a non-empty string.');
    }

    try {

        // Ensure the directory for the destination file exists
        const destinationDir = path.dirname(targetPath);
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true });
        }

        // Write the content to the destination file
        fs.writeFileSync(targetPath, content, 'utf8');
        return { success: true, targetPath, alreadyExists: false };
    } catch (error) {
        console.error(`Error writing file from template at ${targetPath}:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to write file from template: ${error.message}`);
        } else {
            throw new Error('Failed to write file from template due to an unknown error.');
        }
    }
}