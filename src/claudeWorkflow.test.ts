/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

// Claude pushes with a GitHub App token. GitHub only lets that token change files under
// .github/workflows when it carries the `workflows` permission, so the workflow must ask for
// an explicit permission set without it. An empty `additional_permissions` makes the action
// send no permission set at all, and the token exchange then picks one.
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/claude.yml'), 'utf8');

/** The lines of a `key: |` block scalar, with indentation and comments dropped. */
const blockInput = (key: string): string[] => {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^\\s+${key}:\\s*\\|\\s*$`).test(line));
  expect(start).toBeGreaterThanOrEqual(0);
  const keyIndent = lines[start].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && line.search(/\S/) <= keyIndent) {
      break;
    }
    if (line.trim() !== '' && !line.trim().startsWith('#')) {
      body.push(line.trim());
    }
  }
  return body;
};

/** Parses `additional_permissions` the way the action does: one `name: level` per line. */
const requestedPermissions = (): Record<string, string> =>
  Object.fromEntries(
    blockInput('additional_permissions')
      .filter((line) => line.includes(':'))
      .map((line) => {
        const i = line.indexOf(':');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      })
  );

describe('Claude workflow', () => {
  it('requests an App token with exactly contents, pull_requests and issues write', () => {
    expect(requestedPermissions()).toEqual({
      contents: 'write',
      pull_requests: 'write',
      issues: 'write',
    });
  });

  it('never requests the workflows permission', () => {
    expect(Object.keys(requestedPermissions())).not.toContain('workflows');
    expect(workflow).not.toMatch(/^\s+workflows:/m);
  });

  it('keeps the Edit deny rules for .github, .git and .claude', () => {
    const args = blockInput('claude_args').join(' ');
    for (const rule of ['Edit(.github/**)', 'Edit(.git/**)', 'Edit(.claude/**)']) {
      expect(args).toContain(rule);
    }
    expect(args).toMatch(/--disallowedTools\s/);
  });
});
