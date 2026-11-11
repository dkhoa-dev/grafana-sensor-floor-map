# Changelog

## 0.2.3 (2026-11-11)

- Requires Grafana 13.3.0 or later. Grafana 13.2 is no longer supported. The plugin is built against the Grafana 13.3.0 packages, so it uses no API that the oldest supported Grafana lacks.
- `npm run server` starts Grafana 13.3.0 unless `GRAFANA_VERSION` names another version.

## 0.2.2 (2026-11-01)

- The AI model choice is stored in the browser under a key prefixed with the plugin id (`dkhoa-sensorfloormap-panel.ai`). A choice saved by an earlier version moves to the new key on first read.
- The floor plan editor sanitises the static part of the plan where it draws it, instead of relying on the code that built the plan, so markup that skipped the earlier sanitising cannot run script in the editor.
- CI and the release workflow run on Node 24, which `@grafana/sign-plugin` 4 requires.
- Release archives are signed by the release workflow.

## 0.2.1 (2026-10-26)

- Room links that leave Grafana open in the same tab without touching `window.location`, as Grafana's plugin rules require.
- Release archives carry a build provenance attestation.

## 0.2.0 (2026-10-26)

- The AI assistant no longer calls AI providers with an API key from the browser. Copy its prompt into any AI chat (with a floor plan image or PDF attached there, if you have one) and paste the reply back, or generate through the Grafana LLM app when it is set up. The Anthropic, Foundry and OpenAI-compatible provider settings are gone.

## 0.1.0 (2026-10-26)

First version of Sensor Floor Map.

- SVG floor plans with rooms tagged by `data-room` or a `room-` id, sanitised before display.
- Any metric: every numeric field is one, with units, decimals and limits from Grafana's field config and overrides. Temperature, humidity, CO₂, PM2.5 and PM10 have built-in defaults. A Metrics option picks and orders them.
- Reads tables and labelled series (including Flux), with field auto-detection. Limits can also come with the data per sensor, as text (`18-26`) or min/max columns, one-sided or both.
- Room status: within limits, near a limit, out of limits, offline, no sensor. Rooms can also be coloured by where any metric sits inside its band.
- Auto-binding by name, or a sensor chosen for each room in the options pane.
- Hover tooltip, in-room values, legend and a configurable click-through link.
- Floor plan editor: draw and edit rectangle and polygon rooms with grid snapping and undo, or generate rooms from the sensor locations in the data.
- AI assistant in the editor: draw a plan from a description, trace an image or PDF, or fix an SVG's format, using Claude (Anthropic API or Microsoft Foundry), an OpenAI-compatible endpoint (OpenAI, OpenRouter, DeepSeek, custom) or the Grafana LLM app.
- ClickHouse support in both table and time series formats, with a demo service, dashboard and documented queries.
