/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import semver from 'semver';

// The API compatibility check compares the Grafana packages at the lowest version in
// grafanaDependency against the latest release. Building against a newer minor than the one
// declared lets the plugin use APIs that the oldest supported Grafana does not have, and a
// local server older than the declared minimum will not load the plugin.
const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const runtimePackages = ['@grafana/data', '@grafana/i18n', '@grafana/runtime', '@grafana/schema', '@grafana/ui'];
const dependencies: Record<string, string> = JSON.parse(read('package.json')).dependencies;
const grafanaDependency: string = JSON.parse(read('src/plugin.json')).dependencies.grafanaDependency;

describe('Grafana version alignment', () => {
  it('pins every Grafana runtime package to the same exact version', () => {
    const pinned = runtimePackages.map((name) => dependencies[name]);
    expect(pinned.every((v) => semver.valid(v) !== null)).toBe(true);
    expect(new Set(pinned).size).toBe(1);
  });

  it('declares the same minimum Grafana minor that the packages are built against', () => {
    const min = semver.minVersion(grafanaDependency);
    const built = semver.parse(dependencies['@grafana/data']);
    expect(min).not.toBeNull();
    expect(built).not.toBeNull();
    expect(`${min!.major}.${min!.minor}`).toBe(`${built!.major}.${built!.minor}`);
  });

  it('starts the local server on a Grafana that satisfies grafanaDependency', () => {
    const match = read('docker-compose.yaml').match(/grafana_version:\s*\$\{GRAFANA_VERSION:-([^}\s]+)\}/);
    expect(match).not.toBeNull();
    expect(semver.satisfies(match![1], grafanaDependency)).toBe(true);
  });
});
