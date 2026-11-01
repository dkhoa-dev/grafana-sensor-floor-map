/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

// The tag build is what Grafana's catalog takes. If the signing token is not passed to the
// build action, the release still goes green but ships an unsigned zip (no MANIFEST.txt).
const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

/** The `with:` inputs of the grafana/plugin-actions/build-plugin step, comments dropped. */
const buildPluginInputs = (): string => {
  const workflow = read('.github/workflows/release.yml');
  const start = workflow.search(/^\s*- uses: grafana\/plugin-actions\/build-plugin@/m);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = workflow.slice(start).split('\n');
  const stepIndent = rest[0].indexOf('-');
  const end = rest.findIndex((line, i) => i > 0 && line.trim() !== '' && line.search(/\S/) <= stepIndent);
  return rest
    .slice(0, end === -1 ? undefined : end)
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
};

describe('release workflow', () => {
  it('passes the Grafana access policy token to the build action, so the archive is signed', () => {
    expect(buildPluginInputs()).toMatch(
      /^\s+policy_token:\s*\$\{\{\s*secrets\.GRAFANA_ACCESS_POLICY_TOKEN\s*\}\}\s*$/m
    );
  });

  it('does not use the deprecated grafana_token input', () => {
    expect(read('.github/workflows/release.yml')).not.toMatch(/grafana_token/);
  });

  it('keeps the build provenance attestation', () => {
    expect(buildPluginInputs()).toMatch(/^\s+attestation:\s*true\s*$/m);
  });
});

describe('changelog', () => {
  it('has an entry for the version in package.json, which tag-release.yml tags', () => {
    const version: string = JSON.parse(read('package.json')).version;
    const headings = [...read('CHANGELOG.md').matchAll(/^## (\S+)/gm)].map((m) => m[1]);
    expect(headings).toContain(version);
  });
});
