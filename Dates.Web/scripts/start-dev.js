import { spawn } from 'node:child_process';

const api = spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server/dev.js'], { stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });
const children = [api, vite];
let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => { if (!child.killed) child.kill(); });
  process.exitCode = exitCode;
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
children.forEach(child => child.on('exit', code => {
  if (!stopping) stop(code ?? 1);
}));
