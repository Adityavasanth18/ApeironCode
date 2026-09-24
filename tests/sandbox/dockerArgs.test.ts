import {describe, expect, it} from 'vitest';

import {buildDockerArgs} from '../../src/sandbox/runners/docker.js';

describe('Docker command construction', () => {
  it('mounts only the workspace with network disabled by default', () => {
    const args = buildDockerArgs('npm test', {cwd: '/workspace/project'}, 'test-container');
    const rendered = args.join(' ');
    expect(rendered).toContain('--network=none');
    expect(rendered).toContain('--volume=/workspace/project:/workspace:rw');
    expect(rendered).toContain('--security-opt=no-new-privileges');
    expect(rendered).toContain('node:20-bookworm-slim');
    expect(rendered).not.toContain('/var/run/docker.sock');
    expect(rendered).not.toContain('--privileged');
    expect(rendered).not.toContain('/home');
  });

  it('enables network only when policy explicitly selects on', () => {
    expect(buildDockerArgs('npm install', {cwd: '/workspace/project', network: 'on'}, 'test').join(' '))
      .toContain('--network=bridge');
  });
});
