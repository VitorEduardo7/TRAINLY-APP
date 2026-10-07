# Trainly App

App mobile do TCC Trainly, feito em **React Native (Expo) + TypeScript**, com **Supabase** como backend. Réplica em app nativo do núcleo do site: login, dashboard com XP/patentes, corrida por GPS ao vivo, feed de amigos, clubes com desafios, rotas públicas, histórico e perfil com estatísticas.

## Comandos rápidos (CMD do Windows)

Cola num CMD aberto **dentro da pasta do projeto**. Troque o caminho pelo da sua máquina — no PC do laboratório é `C:\Users\lab1-aluno\Desktop\TRAINLY-APP`.

```cmd
cd C:\Users\lab1-aluno\Desktop\TRAINLY-APP
```

**Primeira vez nesse PC, ou depois de colar arquivos novos no projeto** (instala tudo que o app usa, inclusive o pacote do túnel):
```cmd
npm install
```

**Rodar com o celular na MESMA rede Wi-Fi do PC** (mais rápido):
```cmd
npx expo start
```

**Rodar com o celular em OUTRA rede** (ex: PC no Wi-Fi do laboratório, celular no 4G) — usa túnel:
```cmd
npx expo start --tunnel
```
Se o túnel reclamar que falta o ngrok (`CommandError: Install @expo/ngrok...`), instale **dentro do projeto** (nunca com `-g`) e rode de novo:
```cmd
npx expo install @expo/ngrok
npx expo start --tunnel
```

**Algo estranho depois de atualizar arquivos** (erro de módulo, tela antiga, fonte que não carrega) — rode limpando o cache do Metro:
```cmd
npx expo start --tunnel -c
```

**Abrir no emulador MEmu no PC** (não precisa de túnel): ative o ADB nas configurações do MEmu (ele mostra uma porta, normalmente 21503) e rode:
```cmd
"C:\Program Files\Microvirt\MEmu\adb.exe" connect 127.0.0.1:21503
npx expo start
```
Com o servidor rodando, aperte **`a`** no terminal: o Expo instala o Expo Go no emulador e abre o app sozinho.

**Gerar um APK instalável / mandar atualização pra quem já tem o APK** (ver Passos 3 e 4 — na primeira vez no PC, antes: `npm install -g eas-cli` e `eas login`):
```cmd
eas build --platform android --profile preview
eas update --branch preview --message "descrição da mudança"
```

### Problemas comuns

| Mensagem / sintoma | O que fazer |
| --- | --- |
| `CommandError: Install @expo/ngrok` | `npx expo install @expo/ngrok` dentro da pasta do projeto (instalar global com `-g` costuma falhar no Windows). Depois `npx expo start --tunnel`. |
| `TypeError: Cannot read properties of undefined (reading 'body')` + "Check the Ngrok status page" | O pacote do túnel está instalado, mas o ngrok **não conseguiu conectar**. Feche outros terminais rodando o Expo, rode `taskkill /F /IM ngrok.exe` e tente de novo. Rede de escola/laboratório costuma bloquear o ngrok: teste em outra rede (ex: roteador do celular) ou rode sem túnel com PC e celular no mesmo Wi-Fi. Não precisa criar conta nem token no ngrok — o Expo usa uma conta própria. |
| `Unable to resolve "algum-arquivo" from "src\..."` | Falta instalar algo: `npm install` e depois `npx expo start -c`. |
| App abre, mas não carrega dados / login falha | Confira o `.env` (Passo 1, item 4). Se o projeto do Supabase foi **pausado** (o plano grátis pausa depois de ~7 dias sem uso), entre em supabase.com, abra o projeto e clique em **Restore project** — os dados voltam intactos, sem precisar de backup. |

---

## O que já está pronto

