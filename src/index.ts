#!/usr/bin/env node

import { Command } from "commander";
import {
  completeCommandHandler,
  contextCommandHandler,
  init,
  listFlowsCommandHandler,
  listTasksCommandHandler,
  nextCommandHandler,
  reviseCommandHandler,
  startCommandHandler,
  stateCommandHandler,
  validateCommand,
} from "./commands/index.js";

const program = new Command();

program.name("agentflow").description("A CLI tool for managing agentic workflows").version("1.0.0");

program
  .command("init")
  .description("Initialize agentflow in the current directory")
  .option(
    "--default",
    "Non-interactive init: scaffold structure only, skip flows, IDE, and AI tool setup",
  )
  .action((opts: { default?: boolean }) => init(opts));

program
  .command("validate")
  .description("Validate project config and flows")
  .option("--flow <name>", "validate a single flow by name")
  .action((options: { flow?: string }) => validateCommand(options));

program
  .command("start")
  .description("Create a new task and set it as active")
  .requiredOption("--task <name>", "task name")
  .option("--flow <name>", "flow name (defaults to defaultFlow)")
  .action((options: { task: string; flow?: string }) => startCommandHandler(options));

program
  .command("next")
  .description("Get the next step(s) to work on")
  .option("--task <name>", "task name (sets as active if given)")
  .option("--parallel", "return all currently open steps")
  .option("--resume", "clear a flow pause and proceed to the next step")
  .action((options: { task?: string; parallel?: boolean; resume?: boolean }) =>
    nextCommandHandler(options),
  );

program
  .command("context")
  .description("Output full context for a step to inject into an agent prompt")
  .requiredOption("--step <name>", "step name")
  .option("--task <name>", "task name (sets as active if given)")
  .option("--debug", "list all context files with line and token counts (replaces normal output)")
  .action((options: { step: string; task?: string; debug?: boolean }) =>
    contextCommandHandler(options),
  );

program
  .command("state")
  .description("Show the current state of all steps in a task")
  .option("--task <name>", "task name (defaults to active task)")
  .action((options: { task?: string }) => stateCommandHandler(options));

program
  .command("complete")
  .description("Mark a step as done and unblock downstream steps")
  .requiredOption("--step <name>", "step name")
  .option("--task <name>", "task name (sets as active if given)")
  .action((options: { step: string; task?: string }) => completeCommandHandler(options));

program
  .command("revise")
  .description("Mark a step for revision and cascade downstream")
  .requiredOption("--step <name>", "step name")
  .requiredOption("--from <step>", "step triggering the revision")
  .option("--task <name>", "task name (sets as active if given)")
  .action((options: { step: string; from: string; task?: string }) =>
    reviseCommandHandler(options),
  );

const listCmd = program.command("list").description("List flows or tasks");

listCmd
  .command("flows")
  .description("List all available flows")
  .action(() => listFlowsCommandHandler());

listCmd
  .command("tasks")
  .description("List all tasks and their status")
  .action(() => listTasksCommandHandler());

program.parse();
