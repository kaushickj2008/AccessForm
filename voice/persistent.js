import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

async function unusedLoopbackPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

// Only one model is held in this process manager. Callers serialize model changes and inference.
export class PersistentWhisper {
  constructor({ spawnProcess = spawn, fetchLocal = fetch, reservePort = unusedLoopbackPort, pollDelay = delay, startupTimeoutMs = 60000 } = {}) {
    Object.assign(this, { spawnProcess, fetchLocal, reservePort, pollDelay, startupTimeoutMs });
    this.child = null;
  }

  async ensure({ binary, model, cpu = false }) {
    const key = JSON.stringify([binary, model, cpu]);
    if (this.child && !this.dead && this.key === key) return { startupMs: 0, coldStart: false };
    await this.stop();
    const started = performance.now();
    this.directory = await mkdtemp(join(tmpdir(), 'accessform-whisper-'));
    try {
      const port = await this.reservePort();
      const route = `/accessform-${randomUUID()}`;
      this.url = `http://127.0.0.1:${port}${route}`;
      this.dead = false;
      this.key = key;
      this.child = this.spawnProcess(binary, ['-m', model, '--host', '127.0.0.1', '--port', String(port), '--request-path', route, '--public', this.directory, '-l', 'en', '-nt', '-mc', '0', '-bo', '5', '-bs', '5', ...(cpu ? ['-ng'] : [])], { stdio: 'ignore' });
      const child = this.child;
      this.exited = new Promise(resolve => {
        child.once('error', () => { this.dead = true; resolve(); });
        child.once('exit', () => { this.dead = true; resolve(); });
      });
      while (!this.dead && performance.now() - started < this.startupTimeoutMs) {
        try {
          const response = await this.fetchLocal(`${this.url}/health`, { signal: AbortSignal.timeout(1000) });
          if (response.ok && (await response.json()).status === 'ok' && !this.dead) {
            return { startupMs: Math.round(performance.now() - started), coldStart: true };
          }
        } catch { /* Native server is still loading; do not expose or log diagnostics. */ }
        await this.pollDelay(50);
      }
      throw new Error('Persistent speech engine did not become ready.');
    } catch {
      await this.stop();
      throw new Error('Persistent speech engine could not start. Continue with the CLI backend.');
    }
  }

  async infer(wavBuffer, config) {
    const timing = await this.ensure(config);
    const body = new FormData();
    body.set('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'utterance.wav');
    body.set('response_format', 'json');
    body.set('language', 'en');
    body.set('no_timestamps', 'true');
    const started = performance.now();
    try {
      const response = await this.fetchLocal(`${this.url}/inference`, { method: 'POST', body, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error('Inference failed.');
      const result = await response.json();
      if (typeof result.text !== 'string') throw new Error('Invalid inference response.');
      return { text: result.text.trim(), ms: Math.round(performance.now() - started), ...timing, backend: 'persistent' };
    } catch {
      // A timed-out job must not continue to consume resources during the next benchmark.
      await this.stop();
      throw new Error('Persistent recognition failed. Continue with the CLI backend.');
    }
  }

  async stop() {
    const child = this.child;
    if (child && !this.dead) {
      child.kill('SIGTERM');
      const killed = setTimeout(() => child.kill('SIGKILL'), 1500);
      try { await this.exited; } finally { clearTimeout(killed); }
    }
    this.child = null;
    this.dead = true;
    this.key = null;
    this.url = null;
    if (this.directory) { await rm(this.directory, { recursive: true, force: true }); this.directory = null; }
  }

  killOnExit() { if (this.child && !this.dead) this.child.kill('SIGKILL'); }
}
