// Launch and stop the two Jupyter servers (old classic Notebook 6, new JupyterLab+fork).
// Notebooks are served for display only — no execution — so servers start fast.
import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { get } from 'node:http';
import { PATHS, TOKEN, PORT_OLD, PORT_NEW } from './config.js';

export type StackName = 'old' | 'new';

export interface ServerHandle {
  stack: StackName;
  port: number;
  baseUrl: string;
  proc: ChildProcess;
  stop: () => void;
}

function waitForPort(port: number, timeoutMs = 90000): Promise<void> {
  const start = Date.now();
  const url = `http://127.0.0.1:${port}/api?token=${TOKEN}`;
  return new Promise((res, rej) => {
    const tick = () => {
      const req = get(url, (r) => {
        r.resume();
        // Any HTTP response (200/403/etc.) means the server is up and listening.
        res();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          rej(new Error(`Server on port ${port} did not come up within ${timeoutMs}ms`));
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

export async function startServer(stack: StackName, deckPath: string): Promise<ServerHandle> {
  const port = stack === 'old' ? PORT_OLD : PORT_NEW;
  const baseUrl = `http://127.0.0.1:${port}`;

  const env = { ...process.env } as NodeJS.ProcessEnv;
  let cmd: string;
  let args: string[];

  if (stack === 'old') {
    env.JUPYTER_CONFIG_DIR = PATHS.jupyterConfigOld;
    cmd = resolve(PATHS.venvOld, 'Scripts', 'python.exe');
    args = [
      '-m', 'notebook',
      '--no-browser',
      `--port=${port}`,
      '--ip=127.0.0.1',
      `--NotebookApp.token=${TOKEN}`,
      `--NotebookApp.notebook_dir=${deckPath}`,
      '--NotebookApp.open_browser=False',
      '--NotebookApp.disable_check_xsrf=True'
    ];
  } else {
    env.JUPYTER_CONFIG_DIR = PATHS.jupyterConfigNew;
    cmd = resolve(PATHS.venvNew, 'Scripts', 'python.exe');
    args = [
      '-m', 'jupyterlab',
      '--no-browser',
      `--port=${port}`,
      '--ip=127.0.0.1',
      `--ServerApp.token=${TOKEN}`,
      `--ServerApp.root_dir=${deckPath}`,
      '--ServerApp.open_browser=False',
      '--ServerApp.disable_check_xsrf=True'
    ];
  }

  const proc = spawn(cmd, args, { env, stdio: 'pipe', windowsHide: true });
  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  const stop = () => {
    try {
      if (process.platform === 'win32' && proc.pid) {
        // Kill the whole tree; Jupyter spawns children.
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
  };

  try {
    await waitForPort(port);
  } catch (e) {
    stop();
    throw e;
  }

  return { stack, port, baseUrl, proc, stop };
}
