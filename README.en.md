# dsh-locale-pt-br

[Português](README.md) | English

**Brazilian Portuguese** language pack for the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web UI.
Adds *Português (Brasil)* to **Settings → General → Language**.

- All 2072 UI strings of dsh 0.1.7-alpha.2 translated (52 namespaces).
- New dsh strings that aren't translated yet show in English.
- `pt-BR`, `pt-PT` and `pt` browsers pick Portuguese automatically.
- No network calls, no model calls, no browser storage: it only registers the
  language and its dictionaries with dsh's locale service. The language choice
  stays in dsh's own settings.

## Install

Take the `.tgz` URL from the [latest release](https://github.com/edgarfroes/dsh-locale-pt-br/releases/latest) and run:

```bash
dsh plugin --profile web add https://github.com/edgarfroes/dsh-locale-pt-br/releases/download/v0.1.1/dsh-locale-pt-br-0.1.1.tgz
```

Or, in the Web UI, **Plugins → Add plugin** and paste the same URL. Then pick
*Português (Brasil)* in Settings → General → Language.

Tested dsh version: **0.1.7-alpha.2**.

## Contributing

Translation fixes and improvements are welcome as pull requests: see the
[contributing guide](CONTRIBUTING.en.md) and the [glossary](GLOSSARY.md). The guide also
explains how to use this repository as a template for a pack in another language.

## Development

| Command | What it does |
| --- | --- |
| `npm run extract -- <node_modules> data/en.json` | Extract the English strings from a dsh install |
| `npm run check` | Compare `dictionaries/` with `data/en.json`: missing, stale, empty keys or different `{placeholders}` |
| `npm run check -- --dsh <node_modules>` | The same, against a dsh install |
| `npm run build` | Generate `lib/client.js` from `dictionaries/` |
| `npm test` | Tests; with `DSH_NODE_MODULES=<node_modules>` also against the installed dsh |

Translations live in `dictionaries/<namespace>.json`. To move to a new dsh
version: `extract`, `check`, translate what's missing, `build`, `test`.

## Credits

Part of the dictionaries started from the Português (Brasil) strings of
[@mimateinn/dsh-i18n](https://github.com/mimateinn/dsh-i18n) (MIT). See [LICENSE](LICENSE).

## License

MIT
