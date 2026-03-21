#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
//#region src/constants.ts
const DEFAULT_ROOT_FOLDER_NAME = "chainFlow";
const CONFIG_FILE_NAME = ".chainflow.yaml";
const FLOWS_FOLDER_NAME = "flows";
const TASKS_FOLDER_NAME = "tasks";
//#endregion
//#region src/utils/fileIo.ts
/**
* Creates a folder at the specified path.
* If the folder already exists, it will not recreate it.
* @param folderPath - The path of the folder to create (must be a valid string).
*/
async function createFolder(folderPath) {
	if (typeof folderPath !== "string" || folderPath.trim() === "") throw new TypeError("Invalid folder path. It must be a non-empty string.");
	try {
		if (fs.existsSync(folderPath)) {
			console.log(`Folder already exists: ${folderPath}`);
			return {
				success: true,
				folderPath,
				alreadyExists: true
			};
		}
		fs.mkdirSync(folderPath, { recursive: true });
		return {
			success: true,
			folderPath,
			alreadyExists: false
		};
	} catch (error) {
		console.error(`Error creating folder at ${folderPath}:`, error);
		return {
			success: false,
			folderPath,
			alreadyExists: false
		};
	}
}
/**
* Writes a file using the content of a template file.
* If the destination file already exists, it will not overwrite it.
* @param templatePath - The path of the template file to read from.
* @param destinationPath - The path of the file to create.
*/
async function writeFile(targetPath, content) {
	if (typeof targetPath !== "string" || targetPath.trim() === "") throw new TypeError("Invalid destination path. It must be a non-empty string.");
	try {
		const destinationDir = path.dirname(targetPath);
		if (!fs.existsSync(destinationDir)) fs.mkdirSync(destinationDir, { recursive: true });
		fs.writeFileSync(targetPath, content, "utf8");
		return {
			success: true,
			targetPath,
			alreadyExists: false
		};
	} catch (error) {
		console.error(`Error writing file from template at ${targetPath}:`, error);
		if (error instanceof Error) throw new Error(`Failed to write file from template: ${error.message}`);
		else throw new Error("Failed to write file from template due to an unknown error.");
	}
}
//#endregion
//#region src/templates/config.yaml
var config_default = "defaultFlow: plan";
//#endregion
//#region src/commands/init.ts
async function init() {
	const currentDir = process.cwd();
	const mainFolderPath = path.join(currentDir, DEFAULT_ROOT_FOLDER_NAME);
	const configFilePath = path.join(mainFolderPath, CONFIG_FILE_NAME);
	console.log("Initializing project...");
	console.log(`- Creating main folder`);
	await createFolder(mainFolderPath);
	console.log(`- Adding config file`);
	await writeFile(configFilePath, config_default);
	console.log("- Adding tasks folder");
	await createFolder(path.join(mainFolderPath, TASKS_FOLDER_NAME));
	console.log("- Adding flows folder");
	await createFolder(path.join(mainFolderPath, FLOWS_FOLDER_NAME));
}
//#endregion
//#region src/index.ts
const program = new Command();
program.name("chain-flow").description("A CLI tool for managing agentic workflows").version("0.1.0");
program.command("init").description("Initialize chain-flow in the current directory").action(init);
program.parse();
//#endregion
export {};
