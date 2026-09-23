# dsh-locale-pt-br

Português | [English](README.en.md)

Pacote de idioma **Português (Brasil)** para a interface web do
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).
Adiciona *Português (Brasil)* em **Configurações → Geral → Idioma**.

- Todas as 2072 strings da interface do dsh 0.1.7-alpha.2 traduzidas (52 namespaces).
- Textos novos do dsh que ainda não estão traduzidos aparecem em inglês.
- Navegadores em `pt-BR`, `pt-PT` ou `pt` escolhem o português automaticamente.
- Não faz chamadas de rede nem de modelo e não usa o armazenamento do navegador:
  só registra o idioma e os dicionários no serviço de idioma do dsh. A escolha
  de idioma fica na configuração do próprio dsh.

## Instalação

Pegue o endereço do `.tgz` da [última versão](https://github.com/edgarfroes/dsh-locale-pt-br/releases/latest) e rode:

```bash
dsh plugin --profile web add https://github.com/edgarfroes/dsh-locale-pt-br/releases/download/v0.1.1/dsh-locale-pt-br-0.1.1.tgz
```

Ou, na interface web, **Plugins → Adicionar plugin** e cole o mesmo endereço.
Depois escolha *Português (Brasil)* em Configurações → Geral → Idioma.

Versão do dsh testada: **0.1.7-alpha.2**.

## Contribuir

Correções e melhorias de tradução são bem-vindas por pull request: veja o
[guia de contribuição](CONTRIBUTING.md) e o [glossário](GLOSSARY.md). O guia também
explica como usar este repositório como modelo para um pacote de outro idioma.

## Desenvolvimento

| Comando | O que faz |
| --- | --- |
| `npm run extract -- <node_modules> data/en.json` | Extrai as strings em inglês de uma instalação do dsh |
| `npm run check` | Compara `dictionaries/` com `data/en.json`: chaves faltando, obsoletas, vazias ou com `{marcadores}` diferentes |
| `npm run check -- --dsh <node_modules>` | O mesmo, contra uma instalação do dsh |
| `npm run build` | Gera `lib/client.js` a partir de `dictionaries/` |
| `npm test` | Testes; com `DSH_NODE_MODULES=<node_modules>` também testa contra o dsh instalado |

As traduções ficam em `dictionaries/<namespace>.json`. Para atualizar para uma
versão nova do dsh: `extract`, `check`, traduza o que faltar, `build`, `test`.

## Créditos

Parte dos dicionários partiu das strings em Português (Brasil) do
[@mimateinn/dsh-i18n](https://github.com/mimateinn/dsh-i18n) (MIT). Veja [LICENSE](LICENSE).

## Licença

MIT
