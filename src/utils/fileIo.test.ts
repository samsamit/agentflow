import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createFile", () => {
  it("creates a file with given content", async () => {
    const { createFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "test.txt");
    createFile(filePath, "hello");
    expect(fs.readFileSync(filePath, "utf8")).toBe("hello");
  });

  it("creates parent directories if they do not exist", async () => {
    const { createFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "nested", "deep", "file.txt");
    createFile(filePath, "content");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("does not overwrite an existing file and returns alreadyExists=true", async () => {
    const { createFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "existing.txt");
    fs.writeFileSync(filePath, "original");
    const result = createFile(filePath, "new content");
    expect(result.alreadyExists).toBe(true);
    expect(fs.readFileSync(filePath, "utf8")).toBe("original");
  });

  it("throws on invalid file path", async () => {
    const { createFile } = await import("./fileIo.js");
    expect(() => createFile("", "content")).toThrow();
  });
});

describe("createFolder", () => {
  it("creates a folder", async () => {
    const { createFolder } = await import("./fileIo.js");
    const folderPath = path.join(tmpDir, "myfolder");
    createFolder(folderPath);
    expect(fs.existsSync(folderPath)).toBe(true);
    expect(fs.statSync(folderPath).isDirectory()).toBe(true);
  });

  it("returns alreadyExists=true when folder exists", async () => {
    const { createFolder } = await import("./fileIo.js");
    const folderPath = path.join(tmpDir, "existing");
    fs.mkdirSync(folderPath);
    const result = createFolder(folderPath);
    expect(result.alreadyExists).toBe(true);
  });

  it("throws on invalid folder path", async () => {
    const { createFolder } = await import("./fileIo.js");
    expect(() => createFolder("")).toThrow();
  });
});

describe("writeFile", () => {
  it("writes content to a file", async () => {
    const { writeFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "output.txt");
    writeFile(filePath, "written content");
    expect(fs.readFileSync(filePath, "utf8")).toBe("written content");
  });

  it("creates parent directories if they do not exist", async () => {
    const { writeFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "sub", "file.txt");
    writeFile(filePath, "content");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("throws on invalid target path", async () => {
    const { writeFile } = await import("./fileIo.js");
    expect(() => writeFile("", "content")).toThrow();
  });
});

describe("readFile", () => {
  it("reads file content as string", async () => {
    const { readFile } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "read.txt");
    fs.writeFileSync(filePath, "read this");
    const content = readFile(filePath);
    expect(content).toBe("read this");
  });

  it("throws when file does not exist", async () => {
    const { readFile } = await import("./fileIo.js");
    expect(() => readFile(path.join(tmpDir, "nonexistent.txt"))).toThrow();
  });
});

describe("fileExists", () => {
  it("returns true when file exists", async () => {
    const { fileExists } = await import("./fileIo.js");
    const filePath = path.join(tmpDir, "exists.txt");
    fs.writeFileSync(filePath, "");
    expect(fileExists(filePath)).toBe(true);
  });

  it("returns false when file does not exist", async () => {
    const { fileExists } = await import("./fileIo.js");
    expect(fileExists(path.join(tmpDir, "missing.txt"))).toBe(false);
  });
});

describe("listDirs", () => {
  it("lists subdirectory names in a directory", async () => {
    const { listDirs } = await import("./fileIo.js");
    fs.mkdirSync(path.join(tmpDir, "dirA"));
    fs.mkdirSync(path.join(tmpDir, "dirB"));
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "");
    const dirs = listDirs(tmpDir);
    expect(dirs).toContain("dirA");
    expect(dirs).toContain("dirB");
    expect(dirs).not.toContain("file.txt");
  });

  it("throws when directory does not exist", async () => {
    const { listDirs } = await import("./fileIo.js");
    expect(() => listDirs(path.join(tmpDir, "nonexistent"))).toThrow();
  });
});
