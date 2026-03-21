import * as fs from 'fs';
import * as path from 'path';
import { CONFIG_FILE_NAME, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME, TASKS_FOLDER_NAME } from '../constants.js';
import { createFile, createFolder, writeFile } from '../utils/fileIo.js';
import configTemplate from "../templates/config.yaml";

export async function init() {
    const currentDir = process.cwd();
    const mainFolderPath = path.join(currentDir, DEFAULT_ROOT_FOLDER_NAME);
    const configFilePath = path.join(mainFolderPath, CONFIG_FILE_NAME);

    console.log("Initializing project...");
    console.log(`- Creating main folder`);
    await createFolder(mainFolderPath);

    console.log(`- Adding config file`);
    await writeFile(
        configFilePath,
        configTemplate
    );

    console.log("- Adding tasks folder");
    await createFolder(path.join(mainFolderPath, TASKS_FOLDER_NAME));

    console.log("- Adding flows folder");
    await createFolder(path.join(mainFolderPath, FLOWS_FOLDER_NAME));
}