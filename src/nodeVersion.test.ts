/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import semver from 'semver';

// Dependabot PRs run CI without secrets, so the Sign plugin step is skipped there and a
// sign-plugin bump that needs a newer Node only fails after merge. This check runs in
// every PR's unit tests instead.
const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const signRange: string = JSON.parse(read('node_modules/@grafana/sign-plugin/package.json')).engines.node;

const workflowNodeVersions = (): Array<{ file: string; version: string }> => {
  const dir = '.github/workflows';
  return fs
    .readdirSync(path.join(root, dir))
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) =>
      [...read(`${dir}/${f}`).matchAll(/^\s*node-version:\s*['"]?([^'"\s#]+)/gm)].map((m) => ({
        file: f,
        version: m[1],
      }))
    );
};

describe('Node version used for signing', () => {
  it('sign-plugin declares a Node range', () => {
    expect(semver.validRange(signRange)).not.toBeNull();
  });

  it('every workflow node-version can run sign-plugin', () => {
    const versions = workflowNodeVersions();
    expect(versions.map((v) => v.file)).toEqual(expect.arrayContaining(['ci.yml', 'release.yml']));
    const tooOld = versions.filter((v) => !semver.intersects(v.version, signRange));
    expect(tooOld).toEqual([]);
  });

  it('.nvmrc can run sign-plugin', () => {
    expect(semver.intersects(read('.nvmrc').trim(), signRange)).toBe(true);
  });

  it('package.json engines only allow Node versions that can run sign-plugin', () => {
    const engines: string = JSON.parse(read('package.json')).engines.node;
    expect(semver.subset(engines, signRange)).toBe(true);
  });
});
