# Como contribuir com traduções

Português | [English](CONTRIBUTING.en.md)

Obrigado por ajudar! Você não precisa saber programar: as traduções são
arquivos JSON simples. Só é preciso ter o [Node.js 22](https://nodejs.org/) e o Git.

## 1. Preparar

1. Faça um fork de [edgarfroes/dsh-locale-pt-br](https://github.com/edgarfroes/dsh-locale-pt-br) no GitHub.
2. Clone o seu fork e crie um branch:

   ```bash
   git clone https://github.com/<seu-usuario>/dsh-locale-pt-br.git
   cd dsh-locale-pt-br
   git switch -c traducao-<assunto>
   ```

Não há dependências para instalar.

## 2. Onde ficam os textos

| Arquivo | O que tem |
| --- | --- |
| `data/en.json` | O texto original em inglês de cada string, por namespace. **Não edite à mão**: ele é gerado a partir do dsh. |
| `dictionaries/<namespace>.json` | A tradução de cada string. **É aqui que você edita.** |
| `GLOSSARY.md` | Os termos já escolhidos (sessão, workspace, predefinição…). |
| `lib/client.js` | Gerado por `npm run build`. **Não edite à mão.** |

Cada namespace é uma parte da interface: `chat`, `workspace`, `settings.models`… Para achar
uma string que você viu na tela, busque o texto em inglês em `data/en.json`:

```bash
grep -n "New Session" data/en.json
```

A chave encontrada (por exemplo `session.new` no namespace `sidebar`) é a mesma em
`dictionaries/sidebar.json`.

## 3. Traduzir

Abra `dictionaries/<namespace>.json` e altere só o valor, nunca a chave:

```json
{
  "session.new": "Nova sessão"
}
```

Regras:

- **Marcadores**: mantenha cada `{nome}` exatamente como está no inglês, no lugar que
  fizer sentido na frase. `"{count} files"` → `"{count} arquivos"`. O `npm run check`
  recusa marcadores diferentes.
- **Plurais**: chaves terminadas em `.one` e `.other` são singular e plural.
- **Tom**: português do Brasil, direto, tratando a pessoa por "você". Botões e
  ações no infinitivo ("Salvar", "Abrir barra lateral"); mensagens em frases curtas.
- **Maiúsculas**: só na primeira palavra ("Nova sessão", não "Nova Sessão").
- **Não traduza**: nomes de produtos e apps (VS Code, GitHub), comandos (`/plan`,
  `compact`), nomes de arquivos e protocolos (cordis.patch.yml, OpenAI Responses) e
  valores técnicos como a chave `sidebarExcel` `language` (`en`).
- **Termos**: siga o `GLOSSARY.md`. Para mudar um termo, mude em todos os arquivos no
  mesmo PR e atualize o glossário.
- Strings vazias no inglês (`""`) não precisam de tradução.

## 4. Conferir

```bash
npm run check   # toda string tem tradução, com os mesmos {marcadores}
npm run build   # gera lib/client.js
npm test        # testes
```

Os três precisam passar. Faça commit também do `lib/client.js` gerado.

Para ver na tela: instale o seu branch no dsh (`npm pack` e
`dsh plugin --profile web add <caminho>/dsh-locale-pt-br-<versão>.tgz`) e escolha
Português (Brasil) em Configurações → Geral → Idioma.

## 5. Abrir o PR

```bash
git add dictionaries lib/client.js GLOSSARY.md
git commit -m "pt-BR: <o que mudou>"
git push -u origin HEAD
```

Abra o pull request no GitHub. Diga o que mudou e por quê; se possível, anexe um
print da tela. O CI roda `check`, `build --verify` e os testes.

## Quando sai uma versão nova do dsh

Mantenedores (ou quem quiser adiantar):

```bash
npm install --no-save @deepseek-ai/dsh@<versão>
npm run extract -- node_modules data/en.json
npm run check   # lista o que falta (missing) e o que saiu do dsh (stale)
```

Traduza as chaves `missing`, apague as `stale`, rode `build` e `test` e abra o PR com a
versão do dsh no título. Atualize a versão testada no README.

## Traduzir para outro idioma

Este repositório é só para pt-BR, mas ele serve de modelo para um pacote de qualquer idioma:

1. Crie um repositório novo a partir de uma cópia deste (por exemplo `dsh-locale-<id>`).
2. Em `scripts/build.mjs`, troque `LANGUAGE` (`id` no formato BCP 47, como `it` ou
   `fr-CA`; `label` com o nome do idioma nele mesmo; `fallback: 'en'`) e o `PLUGIN_ID`.
3. Em `package.json`, troque `name`, `description`, `dsh.market.description`,
   `keywords` e as URLs do repositório. Em `cordis.patch.yml`, troque o `id`.
4. Troque o conteúdo de cada `dictionaries/<namespace>.json` pelas suas traduções
   (comece copiando o valor em inglês de `data/en.json` e traduza).
5. Ajuste os testes que citam `pt-BR`/`Português (Brasil)` em `test/pack.test.mjs`,
   os READMEs e o LICENSE (mantenha os créditos que valerem).
6. `npm run check && npm run build && npm test`, e publique como aqui (tag `v*` →
   release com o `.tgz`).
