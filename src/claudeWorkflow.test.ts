/**
 * @jest-environment node
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Claude pushes with a GitHub App token. GitHub only lets that token change files under
// .github/workflows when it carries the `workflows` permission, so the workflow must ask for
// an explicit permission set without it. An empty `additional_permissions` makes the action
// send no permission set at all, and the token exchange then picks one.
const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/claude.yml'), 'utf8');

/** The lines of a `key: |` block scalar, with indentation and comments dropped. */
const blockInput = (key: string, source = workflow): string[] => {
  const lines = source.split('\n');
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

/**
 * The `name: value` lines of a block mapping found by its exact indentation (0 for workflow
 * level, 4 for the job), with comments dropped. Undefined when the mapping is absent.
 */
const mapping = (key: string, indent: number): Record<string, string> | undefined => {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line === `${' '.repeat(indent)}${key}:`);
  if (start < 0) {
    return undefined;
  }
  const entries: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    if (line.search(/\S/) <= indent) {
      break;
    }
    const i = line.indexOf(':');
    entries[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return entries;
};

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

  // The action checks for @claude too, but only after it has fetched the App token. Without this
  // gate every comment and every new issue would start a runner.
  it('starts the job only when the comment, review comment or issue mentions @claude', () => {
    expect(blockInput('if').join(' ')).toBe(
      "(github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) || " +
        "(github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) || " +
        "(github.event_name == 'issues' && (contains(github.event.issue.body, '@claude') || contains(github.event.issue.title, '@claude')))"
    );
  });

  // With git, the action writes the App token into the origin URL in .git/config and allows
  // `git commit` and its push script (claude-code-action src/modes/tag/index.ts and
  // src/github/operations/git-config.ts at the pinned SHA), so `git commit -F .git/config` could
  // publish the token. API commit signing drops those git tools and commits through an MCP tool.
  it('commits through the GitHub API, so Claude gets no git commit or push tool', () => {
    expect(workflow.match(/^\s+use_commit_signing:\s*['"]?(\w+)['"]?\s*$/m)?.[1]).toBe('true');
    // ssh_signing_key takes precedence and brings git commit and the push script back.
    expect(workflow).not.toMatch(/^\s+ssh_signing_key:/m);
  });

  // The token stays in .git/config and in Claude's environment and arguments. Claude must not read
  // it there or run any command that could, so no prompt can copy it into a file or commit message.
  it('denies Bash and reads of .git and /proc', () => {
    const denied = (
      blockInput('claude_args')
        .join(' ')
        .match(/--disallowedTools\s+"([^"]*)"/)?.[1] ?? ''
    )
      .split(',')
      .map((rule) => rule.trim());
    expect(denied).toEqual(expect.arrayContaining(['Bash', 'Read(.git/**)', 'Read(//proc/**)']));
  });

  // Claude pushes and comments with the App token (additional_permissions). The job token only
  // checks out, lets the fork gate read the PR and backs the action's inline-comment fallback
  // (`Post buffered inline comments` in action.yml at the pinned SHA), so it needs no contents or
  // issues write. id-token is the OIDC exchange for the App token.
  it('gives the job token write access to pull requests only', () => {
    expect(mapping('permissions', 0)).toEqual({ contents: 'read' });
    expect(mapping('permissions', 4)).toEqual({
      contents: 'read',
      'pull-requests': 'write',
      issues: 'read',
      'id-token': 'write',
    });
  });

  // GitHub keeps one pending run per concurrency group and cancels the older one. At workflow level
  // every comment enters the group, so a later comment without @claude (or a claude[bot] reply)
  // would cancel a queued @claude run. At job level a skipped job never enters it.
  it('serializes runs per issue or PR at job level, never at workflow level', () => {
    expect(mapping('concurrency', 0)).toBeUndefined();
    expect(mapping('concurrency', 4)).toEqual({
      group: 'claude-${{ github.event.issue.number || github.event.pull_request.number }}',
      'cancel-in-progress': 'false',
    });
  });

  describe('fork gate', () => {
    /** The text of the fork gate step, up to the next step. */
    const gateStep = (): string => {
      const start = workflow.indexOf('- name: Refuse pull requests from forks');
      expect(start).toBeGreaterThanOrEqual(0);
      const end = workflow.indexOf('\n      - ', start);
      return workflow.slice(start, end < 0 ? undefined : end);
    };

    /** Runs the gate script the way GitHub runs `shell: bash`, with a fake `gh`. */
    const runGate = (headRepo: string, ghExit = 0): { status: number | null; args: string } => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-fork-gate-'));
      try {
        const argsFile = path.join(dir, 'args');
        fs.writeFileSync(
          path.join(dir, 'gh'),
          '#!/bin/sh\nprintf "%s " "$@" > "$FAKE_GH_ARGS"\nprintf "%s\\n" "$FAKE_HEAD"\nexit "$FAKE_GH_EXIT"\n',
          { mode: 0o755 }
        );
        fs.writeFileSync(argsFile, '');
        const r = spawnSync(
          'bash',
          ['--noprofile', '--norc', '-eo', 'pipefail', '-c', blockInput('run', gateStep()).join('\n')],
          {
            encoding: 'utf8',
            env: {
              PATH: `${dir}:${process.env.PATH}`,
              GITHUB_REPOSITORY: 'dkhoa-dev/example',
              PR_NUMBER: '7',
              FAKE_GH_ARGS: argsFile,
              FAKE_HEAD: headRepo,
              FAKE_GH_EXIT: String(ghExit),
            },
          }
        );
        return { status: r.status, args: fs.readFileSync(argsFile, 'utf8') };
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };

    // The API commit tool reads files from disk and follows symlinks, and the action checks out a
    // fork PR's head. A fork could add a link to .git/config and ask Claude to commit it.
    it('checks every pull request event for a fork before Claude runs', () => {
      const step = gateStep();
      expect(workflow.indexOf(step)).toBeLessThan(workflow.indexOf('uses: anthropics/claude-code-action@'));
      expect(step).toMatch(/^\s+if: github\.event\.issue\.pull_request \|\| github\.event\.pull_request\s*$/m);
      expect(step).toMatch(/^\s+shell: bash\s*$/m);
      expect(step).not.toMatch(/continue-on-error/);
      expect(step).toMatch(
        /^\s+PR_NUMBER: \$\{\{ github\.event\.issue\.number \|\| github\.event\.pull_request\.number \}\}\s*$/m
      );
    });

    it('passes a same-repository PR and refuses forks, deleted head repos and failed lookups', () => {
      const same = runGate('dkhoa-dev/example');
      expect(same.status).toBe(0);
      expect(same.args).toMatch(/^api repos\/dkhoa-dev\/example\/pulls\/7 --jq \.head\.repo\.full_name/);
      expect(runGate('someone/example').status).not.toBe(0);
      expect(runGate('').status).not.toBe(0);
      expect(runGate('dkhoa-dev/example', 1).status).not.toBe(0);
    });
  });
});