- Login e cadastro (Supabase Auth)
- Dashboard com patente/XP (Bronze → Prata → Ouro → Platina → Diamante), volume semanal, meta do mês, registro manual de atividade (com data retroativa, pra lançar algo feito em outro dia)
- Corrida/caminhada/pedalada por GPS ao vivo: mapa, distância (Haversine com filtro de precisão e de saltos de sinal), cronômetro, ritmo atual e ritmo médio, elevação, splits por km, pausa manual e pausa automática (quando para de se mover), salva a rota no banco
- Histórico de atividades com estatísticas por atividade. O botão "Publicar como rota" aparece em **todas** as atividades, em três estados: publicável, já publicada (leva pro mapa da rota) ou bloqueada — e nesse caso o app explica o motivo em vez de só esconder o botão (o que dava a impressão errada de que só atividade recente podia virar rota; o que falta, na verdade, é sempre o trajeto de GPS). Vale pra qualquer data: atividade antiga feita por GPS publica normalmente
- **Amigos**: buscar pessoas pelo nome, seguir/deixar de seguir, feed com as atividades de quem você segue (+ as suas), curtidas e comentários (com resposta e, pra quem comentou ou é dono da atividade, apagar)
- **Perfil público de outro atleta**: tocando no autor de um post do feed, num resultado da busca ou num comentário. Mostra contagem de seguidores/seguindo/atividades, botão seguir / deixar de seguir / **"Seguir de volta"** (quando a pessoa já te segue, no mesmo padrão do Instagram), resumo e recordes pessoais dela, e a **trilha de patentes**
- **Trilha de patentes**: Bronze → Prata → Ouro → Platina → Diamante numa linha só, mostrando de uma vez as que o atleta já conquistou, em qual ele está agora e as que ainda faltam (com o nível e quanto XP falta pra próxima). Aparece no perfil próprio e no perfil de qualquer atleta
- **Clubes e desafios**: criar clube (gera um código de convite, igual ao site — clube não aparece em lista pública, só entra quem tem o código), criar desafios com meta de km e período, ranking calculado a partir das atividades reais dos membros
- **Explorar rotas**: lista pública de rotas (publicadas a partir de atividades de outros usuários), com mapa, distância, elevação, dificuldade e terreno
- Perfil com resumo (distância total, tempo ativo, elevação, dias ativos), recordes pessoais, edição de perfil, tema claro/escuro
- Visual próprio (identidade "Noturno"): fundo violeta escuro ou lavanda no tema claro, o azul oficial do site (`#2f7dfd` / `#267cee`), dourado pro XP, fonte Inter no texto e Barlow Condensed nos títulos e números (vem dentro do projeto, em `assets/fonts`). O nível aparece como uma volta numa pista de atletismo na tela inicial
- Gamificação: conquistas, sequência semanal, desafios diários/semanais, Guerra de Clã entre clubes, moldura de avatar e cor do mapa por patente
- Configurações: trocar e-mail e senha, tema, e acessibilidade (modos de daltonismo, alto contraste, tamanho do texto, reduzir animações)
- Navegação por abas fixas embaixo da tela (em vez do menu superior do site) — é o padrão de app nativo no Android/iPhone, mais fácil de usar com o polegar

## O que ficou de fora desta primeira versão (dá pra evoluir depois)

- Mensagens privadas entre atletas (decisão deliberada: o perfil público mostra o atleta e deixa seguir, mas o app não tem conversa privada)
- Notificações push (com o app fechado) — hoje as notificações existem só dentro do app (sino com seguidas, curtidas e comentários)
- Seguir uma rota "ao vivo" durante a corrida (hoje dá pra ver a rota antes, mas o app não guia nem avisa desvio)
- Rastreio de GPS em segundo plano (com o app minimizado) — hoje funciona com o app aberto/tela ligada, igual ao mapa do site, mas com muito mais estabilidade por não depender do navegador

---

