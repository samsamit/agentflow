#!/usr/bin/env node
import { i as rootConfigSchema, n as flowConfigSchema, r as parseStepRef } from "./schema-hXWZ6LN9.mjs";
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { checkbox, select } from "@inquirer/prompts";
import * as os from "node:os";
//#region src/constants.ts
const DEFAULT_ROOT_FOLDER_NAME = "agentFlow";
const CONFIG_FILE_NAME = ".agentflow.yaml";
const FLOWS_FOLDER_NAME = "flows";
const TASKS_FOLDER_NAME = "tasks";
const TASK_STATE_FILE_NAME = ".taskState.yaml";
const INSTRUCTIONS_FOLDER_NAME = "instructions";
const SCHEMA_CDN_URL = `https://cdn.jsdelivr.net/npm/@samsamit/agentflow@latest/schema/agentflow-flow.schema.json`;
const SKILLS_FOLDER_NAME = "skills";
const SKILL_NAME = "agentflow";
const OPTIMIZE_SKILL_NAME = "agentflow-optimize";
const SKILL_FILE_NAME = "SKILL.md";
const AGENTS_FOLDER_NAME = "agents";
const AI_TOOL_ROOTS = {
	"claude-code": ".claude",
	cursor: ".cursor",
	windsurf: ".windsurf"
};
//#endregion
//#region src/utils/fileIo.ts
/**
* Creates a folder at the specified path.
* If the folder already exists, returns { alreadyExists: true } without failing.
* Throws on invalid arguments or I/O failure.
*/
function createFolder(folderPath) {
	if (typeof folderPath !== "string" || folderPath.trim() === "") throw new TypeError("Invalid folder path. It must be a non-empty string.");
	if (fs.existsSync(folderPath)) return {
		folderPath,
		alreadyExists: true
	};
	fs.mkdirSync(folderPath, { recursive: true });
	return {
		folderPath,
		alreadyExists: false
	};
}
/**
* Writes content to a file, creating parent directories if necessary.
* Throws on invalid arguments or I/O failure.
*/
function writeFile(targetPath, content) {
	if (typeof targetPath !== "string" || targetPath.trim() === "") throw new TypeError("Invalid destination path. It must be a non-empty string.");
	const destinationDir = path.dirname(targetPath);
	if (!fs.existsSync(destinationDir)) fs.mkdirSync(destinationDir, { recursive: true });
	fs.writeFileSync(targetPath, content, "utf8");
	return {
		targetPath,
		alreadyExists: false
	};
}
/**
* Reads and returns the content of a file as a UTF-8 string.
* Throws if the file does not exist or cannot be read.
*/
function readFile(filePath) {
	if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
	return fs.readFileSync(filePath, "utf8");
}
/**
* Returns true if the file (or directory) at the given path exists.
*/
function fileExists(filePath) {
	return fs.existsSync(filePath);
}
/**
* Returns the names (not full paths) of all subdirectories in the given directory.
* Throws if the directory does not exist.
*/
function listDirs(dirPath) {
	if (!fs.existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`);
	return fs.readdirSync(dirPath, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}
/**
* Recursively copies all files from sourceDir into destDir.
* Creates destDir if it does not exist.
* Entries whose names appear in `exclude` are skipped (top-level only).
* Throws if sourceDir does not exist.
*/
function copyDirRecursive(sourceDir, destDir, exclude = []) {
	if (!fs.existsSync(sourceDir)) throw new Error(`Source directory not found: ${sourceDir}`);
	if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
	const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
	for (const entry of entries) {
		if (exclude.includes(entry.name)) continue;
		const srcPath = path.join(sourceDir, entry.name);
		const dstPath = path.join(destDir, entry.name);
		if (entry.isDirectory()) copyDirRecursive(srcPath, dstPath);
		else fs.copyFileSync(srcPath, dstPath);
	}
}
//#endregion
//#region src/flow/loader.ts
/**
* Reads and parses the root config at agentFlow/.agentflow.yaml.
* Throws with a clear message if the file is missing or invalid.
*/
function loadRootConfig(projectRoot) {
	const configPath = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, CONFIG_FILE_NAME);
	if (!fileExists(configPath)) throw new Error(`Root config not found: ${configPath}\nRun: agentflow init`);
	const parsed = parse(readFile(configPath));
	const result = rootConfigSchema.safeParse(parsed);
	if (!result.success) {
		const messages = result.error.issues.map((i) => i.message).join("; ");
		throw new Error(`Root config is invalid: ${messages}`);
	}
	return result.data;
}
/**
* Reads and parses a flow config at agentFlow/flows/<name>/.agentflow.yaml.
* Throws with a clear message if the file is missing or the config is invalid.
*/
function loadFlow(projectRoot, flowName) {
	const flowPath = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME, flowName, CONFIG_FILE_NAME);
	if (!fileExists(flowPath)) throw new Error(`Flow "${flowName}" not found: ${flowPath}`);
	const parsed = parse(readFile(flowPath));
	const result = flowConfigSchema.safeParse(parsed);
	if (!result.success) {
		const messages = result.error.issues.map((i) => i.message).join("; ");
		throw new Error(`Flow "${flowName}" config is invalid: ${messages}`);
	}
	return result.data;
}
/**
* Returns the flow name to use: the provided option if given, otherwise
* reads the root config and returns defaultFlow.
*/
function resolveFlowName(projectRoot, flowOption) {
	if (flowOption !== void 0 && flowOption.trim() !== "") return flowOption;
	return loadRootConfig(projectRoot).defaultFlow;
}
/**
* Lists instruction file names (basename only) for a given flow.
* Returns an empty array if the instructions directory does not exist.
*/
function listInstructionFiles(projectRoot, flowName) {
	const instructionsDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME, flowName, INSTRUCTIONS_FOLDER_NAME);
	if (!fileExists(instructionsDir)) return [];
	try {
		return fs.readdirSync(instructionsDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
	} catch {
		return [];
	}
}
/**
* Lists all flow names found in agentFlow/flows/.
*/
function listFlowNames(projectRoot) {
	const flowsDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME);
	if (!fileExists(flowsDir)) return [];
	return listDirs(flowsDir);
}
//#endregion
//#region src/flow/validator.ts
/**
* Detects cycles in the requires graph using DFS with a recursion stack.
* Returns the cycle path as an array of step names, or null if no cycle.
*/
function detectCycle(stepName, requiresMap, visited, stack, path) {
	visited.add(stepName);
	stack.add(stepName);
	path.push(stepName);
	const deps = requiresMap.get(stepName) ?? [];
	for (const dep of deps) if (!visited.has(dep)) {
		const cycle = detectCycle(dep, requiresMap, visited, stack, path);
		if (cycle !== null) return cycle;
	} else if (stack.has(dep)) {
		const cycleStart = path.indexOf(dep);
		return path.slice(cycleStart);
	}
	stack.delete(stepName);
	path.pop();
	return null;
}
/**
* Validates a flow config. Pure — no filesystem access.
*
* @param flow - the parsed FlowConfig
* @param existingInstructionPaths - list of instruction file names that exist
*   on disk (relative to the flow's instructions/ folder). The caller is
*   responsible for listing the directory and passing the filenames here.
*/
function validateFlow(flow, existingInstructionPaths) {
	const errors = [];
	const stepNames = new Set(flow.steps.map((s) => s.name));
	const instructionSet = new Set(existingInstructionPaths);
	const requiresMap = /* @__PURE__ */ new Map();
	for (const step of flow.steps) requiresMap.set(step.name, step.requires ?? []);
	for (const step of flow.steps) {
		for (const dep of step.requires ?? []) if (!stepNames.has(dep)) errors.push(`Step "${step.name}" requires unknown step "${dep}".`);
		for (const ctxStepEntry of step.context.steps ?? []) {
			const { stepName: ctxStep, isRef } = parseStepRef(ctxStepEntry);
			if (!stepNames.has(ctxStep)) errors.push(`Step "${step.name}" references unknown step "${ctxStep}" in context.steps.`);
			else if (isRef) {
				if (flow.steps.find((s) => s.name === ctxStep)?.generates === void 0) errors.push(`Step "${step.name}" uses ":ref" for step "${ctxStep}" in context.steps, but that step has no "generates" field.`);
			}
		}
		for (const validatedEntry of step.validates ?? []) {
			const { stepName: validated, isRef } = parseStepRef(validatedEntry);
			if (!stepNames.has(validated)) errors.push(`Step "${step.name}" references unknown step "${validated}" in validates.`);
			else if (isRef) {
				if (flow.steps.find((s) => s.name === validated)?.generates === void 0) errors.push(`Step "${step.name}" uses ":ref" for step "${validated}" in validates, but that step has no "generates" field.`);
			}
		}
		if (!instructionSet.has(step.context.instructions)) errors.push(`Step "${step.name}" instruction file not found: "${step.context.instructions}".`);
	}
	const visited = /* @__PURE__ */ new Set();
	for (const step of flow.steps) if (!visited.has(step.name)) {
		const cycle = detectCycle(step.name, requiresMap, visited, /* @__PURE__ */ new Set(), []);
		if (cycle !== null) {
			errors.push(`Circular dependency detected in requires: ${cycle.join(" → ")}`);
			break;
		}
	}
	return {
		valid: errors.length === 0,
		errors
	};
}
/**
* Validates the whole project (root config validity + folder existence + all flows).
*/
function validateProject(rootValid, flowsFolderExists, tasksFolderExists, flows) {
	const errors = [];
	if (!rootValid) errors.push("Root config (.agentflow.yaml) is missing or invalid.");
	if (!flowsFolderExists) errors.push("flows/ folder is missing.");
	if (!tasksFolderExists) errors.push("tasks/ folder is missing.");
	for (const { flow, instructionPaths, loadError } of flows) {
		if (loadError !== void 0) {
			errors.push(`[flow: ${flow.name}] Failed to load: ${loadError}`);
			continue;
		}
		const result = validateFlow(flow, instructionPaths);
		if (!result.valid) for (const err of result.errors) errors.push(`[flow: ${flow.name}] ${err}`);
	}
	return {
		valid: errors.length === 0,
		errors
	};
}
//#endregion
//#region src/graph/index.ts
/**
* Pure graph functions for ChainFlow.
* No filesystem access, no process.cwd(). Fully testable with in-memory data.
*/
/**
* Maps each step name → its `requires` list.
*/
function buildDependencyGraph(steps) {
	const graph = /* @__PURE__ */ new Map();
	for (const step of steps) graph.set(step.name, step.requires ?? []);
	return graph;
}
/**
* Maps each step name → names of steps that depend on it (reverse edges).
*/
function buildReverseDependencyGraph(steps) {
	const graph = /* @__PURE__ */ new Map();
	for (const step of steps) {
		if (!graph.has(step.name)) graph.set(step.name, []);
		for (const req of step.requires ?? []) {
			const dependents = graph.get(req) ?? [];
			dependents.push(step.name);
			graph.set(req, dependents);
		}
	}
	return graph;
}
/**
* Returns names of steps currently in `ready` state.
*/
function resolveReadySteps(steps, taskStepStates) {
	return steps.filter((step) => taskStepStates[step.name]?.state === "ready").map((step) => step.name);
}
/**
* Returns names of `blocked` steps that should become `ready` after
* `completedStepName` is marked done (i.e. all their requires are now done).
*
* NOTE: The caller is responsible for having already updated the state of
* `completedStepName` to `done` before calling this, OR this function treats
* `completedStepName` as done for the purpose of its calculation.
*/
function resolveUnblockedSteps(steps, taskStepStates, completedStepName) {
	const result = [];
	for (const step of steps) {
		if (taskStepStates[step.name]?.state !== "blocked") continue;
		const requires = step.requires ?? [];
		if (requires.length === 0) continue;
		if (requires.every((req) => req === completedStepName || taskStepStates[req]?.state === "done")) result.push(step.name);
	}
	return result;
}
/**
* Returns names of all transitively dependent steps that should be reset to
* `ready` after `revisedStepName` is marked for revision.
* Does NOT include the revised step itself.
*/
function resolveTransitiveCascade(steps, _taskStepStates, revisedStepName) {
	const reverseGraph = buildReverseDependencyGraph(steps);
	const cascade = /* @__PURE__ */ new Set();
	const queue = [revisedStepName];
	while (queue.length > 0) {
		const current = queue.shift();
		if (current === void 0) break;
		for (const dependent of reverseGraph.get(current) ?? []) if (!cascade.has(dependent)) {
			cascade.add(dependent);
			queue.push(dependent);
		}
	}
	return [...cascade];
}
/**
* Returns true when all steps are in `done` state.
*/
function isTaskComplete(taskStepStates) {
	return Object.values(taskStepStates).every((s) => s.state === "done");
}
//#endregion
//#region src/output.ts
/**
* All stdout/stderr output for agentflow CLI.
* Every output function in this module writes directly to process.stdout or process.stderr.
* No console.log or console.error is used anywhere else in the codebase.
*/
function write(text) {
	process.stdout.write(`${text}\n`);
}
function writeErr(text) {
	process.stderr.write(`${text}\n`);
}
const c = {
	reset: "\x1B[0m",
	bold: "\x1B[1m",
	dim: "\x1B[2m",
	cyan: "\x1B[36m",
	blue: "\x1B[34m",
	green: "\x1B[32m",
	yellow: "\x1B[33m",
	magenta: "\x1B[35m",
	white: "\x1B[37m",
	gray: "\x1B[90m",
	brightCyan: "\x1B[96m",
	brightWhite: "\x1B[97m"
};
function styled(text, ...codes) {
	return `${codes.join("")}${text}${c.reset}`;
}
function banner() {
	const logo = [
		"                          __    ____              ",
		"  ____ _____ ____  ____  / /_  / __/ ____ _      __",
		" / __ `/ __ `/ _ \\/ __ \\/ __/ / /_  / __ \\ | /| / /",
		"/ /_/ / /_/ /  __/ / / / /_ / __/ / /_/ / |/ |/ / ",
		"\\__,_/\\__, /\\___/_/ /_/\\__//_/    \\____/|__/|__/  ",
		"     /____/                                        "
	];
	write("");
	for (const line of logo) write(styled(line, c.bold, c.brightCyan));
	write(styled("  agent-first workflow engine", c.dim, c.cyan));
	write("");
}
function initSection(title) {
	write("");
	write(styled(`  ${title}`, c.bold, c.brightWhite));
	write(styled(`  ${"─".repeat(44)}`, c.gray));
}
function initCreated(label) {
	write(`  ${styled("✓", c.green, c.bold)}  ${styled(label, c.white)}`);
}
function initSkipped(label) {
	write(`  ${styled("–", c.gray)}  ${styled(label, c.dim, c.gray)}`);
}
function initWarning(label) {
	write(`  ${styled("⚠", c.yellow, c.bold)}  ${styled(label, c.yellow)}`);
}
function initSuccess() {
	write("");
	write(styled("  ────────────────────────────────────────────────", c.gray));
	write(`  ${styled("✦", c.brightCyan, c.bold)}  ${styled("agentflow initialized successfully", c.bold, c.brightWhite)}`);
	write(`     ${styled("Next:", c.dim, c.gray)} ${styled("agentflow validate", c.cyan)}`);
	write(`     ${styled("Docs:", c.dim, c.gray)} ${styled("https://github.com/samsamit/agentflow#readme", c.dim, c.cyan)}`);
	write("");
}
function info(message) {
	write(message);
}
function taskStarted(taskName, flowName, activeSteps) {
	write(`Task started: ${taskName}`);
	write(`Flow: ${flowName}`);
	write(`Active steps: ${activeSteps.join(", ")}`);
	write("Run: agentflow next");
}
function taskComplete(taskName) {
	write(`Task complete: ${taskName}`);
	write("All steps are done.");
}
/** subagent: undefined = no subagent, true = generic, string = named */
function nextStep(stepName, subagent, taskName) {
	write(`Step: ${stepName}`);
	write("Status: ready");
	if (subagent === void 0) write(`Run: agentflow context --step ${stepName}`);
	else if (subagent === true) {
		write("Subagent: spawn a subagent");
		write(`Then run: agentflow context --step ${stepName} --task ${taskName}`);
	} else {
		write(`Subagent: spawn subagent "${subagent}"`);
		write(`Then run: agentflow context --step ${stepName} --task ${taskName}`);
	}
}
function nextParallel(steps, taskName) {
	if (!steps.some((s) => s.subagent !== void 0)) {
		write("Steps ready for parallel execution:");
		for (const step of steps) write(`- ${step.name}: run agentflow context --step ${step.name}`);
	} else {
		write("Steps ready for parallel execution. Spawn a subagent for each step below:");
		for (const step of steps) if (typeof step.subagent === "string") write(`- ${step.name}: spawn subagent "${step.subagent}", then run agentflow context --step ${step.name} --task ${taskName}`);
		else if (step.subagent === true) write(`- ${step.name}: spawn a subagent, then run agentflow context --step ${step.name} --task ${taskName}`);
		else write(`- ${step.name}: run agentflow context --step ${step.name}`);
		write("Run all subagents in parallel before proceeding.");
	}
}
function stepContext(content) {
	write(content);
}
function stepContextTokens(tokenCount) {
	write(`Tokens: ~${tokenCount}`);
}
function stepComplete(stepName, unblocked) {
	write(`Step complete: ${stepName}`);
	if (unblocked.length > 0) write(`Unblocked: ${unblocked.join(", ")}`);
	write("Run: agentflow next");
}
function stepRevised(stepName, revisionCount, maxRevisions, cascadedReady, cascadedBlocked) {
	write(`Step marked for revision: ${stepName} (revision ${revisionCount}/${maxRevisions})`);
	if (cascadedReady.length > 0) write(`Cascaded to ready: ${cascadedReady.join(", ")}`);
	if (cascadedBlocked.length > 0) write(`Cascaded to blocked: ${cascadedBlocked.join(", ")}`);
	write("Run: agentflow next");
}
function revisionIgnored(stepName, maxRevisions) {
	write(`Warning: Step "${stepName}" has reached the maximum number of revisions (${maxRevisions}/${maxRevisions}). Revision ignored.`);
	write("Run: agentflow next");
}
function taskState(args) {
	write(`Task: ${args.taskName}`);
	write(`Flow: ${args.flowName}`);
	write(`Active: ${args.active}`);
	write("");
	write("Steps:");
	for (const step of args.steps) {
		const namePad = step.name.padEnd(16);
		const statePad = step.state.padEnd(12);
		let detail = "";
		if (step.generates && step.generatePath) {
			const exists = step.fileExists ? "[exists]" : "[missing]";
			detail = `generates: ${step.generates} → ${step.generatePath} ${exists}`;
		} else if (step.requires && step.requires.length > 0) detail = `requires: ${step.requires.join(", ")}`;
		write(`${namePad}${statePad}${detail}`.trimEnd());
	}
}
function flowList(flows) {
	write("Flows:");
	for (const flow of flows) write(`${flow.name.padEnd(12)}${flow.description}`);
}
function taskList(tasks) {
	write("Tasks:");
	for (const task of tasks) write(`${task.name.padEnd(14)}${task.active ? "(active)    " : "            "}flow: ${task.flowName}    steps: ${task.doneSteps}/${task.totalSteps} done`);
}
function validationPassed(target) {
	write(`Validation passed: ${target}`);
}
function validationFailed(target, errors) {
	writeErr(`Validation failed: ${target}`);
	for (const err of errors) writeErr(`  - ${err}`);
}
function error(err) {
	if (err instanceof Error) writeErr(`Error: ${err.message}`);
	else writeErr(`Error: ${String(err)}`);
}
//#endregion
//#region src/task/schema.ts
const stepStateSchema = z.object({
	state: z.enum([
		"ready",
		"done",
		"blocked",
		"revision"
	]),
	revisionCount: z.number().int().nonnegative().optional(),
	revisedBy: z.string().optional()
});
const taskStateSchema = z.object({
	active: z.boolean(),
	flow: z.string(),
	steps: z.record(z.string(), stepStateSchema)
});
//#endregion
//#region src/task/io.ts
/**
* Reads and validates the .taskState.yaml from the given task directory.
* Throws if the file is missing or the content fails schema validation.
*/
function readTaskState(taskDir) {
	const filePath = path.join(taskDir, TASK_STATE_FILE_NAME);
	const parsed = parse(readFile(filePath));
	const result = taskStateSchema.safeParse(parsed);
	if (!result.success) {
		const messages = result.error.issues.map((i) => i.message).join("; ");
		throw new Error(`Task state is invalid at ${filePath}: ${messages}`);
	}
	return result.data;
}
/**
* Serializes the given TaskState to YAML and writes it to .taskState.yaml
* in the given task directory.
*/
function writeTaskState(taskDir, state) {
	writeFile(path.join(taskDir, TASK_STATE_FILE_NAME), stringify(state));
}
//#endregion
//#region src/task/resolver.ts
/**
* Finds the currently active task in agentFlow/tasks/.
* Throws if no task is active.
*/
function resolveActiveTask(projectRoot) {
	const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);
	if (!fileExists(tasksDir)) throw new Error("No active task found. Run: agentflow start --task <name>");
	const taskNames = listDirs(tasksDir);
	for (const name of taskNames) {
		const dir = path.join(tasksDir, name);
		try {
			const state = readTaskState(dir);
			if (state.active) return {
				name,
				dir,
				state
			};
		} catch {}
	}
	throw new Error("No active task found. Run: agentflow start --task <name>");
}
/**
* Returns the resolved task: the named task if provided, otherwise the active task.
* Throws if the named task does not exist or if no active task is found.
*/
function resolveTask(projectRoot, taskName) {
	if (taskName === void 0) return resolveActiveTask(projectRoot);
	const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);
	if (!fileExists(taskDir)) throw new Error(`Task "${taskName}" not found.`);
	return {
		name: taskName,
		dir: taskDir,
		state: readTaskState(taskDir)
	};
}
/**
* Sets the named task as active (active: true) and deactivates all other tasks.
* Throws if the named task does not exist.
*/
function setActiveTask(projectRoot, taskName) {
	const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);
	const taskNames = fileExists(tasksDir) ? listDirs(tasksDir) : [];
	for (const name of taskNames) {
		const dir = path.join(tasksDir, name);
		try {
			const state = readTaskState(dir);
			const shouldBeActive = name === taskName;
			if (state.active !== shouldBeActive) writeTaskState(dir, {
				...state,
				active: shouldBeActive
			});
		} catch {}
	}
}
//#endregion
//#region src/task/state.ts
/**
* Computes the initial step states for a new task.
* Steps with no `requires` (or an empty array) are `ready`.
* All others are `blocked`.
* Pure function — no filesystem access.
*/
function getInitialStepStates(steps) {
	const result = {};
	for (const step of steps) {
		const hasRequires = Array.isArray(step.requires) && step.requires.length > 0;
		result[step.name] = { state: hasRequires ? "blocked" : "ready" };
	}
	return result;
}
//#endregion
//#region src/commands/complete.ts
/**
* Core logic for completing a step.
* Throws on invalid state (step not found, step not completable, etc.).
*/
function completeCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { stepName, taskName } = args;
	const { state: taskState, dir: taskDir } = resolveTask(projectRoot, taskName);
	if (taskName !== void 0) setActiveTask(projectRoot, taskName);
	const flow = loadFlow(projectRoot, taskState.flow);
	if (!flow.steps.some((s) => s.name === stepName)) throw new Error(`Step "${stepName}" not found in flow "${taskState.flow}".`);
	const currentStepState = taskState.steps[stepName];
	if (currentStepState === void 0 || currentStepState.state !== "ready" && currentStepState.state !== "revision") {
		const currentState = currentStepState?.state ?? "unknown";
		throw new Error(`Step "${stepName}" is not in a completable state (current state: ${currentState}).`);
	}
	const doneStep = currentStepState.revisionCount !== void 0 ? {
		state: "done",
		revisionCount: currentStepState.revisionCount
	} : { state: "done" };
	const updatedSteps = {
		...taskState.steps,
		[stepName]: doneStep
	};
	const unblocked = resolveUnblockedSteps(flow.steps, updatedSteps, stepName);
	for (const name of unblocked) {
		const s = updatedSteps[name];
		if (s !== void 0) updatedSteps[name] = {
			...s,
			state: "ready"
		};
	}
	writeTaskState(taskDir, {
		...taskState,
		steps: updatedSteps
	});
	stepComplete(stepName, unblocked);
}
/**
* CLI command handler for `agentflow complete`.
* Parses args from commander, calls completeCommand, exits on error.
*/
async function completeCommandHandler(options) {
	try {
		completeCommand({
			stepName: options.step,
			...options.task !== void 0 && { taskName: options.task }
		});
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/context/assembler.ts
/**
* Assembles the full context string for a step.
* This is what gets injected directly into an AI agent prompt.
*/
function assembleContext(params) {
	const { stepName, taskName, flowName, projectRoot, flow, stepState, taskStepStates } = params;
	const step = flow.steps.find((s) => s.name === stepName);
	if (step === void 0) throw new Error(`Step "${stepName}" not found in flow "${flowName}".`);
	const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);
	const parts = [];
	parts.push(`Step: ${stepName}`);
	if (step.description !== void 0) parts.push(`Description: ${step.description}`);
	if (stepState.state === "revision" && stepState.revisedBy !== void 0) {
		const revisedBy = stepState.revisedBy;
		parts.push("");
		parts.push(`This step is being revised. It was marked for revision by step "${revisedBy}".`);
		if (step.generates !== void 0) {
			const prevFilePath = path.join(taskDir, step.generates);
			if (fs.existsSync(prevFilePath)) {
				const prevContent = fs.readFileSync(prevFilePath, "utf8");
				parts.push("");
				parts.push(`Previously generated output (${step.generates}):`);
				parts.push(prevContent);
			}
		}
		const revisedByStep = flow.steps.find((s) => s.name === revisedBy);
		if (revisedByStep?.generates !== void 0) {
			const reviewFilePath = path.join(taskDir, revisedByStep.generates);
			if (fs.existsSync(reviewFilePath)) {
				const reviewContent = fs.readFileSync(reviewFilePath, "utf8");
				parts.push("");
				parts.push(`Review feedback (${revisedByStep.generates}):`);
				parts.push(reviewContent);
			}
		}
		parts.push("");
		parts.push("Rework this step based on the review feedback above.");
	}
	const instrPath = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME, flowName, INSTRUCTIONS_FOLDER_NAME, step.context.instructions);
	if (fs.existsSync(instrPath)) {
		const instrContent = fs.readFileSync(instrPath, "utf8");
		parts.push("");
		parts.push(instrContent);
	}
	if (step.context.references !== void 0) for (const refPath of step.context.references) {
		const absRefPath = path.join(projectRoot, refPath);
		if (fs.existsSync(absRefPath)) {
			const refContent = fs.readFileSync(absRefPath, "utf8");
			parts.push("");
			parts.push(`Reference (${refPath}):`);
			parts.push(refContent);
		}
	}
	const validatesStepNames = new Set((step.validates ?? []).map((e) => parseStepRef(e).stepName));
	if (step.context.steps !== void 0) for (const contextStepEntry of step.context.steps) {
		const { stepName: contextStepName, isRef } = parseStepRef(contextStepEntry);
		if (validatesStepNames.has(contextStepName)) continue;
		const contextStep = flow.steps.find((s) => s.name === contextStepName);
		const contextStepState = taskStepStates[contextStepName];
		if (contextStepState === void 0 || contextStep === void 0) continue;
		if (contextStepState.state === "done") {
			if (contextStep.generates !== void 0) {
				const genFilePath = path.join(taskDir, contextStep.generates);
				if (!fs.existsSync(genFilePath)) throw new Error(`Generated file for step "${contextStepName}" not found: ${genFilePath}`);
				parts.push("");
				if (isRef) {
					const refPath = [
						DEFAULT_ROOT_FOLDER_NAME,
						TASKS_FOLDER_NAME,
						taskName,
						contextStep.generates
					].join("/");
					parts.push(`Reference step "${contextStepName}" output at: ${refPath} — read this file before proceeding.`);
				} else {
					const genContent = fs.readFileSync(genFilePath, "utf8");
					parts.push(`Output from step "${contextStepName}" (${contextStep.generates}):`);
					parts.push(genContent);
				}
			}
		} else if (contextStep.required === false) {
			parts.push("");
			parts.push(`Note: Optional step "${contextStepName}" was not completed — skipping context injection.`);
		}
	}
	const hasValidates = step.validates !== void 0 && step.validates.length > 0;
	if (hasValidates && step.validates !== void 0) {
		parts.push("");
		parts.push("--- Steps to evaluate ---");
		for (const validatedStepEntry of step.validates) {
			const { stepName: validatedStepName, isRef } = parseStepRef(validatedStepEntry);
			const validatedStep = flow.steps.find((s) => s.name === validatedStepName);
			if (validatedStep?.generates === void 0) continue;
			const genFilePath = path.join(taskDir, validatedStep.generates);
			if (fs.existsSync(genFilePath)) {
				parts.push("");
				if (isRef) {
					const refPath = [
						DEFAULT_ROOT_FOLDER_NAME,
						TASKS_FOLDER_NAME,
						taskName,
						validatedStep.generates
					].join("/");
					parts.push(`Evaluate step "${validatedStepName}": read the output at ${refPath} before making your pass/fail decision.`);
				} else {
					const genContent = fs.readFileSync(genFilePath, "utf8");
					parts.push(`Step "${validatedStepName}" output (${validatedStep.generates}):`);
					parts.push(genContent);
				}
			}
		}
	}
	if (step.generates !== void 0) {
		const genPath = path.join(taskDir, step.generates);
		const fileExists = fs.existsSync(genPath);
		const strategy = step.generateStrategy ?? "replace";
		parts.push("");
		parts.push(`This step must generate the file: ${[
			DEFAULT_ROOT_FOLDER_NAME,
			TASKS_FOLDER_NAME,
			taskName,
			step.generates
		].join("/")}`);
		if (strategy === "replace") if (fileExists) parts.push("Strategy: An existing version exists. Replace it entirely.");
		else parts.push("Strategy: Create this file.");
		else if (strategy === "update") if (fileExists) parts.push("Strategy: An existing version exists. Update it in place.");
		else parts.push("Strategy: Create this file.");
		else if (strategy === "version") if (fileExists) {
			const revCount = stepState.revisionCount ?? 0;
			const dotIndex = step.generates.lastIndexOf(".");
			let versionedName;
			if (dotIndex === -1) versionedName = `${step.generates}.v${revCount}`;
			else versionedName = `${step.generates.slice(0, dotIndex)}.v${revCount}${step.generates.slice(dotIndex)}`;
			parts.push(`Strategy: An existing version exists. Rename it to ${versionedName} before writing the new version.`);
		} else parts.push("Strategy: Create this file.");
	}
	if (hasValidates && step.validates !== void 0) {
		parts.push("");
		parts.push("Evaluate each of the above steps and decide pass or fail.");
		parts.push(`First run: \`agentflow complete --step ${stepName} --task ${taskName}\``);
		parts.push(`Then, for each step that fails, run: \`agentflow revise --step <name> --from ${stepName} --task ${taskName}\``);
	} else {
		parts.push("");
		parts.push(`When this step is complete, run: \`agentflow complete --step ${stepName} --task ${taskName}\``);
	}
	return parts.join("\n");
}
//#endregion
//#region src/commands/context.ts
/**
* Core logic for `agentflow context --step <name> [--task <name>]`.
* Assembles and outputs full context for the given step.
*/
function contextCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { name: taskName, state: taskState } = resolveTask(projectRoot, args.taskName);
	if (args.taskName !== void 0) setActiveTask(projectRoot, args.taskName);
	const flow = loadFlow(projectRoot, taskState.flow);
	const stepState = taskState.steps[args.stepName];
	if (stepState === void 0) throw new Error(`Step "${args.stepName}" not found in task "${taskName}".`);
	const content = assembleContext({
		stepName: args.stepName,
		taskName,
		flowName: taskState.flow,
		projectRoot,
		flow,
		stepState,
		taskStepStates: taskState.steps
	});
	if (args.tokens === true) stepContextTokens(Math.ceil(content.length / 4));
	else stepContext(content);
}
/**
* CLI handler for `agentflow context`.
*/
async function contextCommandHandler(options) {
	try {
		contextCommand({
			stepName: options.step,
			...options.task !== void 0 && { taskName: options.task },
			...options.tokens === true && { tokens: true }
		});
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/ide/claude-code.ts
const AGENTFLOW_PERMISSIONS = ["Bash(npx agentflow:*)", "Bash(agentflow:*)"];
/**
* Merges agentflow Bash permission rules into ~/.claude/settings.json.
* Creates the file if it doesn't exist. Skips rules already present.
* Returns the absolute path of the settings file written.
*/
function writeClaudeCodePermissions() {
	const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
	let settings = {};
	if (fs.existsSync(settingsPath)) try {
		settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch {
		settings = {};
	}
	if (typeof settings.permissions !== "object" || settings.permissions === null) settings.permissions = {};
	const permissions = settings.permissions;
	if (!Array.isArray(permissions.allow)) permissions.allow = [];
	const allow = permissions.allow;
	for (const rule of AGENTFLOW_PERMISSIONS) if (!allow.includes(rule)) allow.push(rule);
	const dir = path.dirname(settingsPath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
	return settingsPath;
}
//#endregion
//#region src/ide/jetbrains.ts
/**
* Writes .idea/jsonSchemas.xml with a schema mapping for agentflow flow configs.
* Creates the .idea directory if it does not exist.
* Returns the absolute path to the XML file.
*/
function writeJetBrainsSchema(projectRoot, schemaRelativePath) {
	const ideaDir = path.join(projectRoot, ".idea");
	const xmlPath = path.join(ideaDir, "jsonSchemas.xml");
	if (!fs.existsSync(ideaDir)) fs.mkdirSync(ideaDir, { recursive: true });
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="JsonSchemaMappingsProjectConfiguration">
    <state>
      <map>
        <entry key="agentflow-flow">
          <value>
            <SchemaInfo>
              <option name="name" value="agentflow-flow" />
              <option name="relativePathToSchema" value="${schemaRelativePath.replace(/\\/g, "/")}" />
              <option name="patterns">
                <list>
                  <Item value="agentFlow/flows/*/.agentflow.yaml" />
                </list>
              </option>
            </SchemaInfo>
          </value>
        </entry>
      </map>
    </state>
  </component>
</project>
`;
	fs.writeFileSync(xmlPath, xml, "utf8");
	return xmlPath;
}
//#endregion
//#region src/ide/vscode.ts
/**
* Merges a yaml.schemas entry into .vscode/settings.json for the VS Code YAML extension.
* Creates the file (and parent directory) if it does not exist.
* Returns the absolute path to the settings file.
*/
function writeVsCodeSettings(projectRoot, schemaRelativePath) {
	const settingsPath = path.join(projectRoot, ".vscode", "settings.json");
	const settingsDir = path.dirname(settingsPath);
	if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
	let existing = {};
	if (fs.existsSync(settingsPath)) try {
		existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch {
		existing = {};
	}
	const yamlSchemas = { [schemaRelativePath]: ["agentFlow/flows/*/.agentflow.yaml"] };
	const updated = {
		...existing,
		"yaml.schemas": {
			...existing["yaml.schemas"],
			...yamlSchemas
		}
	};
	fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
	return settingsPath;
}
//#endregion
//#region src/ide/zed.ts
/**
* Merges a file_associations entry into .zed/settings.json for the Zed editor.
* Creates the file (and parent directory) if it does not exist.
* Returns the absolute path to the settings file.
*/
function writeZedSettings(projectRoot, schemaRelativePath) {
	const settingsPath = path.join(projectRoot, ".zed", "settings.json");
	const settingsDir = path.dirname(settingsPath);
	if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
	let existing = {};
	if (fs.existsSync(settingsPath)) try {
		existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
	} catch {
		existing = {};
	}
	const pattern = "**/agentFlow/flows/*/.agentflow.yaml";
	const schemaPathForZed = schemaRelativePath.replace(/\\/g, "/");
	const fileAssociations = { [pattern]: schemaPathForZed };
	const updated = {
		...existing,
		file_associations: {
			...existing.file_associations,
			...fileAssociations
		}
	};
	fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf8");
	return settingsPath;
}
//#endregion
//#region src/templates/config.yaml
var config_default = "defaultFlow: plan";
//#endregion
//#region src/commands/init.ts
/** Resolves the absolute path to the bundled flows directory (flows/ at package root). */
function getBundledFlowsDir() {
	const __filename = fileURLToPath(import.meta.url);
	const candidates = [path.resolve(path.dirname(__filename), "..", "flows"), path.resolve(path.dirname(__filename), "..", "..", "flows")];
	for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
	info("  Warning: Bundled flows directory not found — skipping flow copy.");
	return "";
}
/** Resolves the absolute path to a bundled skill file (skills/<skillName>/SKILL.md at package root). */
function getBundledSkillFile(skillName) {
	const __filename = fileURLToPath(import.meta.url);
	const candidates = [path.resolve(path.dirname(__filename), "..", SKILLS_FOLDER_NAME, skillName, SKILL_FILE_NAME), path.resolve(path.dirname(__filename), "..", "..", SKILLS_FOLDER_NAME, skillName, SKILL_FILE_NAME)];
	for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
	return candidates[candidates.length - 1] ?? "";
}
function copySkill(skillName, currentDir, toolRoot) {
	const bundledSkillFile = getBundledSkillFile(skillName);
	if (fileExists(bundledSkillFile)) {
		const skillDestDir = path.join(currentDir, toolRoot, SKILLS_FOLDER_NAME, skillName);
		const skillDestPath = path.join(skillDestDir, SKILL_FILE_NAME);
		createFolder(skillDestDir);
		fs.copyFileSync(bundledSkillFile, skillDestPath);
		initCreated(path.relative(currentDir, skillDestPath));
	} else initWarning(`Bundled skill file for "${skillName}" not found — skipping`);
}
async function init() {
	try {
		const currentDir = process.cwd();
		const mainFolderPath = path.join(currentDir, DEFAULT_ROOT_FOLDER_NAME);
		const configFilePath = path.join(mainFolderPath, CONFIG_FILE_NAME);
		banner();
		initSection("Setting up project structure");
		createFolder(mainFolderPath);
		initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/`);
		writeFile(configFilePath, config_default);
		initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${CONFIG_FILE_NAME}`);
		createFolder(path.join(mainFolderPath, TASKS_FOLDER_NAME));
		initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${TASKS_FOLDER_NAME}/`);
		createFolder(path.join(mainFolderPath, FLOWS_FOLDER_NAME));
		initCreated(`${DEFAULT_ROOT_FOLDER_NAME}/${FLOWS_FOLDER_NAME}/`);
		let selectedFlows = [];
		const bundledFlowsDir = getBundledFlowsDir();
		if (bundledFlowsDir !== "" && fileExists(bundledFlowsDir)) {
			const bundledFlowNames = listDirs(bundledFlowsDir);
			if (bundledFlowNames.length > 0) {
				initSection("Bundled flows");
				selectedFlows = await checkbox({
					message: "Select flows to copy into your project:",
					choices: bundledFlowNames.map((name) => ({
						name,
						value: name,
						checked: true
					}))
				});
				if (selectedFlows.length > 0) for (const flowName of selectedFlows) {
					copyDirRecursive(path.join(bundledFlowsDir, flowName), path.join(mainFolderPath, FLOWS_FOLDER_NAME, flowName), [AGENTS_FOLDER_NAME]);
					initCreated(`flows/${flowName}/`);
				}
				else initSkipped("No flows selected");
			}
		}
		initSection("IDE integration");
		const ideChoice = await select({
			message: "Select your IDE for YAML schema support:",
			choices: [
				{
					name: "VS Code",
					value: "vscode"
				},
				{
					name: "JetBrains (IntelliJ, WebStorm, etc.)",
					value: "jetbrains"
				},
				{
					name: "Zed",
					value: "zed"
				},
				{
					name: "None / skip",
					value: "none"
				}
			]
		});
		if (ideChoice === "vscode") {
			const settingsPath = writeVsCodeSettings(currentDir, SCHEMA_CDN_URL);
			initCreated(path.relative(currentDir, settingsPath));
		} else if (ideChoice === "jetbrains") {
			const xmlPath = writeJetBrainsSchema(currentDir, SCHEMA_CDN_URL);
			initCreated(path.relative(currentDir, xmlPath));
		} else if (ideChoice === "zed") {
			const settingsPath = writeZedSettings(currentDir, SCHEMA_CDN_URL);
			initCreated(path.relative(currentDir, settingsPath));
		} else initSkipped("IDE configuration skipped");
		initSection("AI tool integration");
		const aiToolChoice = await select({
			message: "Select your AI tool to inject the agentflow skill:",
			choices: [
				{
					name: "Claude Code",
					value: "claude-code"
				},
				{
					name: "Cursor",
					value: "cursor"
				},
				{
					name: "Windsurf",
					value: "windsurf"
				},
				{
					name: "None / skip",
					value: "none"
				}
			]
		});
		if (aiToolChoice !== "none") {
			const toolRoot = AI_TOOL_ROOTS[aiToolChoice];
			if (toolRoot !== void 0) {
				copySkill(SKILL_NAME, currentDir, toolRoot);
				copySkill(OPTIMIZE_SKILL_NAME, currentDir, toolRoot);
				if (aiToolChoice === "claude-code") initCreated(`${writeClaudeCodePermissions()} (permissions)`);
				if (selectedFlows.length > 0 && bundledFlowsDir !== "") {
					const agentsDestDir = path.join(currentDir, toolRoot, AGENTS_FOLDER_NAME);
					for (const flowName of selectedFlows) {
						const agentsSrcDir = path.join(bundledFlowsDir, flowName, AGENTS_FOLDER_NAME);
						if (fileExists(agentsSrcDir)) {
							createFolder(agentsDestDir);
							for (const agentFile of fs.readdirSync(agentsSrcDir)) {
								const agentSrc = path.join(agentsSrcDir, agentFile);
								const agentDest = path.join(agentsDestDir, agentFile);
								fs.copyFileSync(agentSrc, agentDest);
								initCreated(path.relative(currentDir, agentDest));
							}
						}
					}
				}
			}
		} else initSkipped("AI tool integration skipped");
		initSuccess();
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/list.ts
/**
* Lists all flows in the project and prints them.
* Exits cleanly with a message if no flows exist.
*/
function listFlowsCommand(args = {}) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const flowNames = listFlowNames(projectRoot);
	if (flowNames.length === 0) {
		info("No flows found. Add a flow config under agentFlow/flows/.");
		return;
	}
	const flows = [];
	for (const name of flowNames) try {
		const flow = loadFlow(projectRoot, name);
		flows.push({
			name: flow.name,
			description: flow.description ?? ""
		});
	} catch {
		flows.push({
			name,
			description: "(invalid config)"
		});
	}
	flowList(flows);
}
/**
* Lists all tasks in the project and prints their status.
* Exits cleanly with a message if no tasks exist.
*/
function listTasksCommand(args = {}) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const tasksDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME);
	if (!fileExists(tasksDir)) {
		info("No tasks found. Run: agentflow start --task <name>");
		return;
	}
	const taskNames = listDirs(tasksDir);
	if (taskNames.length === 0) {
		info("No tasks found. Run: agentflow start --task <name>");
		return;
	}
	const tasks = [];
	for (const name of taskNames) {
		const taskDir = path.join(tasksDir, name);
		try {
			const state = readTaskState(taskDir);
			const totalSteps = Object.keys(state.steps).length;
			const doneSteps = Object.values(state.steps).filter((s) => s.state === "done").length;
			tasks.push({
				name,
				active: state.active,
				flowName: state.flow,
				doneSteps,
				totalSteps
			});
		} catch {}
	}
	if (tasks.length === 0) {
		info("No tasks found. Run: agentflow start --task <name>");
		return;
	}
	taskList(tasks);
}
/**
* CLI command handler for `agentflow list flows`.
*/
async function listFlowsCommandHandler() {
	try {
		listFlowsCommand();
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
/**
* CLI command handler for `agentflow list tasks`.
*/
async function listTasksCommandHandler() {
	try {
		listTasksCommand();
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/next.ts
/**
* Core logic for the `agentflow next` command.
* Determines the next step(s) to work on and outputs them.
* Throws on invalid state.
*/
function nextCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { name: taskName, state: taskState } = resolveTask(projectRoot, args.taskName);
	if (args.taskName !== void 0) setActiveTask(projectRoot, args.taskName);
	const flow = loadFlow(projectRoot, taskState.flow);
	if (isTaskComplete(taskState.steps)) {
		taskComplete(taskName);
		return;
	}
	const readyStepNames = resolveReadySteps(flow.steps, taskState.steps);
	if (readyStepNames.length === 0) throw new Error(`No ready steps found for task "${taskName}".`);
	if (args.parallel) nextParallel(readyStepNames.map((name) => {
		const stepConfig = flow.steps.find((s) => s.name === name);
		const subagent = stepConfig?.subagent === false ? void 0 : stepConfig?.subagent;
		return subagent !== void 0 ? {
			name,
			subagent
		} : { name };
	}), taskName);
	else {
		const firstStepName = readyStepNames[0];
		if (firstStepName === void 0) throw new Error(`No ready steps found for task "${taskName}".`);
		const stepConfig = flow.steps.find((s) => s.name === firstStepName);
		nextStep(firstStepName, stepConfig?.subagent === false ? void 0 : stepConfig?.subagent, taskName);
	}
}
/**
* CLI command handler for `agentflow next`.
* Parses args from commander, calls nextCommand, exits on error.
*/
async function nextCommandHandler(options) {
	try {
		nextCommand({
			...options.task !== void 0 && { taskName: options.task },
			...options.parallel !== void 0 && { parallel: options.parallel }
		});
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/revise.ts
/**
* Core logic for marking a step for revision.
* Throws on invalid state (step not found, etc.).
* If maxRevisions is reached, outputs a warning and returns without changing state.
*/
function reviseCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { stepName, fromStep, taskName } = args;
	const { state: taskState, dir: taskDir } = resolveTask(projectRoot, taskName);
	if (taskName !== void 0) setActiveTask(projectRoot, taskName);
	const flow = loadFlow(projectRoot, taskState.flow);
	if (!flow.steps.some((s) => s.name === stepName)) throw new Error(`Step "${stepName}" not found in flow "${taskState.flow}".`);
	const currentStepState = taskState.steps[stepName] ?? { state: "done" };
	const newRevisionCount = (currentStepState.revisionCount ?? 0) + 1;
	const maxRevisions = flow.maxRevisions;
	if (maxRevisions !== void 0 && newRevisionCount > maxRevisions) {
		revisionIgnored(stepName, maxRevisions);
		return;
	}
	const updatedSteps = {
		...taskState.steps,
		[stepName]: {
			...currentStepState,
			state: "revision",
			revisionCount: newRevisionCount,
			revisedBy: fromStep
		}
	};
	const cascaded = resolveTransitiveCascade(flow.steps, updatedSteps, stepName);
	const depGraph = buildDependencyGraph(flow.steps);
	const cascadedReady = [];
	const cascadedBlocked = [];
	for (const name of cascaded) {
		const s = updatedSteps[name];
		const newState = (depGraph.get(name) ?? []).every((dep) => updatedSteps[dep]?.state === "done") ? "ready" : "blocked";
		if (s !== void 0) {
			const { revisedBy: _revisedBy, ...rest } = s;
			updatedSteps[name] = {
				...rest,
				state: newState
			};
		} else updatedSteps[name] = { state: newState };
		if (newState === "ready") cascadedReady.push(name);
		else cascadedBlocked.push(name);
	}
	writeTaskState(taskDir, {
		...taskState,
		steps: updatedSteps
	});
	stepRevised(stepName, newRevisionCount, maxRevisions ?? 0, cascadedReady, cascadedBlocked);
}
/**
* CLI command handler for `agentflow revise`.
* Parses args from commander, calls reviseCommand, exits on error.
*/
async function reviseCommandHandler(options) {
	try {
		reviseCommand({
			stepName: options.step,
			fromStep: options.from,
			...options.task !== void 0 && { taskName: options.task }
		});
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/start.ts
/**
* Core logic for starting a new task.
* Throws on invalid state (task already exists, flow not found, etc.).
*/
function startCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { taskName } = args;
	const taskDir = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName);
	if (fileExists(taskDir)) throw new Error(`Task "${taskName}" already exists.`);
	const flowName = resolveFlowName(projectRoot, args.flowName);
	const initialSteps = getInitialStepStates(loadFlow(projectRoot, flowName).steps);
	const taskState = {
		active: true,
		flow: flowName,
		steps: initialSteps
	};
	createFolder(taskDir);
	writeTaskState(taskDir, taskState);
	setActiveTask(projectRoot, taskName);
	taskStarted(taskName, flowName, Object.entries(initialSteps).filter(([, s]) => s.state === "ready").map(([name]) => name));
}
/**
* CLI command handler for `agentflow start`.
* Parses args from commander, calls startCommand, exits on error.
*/
async function startCommandHandler(options) {
	try {
		startCommand({
			taskName: options.task,
			...options.flow !== void 0 && { flowName: options.flow }
		});
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/state.ts
/**
* Core logic for the `state` command.
* Resolves the task (active or named), loads its flow config,
* and prints each step's status with generates/requires details.
* Throws on error.
*/
function stateCommand(args) {
	const projectRoot = args.projectRoot ?? process.cwd();
	const { name: taskName, state: taskState$1 } = resolveTask(projectRoot, args.taskName);
	if (args.taskName !== void 0) setActiveTask(projectRoot, args.taskName);
	const steps = loadFlow(projectRoot, taskState$1.flow).steps.map((stepConfig) => {
		const state = taskState$1.steps[stepConfig.name]?.state ?? "blocked";
		const entry = {
			name: stepConfig.name,
			state
		};
		if (stepConfig.generates) {
			const generatePath = path.join(TASKS_FOLDER_NAME, taskName, stepConfig.generates);
			const absoluteGeneratePath = path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME, taskName, stepConfig.generates);
			entry.generates = stepConfig.generates;
			entry.generatePath = generatePath;
			entry.fileExists = fileExists(absoluteGeneratePath);
		} else if (state === "blocked") entry.requires = stepConfig.requires ?? [];
		return entry;
	});
	taskState({
		taskName,
		flowName: taskState$1.flow,
		active: taskState$1.active,
		steps
	});
}
/**
* CLI command handler for `agentflow state`.
*/
async function stateCommandHandler(options) {
	try {
		stateCommand({ ...options.task !== void 0 && { taskName: options.task } });
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/commands/validate.ts
async function validateCommand(options) {
	const projectRoot = process.cwd();
	try {
		if (options.flow !== void 0) {
			const flowName = options.flow;
			const result = validateFlow(loadFlow(projectRoot, flowName), listInstructionFiles(projectRoot, flowName));
			if (result.valid) validationPassed(`flow: ${flowName}`);
			else {
				validationFailed(`flow: ${flowName}`, result.errors);
				process.exit(1);
			}
		} else {
			let rootValid = true;
			try {
				loadRootConfig(projectRoot);
			} catch {
				rootValid = false;
			}
			const flowsFolderExists = fileExists(path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, FLOWS_FOLDER_NAME));
			const tasksFolderExists = fileExists(path.join(projectRoot, DEFAULT_ROOT_FOLDER_NAME, TASKS_FOLDER_NAME));
			const flowNames = listFlowNames(projectRoot);
			const flows = [];
			for (const flowName of flowNames) try {
				const flow = loadFlow(projectRoot, flowName);
				const instructionPaths = listInstructionFiles(projectRoot, flowName);
				flows.push({
					flow,
					instructionPaths
				});
			} catch (err) {
				flows.push({
					flow: {
						name: flowName,
						steps: []
					},
					instructionPaths: [],
					loadError: err instanceof Error ? err.message : String(err)
				});
			}
			const result = validateProject(rootValid, flowsFolderExists, tasksFolderExists, flows);
			if (result.valid) validationPassed("project");
			else {
				validationFailed("project", result.errors);
				process.exit(1);
			}
		}
	} catch (err) {
		error(err);
		process.exit(1);
	}
}
//#endregion
//#region src/index.ts
const program = new Command();
program.name("agentflow").description("A CLI tool for managing agentic workflows").version("1.0.0");
program.command("init").description("Initialize agentflow in the current directory").action(init);
program.command("validate").description("Validate project config and flows").option("--flow <name>", "validate a single flow by name").action((options) => validateCommand(options));
program.command("start").description("Create a new task and set it as active").requiredOption("--task <name>", "task name").option("--flow <name>", "flow name (defaults to defaultFlow)").action((options) => startCommandHandler(options));
program.command("next").description("Get the next step(s) to work on").option("--task <name>", "task name (sets as active if given)").option("--parallel", "return all currently ready steps").action((options) => nextCommandHandler(options));
program.command("context").description("Output full context for a step to inject into an agent prompt").requiredOption("--step <name>", "step name").option("--task <name>", "task name (sets as active if given)").option("--tokens", "output estimated token count instead of full context").action((options) => contextCommandHandler(options));
program.command("state").description("Show the current state of all steps in a task").option("--task <name>", "task name (defaults to active task)").action((options) => stateCommandHandler(options));
program.command("complete").description("Mark a step as done and unblock downstream steps").requiredOption("--step <name>", "step name").option("--task <name>", "task name (sets as active if given)").action((options) => completeCommandHandler(options));
program.command("revise").description("Mark a step for revision and cascade downstream").requiredOption("--step <name>", "step name").requiredOption("--from <step>", "step triggering the revision").option("--task <name>", "task name (sets as active if given)").action((options) => reviseCommandHandler(options));
const listCmd = program.command("list").description("List flows or tasks");
listCmd.command("flows").description("List all available flows").action(() => listFlowsCommandHandler());
listCmd.command("tasks").description("List all tasks and their status").action(() => listTasksCommandHandler());
program.parse();
//#endregion
export {};
