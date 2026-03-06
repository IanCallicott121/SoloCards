const { spawn } = require("node:child_process");
const path = require("node:path");

const electronBinary = require("electron");
const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [path.join(__dirname)], {
  stdio: "inherit",
  env: childEnv
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