## Passo 1 — Criar o backend no Supabase (grátis)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. Vá em **SQL Editor** e rode os arquivos da pasta `supabase/` **um por vez, em queries separadas** (**New query** → colar o arquivo inteiro → **Run**), **nesta ordem** — cada um depende dos anteriores:
   1. `schema.sql` — perfis e atividades (com o cálculo automático de XP)
   2. `avatars_storage.sql` — fotos de perfil
   3. `clubs_and_routes.sql` — clubes, membros, desafios e rotas
   4. `social.sql` — seguir pessoas e curtidas
   5. `comments.sql` — comentários nas atividades
   6. `gamification_schema.sql` — conquistas
   7. `cosmetics_schema.sql` — moldura do avatar e cor do mapa por patente
   8. `streak_schema.sql` — sequência semanal
   9. `quests_schema.sql` — desafios diários e semanais
   10. `clan_war_schema.sql` — Guerra de Clã
   11. `clubs_moderation_schema.sql` — remover/silenciar membro e bloquear usuário

   Não cole todos juntos na mesma query. Se algum arquivo der erro de "já existe", é porque ele já tinha rodado antes — pode seguir pro próximo.
3. Vá em **Project Settings → API** e copie a **Project URL** e a **anon public key**.
4. Nesta pasta, copie `.env.example` para `.env` e cole os dois valores:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-aqui
   ```

## Passo 2 — Rodar o app no celular (Expo Go)

1. Instale as dependências:
   ```
   npm install
   ```
2. Instale o app **Expo Go** no celular (Android: Play Store; iPhone: App Store) — é grátis.
3. Inicie o projeto:
   ```
   npx expo start
   ```
4. Escaneie o QR code que aparece no terminal:
   - **Android**: pelo próprio app Expo Go.
   - **iPhone**: pela câmera nativa do iPhone (abre automaticamente no Expo Go).
5. O celular e o computador precisam estar na mesma rede Wi-Fi. Se não estiverem, use `npx expo start --tunnel` (ver **Comandos rápidos** lá em cima).

Esse é o jeito mais rápido de testar e apresentar em qualquer celular, Android ou iPhone, sem custo.

## Passo 3 — Gerar um APK Android instalável (opcional, backup pra apresentação)

1. Crie uma conta grátis em [expo.dev](https://expo.dev).
2. Instale a ferramenta de build:
   ```
   npm install -g eas-cli
   eas login
   ```
3. Gere o APK:
   ```
   eas build --platform android --profile preview
   ```
4. Ao final, o terminal mostra um link para baixar o `.apk` — envie para o celular e instale (é preciso permitir "instalar de fontes desconhecidas" nas configurações do Android).

## Passo 4 — Atualizar o app depois de gerar o APK (sem gerar outro)

A maioria das mudanças daqui pra frente é só código JavaScript/TypeScript (telas, hooks, lógica, textos) — isso **não precisa de um APK novo**. Dá pra mandar a atualização direto pra quem já instalou o app, com o **EAS Update**:

```
eas update --branch preview --message "descrição da mudança"
```

Quem já tem o app instalado recebe a atualização sozinho na próxima vez que abrir (sem precisar reinstalar nada).

Só é preciso gerar **um APK novo** (repetir o Passo 3) quando a mudança mexe em algo nativo: uma biblioteca nova com módulo nativo, permissões, ícone, nome do app, splash screen, ou qualquer coisa no `app.json` fora de textos simples.

## Trocar a logo e ícone

Troque os arquivos em `assets/` (`icon.png`, `android-icon-foreground.png`, `favicon.png`) pela logo oficial do Trainly nas mesmas dimensões, e rode `npx expo start` novamente.

## Como funciona o rastreio por GPS (útil pro relatório do TCC)

O rastreio (`src/lib/geo.ts` + `src/screens/RunScreen.tsx`) não soma direto a distância entre todo ponto que o GPS manda — isso deixaria a distância sempre maior que a real, porque o sinal de GPS "treme" mesmo parado. O fluxo é:

1. **Filtro de precisão**: cada ponto vem com uma precisão em metros (`accuracy`, dada pelo próprio GPS do celular). Pontos com precisão pior que 25 m são descartados.
2. **Rejeição de saltos**: se a distância até o ponto anterior implica uma velocidade impossível para o tipo de atividade (ex.: mais de 30 km/h numa corrida), o ponto é descartado — evita que reflexo de sinal (prédios, túneis) crie teleporte na rota.
3. **Âncora de distância**: a distância só é somada quando o novo ponto está a mais de 2 m da última posição "âncora" confirmada. Isso absorve o tremor do GPS parado (que oscila cerca de 1 m em várias direções) sem descontar do total. (Era 3 m — mas numa corrida (~3 m/s) o app atualiza a cada ~1s, então o deslocamento real de um único tick já fica perto desse valor; qualquer ruído fazia vários ticks seguidos ficarem "empacados", inclusive distorcendo o ritmo atual.)
4. **Elevação**: soma só ganhos de altitude acima de 1,5 m entre âncoras, pra ignorar ruído do sensor de altitude.
5. **Ritmo atual**: usa a velocidade instantânea que o próprio GPS calcula por efeito Doppler (`coords.speed`, mais estável do que derivar de posição/tempo numa janela curta) e atualiza a cada leitura aceita — não só quando a âncora de distância avança. Cai pra uma janela deslizante de posição/tempo (~30s) só quando o aparelho não informa velocidade. O **ritmo médio** continua vindo de distância/tempo totais.
6. **Splits**: guarda o tempo gasto em cada km completo.
7. **Pausa automática**: se não houver nenhum movimento real por 12 segundos com a atividade "rodando", o app pausa sozinho (sem contar tempo parado no ritmo médio); volta a contar assim que detectar movimento de novo. (Era 25s — parada rápida, tipo atravessar uma rua, contava inteira como "correndo" no ritmo médio.)

## Mapa no Android em build final (opcional)

Para testar no Expo Go, o mapa funciona sem nenhuma configuração extra. Só é necessário criar uma chave gratuita do Google Maps (Google Cloud Console → ativar "Maps SDK for Android") se for gerar o APK final (`eas build`) e quiser o mapa com o visual completo do Google Maps. Cole a chave em `app.json`, no campo `android.config.googleMaps.apiKey`.

## Limitações conhecidas (bom pra citar no relatório como trabalho futuro)

- **Clubes por código de convite**: a interface do app só mostra os clubes de quem você é membro, e só entra em um clube com o código certo. Porém, a política de RLS da tabela `clubs` no Supabase permite que qualquer usuário autenticado leia a tabela inteira diretamente pela API (não só pela interface do app) — ou seja, a "privacidade" do convite hoje é garantida pela interface, não pelo banco. Pra fechar esse ponto por completo, o próximo passo seria mover a busca por código de convite pra uma função `security definer` no Postgres (que faz a consulta com permissão elevada, sem expor a tabela toda) e então restringir a política de `select` de `clubs`/`club_members` só a quem já é membro.
- Sem cache/estado compartilhado entre telas: cada tela busca seus próprios dados do Supabase (com recarregamento automático ao voltar pra tela — ver próxima seção), então trocar de aba não é instantâneo feito num app com um "estado global". Pra uma versão futura com mais usuários simultâneos, vale considerar algo como React Query.
- Ver "O que ficou de fora desta primeira versão" acima pra funcionalidades ainda não implementadas.
- **Sem "esqueci minha senha"**: a tela de login não tem recuperação de senha. Dá pra fazer com `supabase.auth.resetPasswordForEmail`, mas o fluxo completo (o app abrir sozinho a partir do link do e-mail e deixar definir uma senha nova) depende de configurar deep link + um redirect no projeto Supabase — decidi não implementar às cegas, sem poder testar num celular de verdade, pra não entregar um link "morto". Se precisar antes do dia 24/10, dá pra fazer isso junto, testando ao vivo.
- **Comentários não são "ao vivo"**: como o resto do app, a lista de comentários de uma atividade só é buscada de novo quando a seção é aberta (ou reaberta) — se alguém comentar enquanto você está com a seção aberta olhando, não aparece sozinho, só na próxima vez que abrir. Pra virar tempo real, o próximo passo seria usar o Realtime do Supabase (`supabase.channel(...).on('postgres_changes', ...)`) na tabela `activity_comments`. As respostas também são de um nível só (lista plana com uma tag "respondendo a Fulano"), não uma árvore de respostas dentro de respostas — decisão deliberada pra manter a interface simples, já que é o mesmo padrão usado por apps como Strava.

## Por que as telas às vezes pareciam "travadas" com dado antigo

Cada tela carrega seus dados uma vez, quando é criada. Sem nenhum tratamento especial, trocar de aba e voltar (ou sair de uma tela empilhada, tipo o detalhe de um clube) não disparava um novo carregamento — por isso sair de um clube podia continuar aparecendo em "Meus clubes", ou uma atividade nova não aparecer no feed até reiniciar o app. A correção usa o `useFocusEffect` do React Navigation em todas as telas com listas (Dashboard, Histórico, Clubes, Explorar Rotas, Amigos, Perfil, detalhe de clube): toda vez que a tela reaparece na tela (troca de aba, volta de navegação), ela recarrega os dados sozinha.

## Por que o título de uma aba ficava embaixo do relógio do iPhone

Celular moderno tem áreas da tela que o sistema ocupa: em cima, a barra de status (relógio, bateria) e o recorte da câmera; embaixo, a barra de gestos. Quem desenha nessas áreas sem pedir licença fica *por baixo* delas. O jeito certo é perguntar ao sistema quanto espaço reservar, e é isso que a biblioteca `react-native-safe-area-context` faz — via `<SafeAreaView edges={[...]}>` pra uma tela inteira, ou `useSafeAreaInsets()` quando só um pedaço precisa da medida.

Cada aba pede `edges={['top']}` e só isso: a barra de abas de baixo já respeita a área segura inferior sozinha, então pedir `'bottom'` também criaria um vão vazio duplicado. Os modais que sobem de baixo (registrar atividade, criar clube, criar desafio, publicar rota, editar perfil) usam `useSafeAreaInsets()` e somam `insets.bottom` no `paddingBottom`, pra os botões não encostarem na barra de gestos. A tela de corrida faz o mesmo com "Pausar"/"Finalizar", e a de login pede `['top', 'bottom']` porque fica fora da navegação por abas.

O sintoma clássico de esquecer isso numa tela é o que aconteceu na aba **Amigos**: era a única sem `SafeAreaView`, e o título colava no relógio no iPhone. As outras abas já tinham. Se outra tela nova aparecer com esse mesmo sintoma, é esse o lugar pra olhar.

## Estrutura do projeto

```
src/
  theme/        cores, fontes, modo claro/escuro e acessibilidade
  lib/          Supabase, cálculo de XP e trilha de patentes, resumo/recordes, cálculo de GPS (Haversine)
  hooks/        autenticação, atividades, clubes/desafios, rotas, amigos/feed, perfil público
  components/   botões, inputs, cards, avatar, widgets (patente e trilha) e modais reutilizáveis
  screens/      Login, Dashboard, Amigos, Corrida (GPS), Clubes, Explorar Rotas, Histórico, Perfil, Perfil de outro atleta
  navigation/   navegação entre telas (abas fixas + telas empilhadas)
assets/
  fonts/        Barlow Condensed (títulos e números) + licença OFL
supabase/       11 arquivos .sql — rodar na ordem do Passo 1
```

## Próximos passos sugeridos (se sobrar tempo até 24/10)

1. ~~Trocar os ícones padrão do Expo pela logo real do Trainly.~~ **Concluído** — ícone, ícone adaptativo do Android e splash screen usam a arte da marca (`assets/`, `assets/brand/`).
2. ~~Notificações básicas.~~ **Concluído** — sino de notificações em toda tela (seguidas, curtidas e comentários), com contador de não lidas.
3. ~~Polimento visual (animações, splash screen customizada).~~ **Concluído** — splash screen animada customizada (`AnimatedSplash.tsx`), sistema de design compartilhado (`Motion`, `Typography`, `StatTile`, `ChipSelector`, `SectionTitle`, `EmptyState`, `Skeleton`, `SportIcon`, fonte Inter), microanimações e haptics em todas as telas, e ícones (Ionicons/SVG) no lugar de emojis em todo o app.

Os três itens da lista original foram concluídos. Ideias para continuar depois da entrega: retrofit dos últimos `Pressable` avulsos em telas já migradas (ex: cards de desafio do clube), e temas alternativos por clube/patente.
