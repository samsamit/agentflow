#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/index.js";

const program = new Command();

program
  .name("chain-flow")
  .description("A CLI tool for managing agentic workflows")
  .version("0.1.0");

program
    .command("init")
    .description("Initialize chain-flow in the current directory")
    .action(init)

program.parse();