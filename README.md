# Marola Player 🌅🌊

Player de música desktop offline imersivo para Linux (Nobara / Fedora-based), construído sob a arquitetura e conceito visual **"Sunset & Sea"**. A faixa em reprodução transforma a cena em um pôr do sol dinâmico: a capa do álbum torna-se o sol no disco de vinil giratório, o oceano abaixo reage ao ritmo e intensidade sonora através de superposição de ondas senoidais em Canvas, e toda a paleta cromática transiciona fluidamente com interpolação linear (lerp) a cada nova faixa.

---

## 🚀 Funcionalidades Principais

- **Conceito Visual "Sunset & Sea" & Performance 60 FPS:**
  - **Cena Central Imersiva:** Pôr do sol dinâmico com iluminação harmônica (`--sky0`, `--sky1`, `--sky2`, `--sun-rgb`, `--sea0`, `--sea1`, `--accent`).
  - **Disco de Vinil / Sol:** Capa da faixa embutida (com cache de Blob URLs e revogação sem vazamentos de memória) ou gerador procedural vetorial de gradientes (anéis, pontos, diagonais, listras, cônico) com ranhuras táteis e pulso sincronizado com a energia da música.
  - **Oceano Reativo em Canvas 2D (`#sea`):** Análise espectral física em tempo real via Web Audio API (`AnalyserNode`, `fftSize = 128`), extraindo graves e sub-graves (20Hz a 160Hz) com buffer fixo pré-alocado `Uint8Array(64)` (zero alocações no RAF). A energia modulada por amortecimento exponencial ($\alpha \approx 0.18$) amplifica diretamente a amplitude das ondas marítimas por $(1 + E_{smooth} \cdot 1.4)$ e pulso solar com consumo residual de GPU.
  - **Seekbar Ondular em Canvas 2D (`#seekc`):** Linha tracejada e onda senoidal modulada pela posição atual com playhead circular e tooltip de minutagem em tempo real em camada de composição GPU acelerada (`transform: translateZ(0)`).
  - **Doca Flutuante de Controles:** Barra de comando com efeito `backdrop-filter: blur(16px) saturate(1.25)`. Slider de volume desobstruído com `touch-action: none`, isolamento de ponteiros (`stopPropagation`) e subida suave de 5ms.
  - **Virtualização Nativa da Coleção (60 FPS Contínuos):** Virtual scrolling de alta performance para centenas ou milhares de músicas com estrito isolamento de layout (`contain: strict; content-visibility: auto; will-change: scroll-position;`), eliminando repaints do Canvas durante a rolagem rápida através de cache estático de altura do viewport.
  - **Grafo Serial Estrito do Equalizador & Bypass Sem Ruídos:** Topologia sequencial mandatória (`AudioSourceNode -> InputGainNode -> Biquad[0..9] -> AnalyserNode -> OutputGainNode -> AudioContext.destination`). Desativação do equalizador aplica rampa de atenuação rápida de 15ms sem desconectar o fluxo de áudio, eliminando estouros ou cliques e mantendo o `AnalyserNode` permanentemente alimentado.

- **Janela Frameless & Integração Desktop Linux:**
  - **Modo Frameless Nativo (`frame: false`):** Eliminação de barras de janela duplas em desktops Linux (Nobara, Fedora, KDE Plasma, GNOME, etc.).
  - **Titlebar Totalmente Arrastável:** Suporte a `-webkit-app-region: drag` com exclusão precisa (`no-drag`) e cursores de interação apropriados (`cursor: pointer` / `cursor: text`) para botões, caixa de busca e atalhos.
  - **Ações de Janela via IPC:** Minimizar, maximizar/restaurar e fechar integrados diretamente à janela do Electron.

- **Navegação Desacoplada & Catálogos no Palco Central:**
  - **Palco Central Dedicado (`#catalog-stage`):** Visões de Álbuns, Artistas e Playlists são renderizadas no espaço central substituindo temporariamente a cena do pôr do sol, preservando o painel lateral da direita (`.panel`) intacto para Músicas, Fila e Equalizador.
  - **Catálogo de Álbuns Memoizado:** Indexação sob demanda em memória `{ albumKey: { title, artist, year, count, coverUri } }` com renderização puramente declarativa e imagens com `loading="lazy"`.
  - **Avatares Procedurais de Artistas:** Desenho automático de círculos com gradiente suave da paleta e iniciais em caixa alta (ex.: "Noah And The Whale" $\to$ "NW") quando não houver foto cadastrada.
  - **Playlist do Sistema "As 100 Mais Tocadas":** Filtro estrito de faixas com `playCount > 0` ordenadas por execuções e data, exibição de badges ordinais (1º a 100º) e estado vazio contextual quando nenhuma faixa foi ouvida ainda.
  - **Cinemática Suave do Modal de Ajustes:** Abertura com interpolação `cubic-bezier(0.16, 1, 0.3, 1)` (260ms), backdrop com fade linear (220ms) e saída reversa suave de 180ms com fechamento ao clicar fora.

- **Gerenciador de Pastas Unificado em Ajustes:**
  - **Gestão Centralizada:** Adição, remoção e reindexação de diretórios de música locais unificados no modal de Ajustes.
  - **Contagem de Faixas Precisa:** Cálculo em tempo real do total de músicas por pasta via correspondência de prefixo de caminhos normalizados.
  - **Fechamento Ergonômico de Modais:** Fechamento suave com animação fade/scale ao clicar fora do cartão (backdrop) ou pressionar <kbd>Esc</kbd>.

- **Seletor Real de Dispositivos de Saída de Áudio (Audio Output Sink):**
  - Dropdown dinâmico integrado à aba de Som enumerando dispositivos reais de saída (`audiooutput`).
  - Suporte completo a `setSinkId()` e ouvinte automático de conexões de hardware (`devicechange`).

- **Temas Expandidos & Matiz Ambiental:**
  - **Tema AMOLED Puro (`[data-theme="amoled"]`):** Fundo preto absoluto (`#000000`) para telas OLED.
  - **Matiz Ambiental Dinâmica:** Superfícies escuras harmonizadas suavemente com a cor de acento em reprodução.
  - **Seletor de Cores de Acento:** Botão circular com gradiente cônico dinâmico (zero emojis) como primeira opção, além de paletas fixas.

- **Motor de Áudio Dual-Deck (Deck A / Deck B):**
  - Transição contínua entre faixas via Web Audio API.
  - Crossfade em tempo real configurável de 0s a 12s (padrão: 3s).
  - Rampa suave de atenuação e ganho mútuo sem engasgos ou cliques.
  - Suporte a seleção de dispositivo de saída de áudio (Audio Output Sink).

- **Fila & Modos de Reprodução:**
  - Gerenciamento dinâmico de fila com remoção granular e contagem de tempo restante.
  - Modos: Sequencial, Repetir Lista (`repeat-all`), Repetir Faixa (`repeat-one`) e Aleatório (`shuffle` sem repetições imediatas).

- **🎵 Formatos de Áudio Suportados:**
  O Marola suporta reprodução nativa offline e extração de metadados para:
  - **FLAC** (`.flac`) - Áudio Lossless de alta fidelidade
  - **MP3** (`.mp3`) - Tags ID3v1, ID3v2.3 e ID3v2.4
  - **Opus** (`.opus`) - Codec moderno de alta eficiência de compressão
  - **WAV** (`.wav`) - Áudio PCM sem compressão
  - **M4A / AAC** (`.m4a`, `.aac`) - Contêineres padrão MP4 com capas embutidas
  - **OGG** (`.ogg`) - Contêineres Ogg Vorbis
  - Sincronização de letras em tempo real via arquivos `.lrc` ou tags embutidas (USLT/SYLT).

- **Cinemática & Diretrizes do Indicador Fluido de Abas (.tab-indicator):**
  - **Trilho Desacoplado Vetorial:** Indicador único independente montado no contêiner `.tabs`, eliminando pseudo-elementos estáticos `::after`.
  - **Interpolação Espacial & Aceleração:** Coordenadas calculadas via `offsetLeft` e `offsetWidth` com transição exclusiva acelerada por hardware (`transform: translateX(...)` e `width`) em curva cúbica natural `cubic-bezier(0.2, 0.8, 0.2, 1)` (300ms).
  - **Navegação Ondulada da Máscara SVG (`--wavemask`):** Deslocamento dinâmico no eixo horizontal (`mask-position-x`) sincronizado com o sentido do deslocamento, gerando a ilusão de água em trânsito náutico.
  - **Acessibilidade & Responsividade:** Observador dimensional `ResizeObserver` para recalibração em redimensionamento de janela, alternância via teclas <kbd>→</kbd> / <kbd>←</kbd> e chaveamento instantâneo sob `prefers-reduced-motion: reduce`.

---

## 🛠️ Requisitos de Sistema (Linux Nobara / Fedora)

- **Node.js:** v18 ou superior (testado com Node.js v22.x)
- **npm:** v9 ou superior
- **Ambiente Gráfico:** Wayland ou X11 com ALSA / PipeWire / PulseAudio

---

## 📦 Instalação & Execução

Clone o repositório e acesse o diretório:
```bash
git clone https://github.com/i9Yuri/JustPlay.git
cd JustPlay
```

Instale as dependências:
```bash
npm install
```

Inicie o Marola:
```bash
npm start
```

### ⚡ Inicialização Rápida (Duplo Clique / Desktop)

Para testes interativos imediatos no ambiente desktop Linux sem necessidade de digitação em terminal:
- **Gerenciador de Arquivos (Dolphin / Nautilus / Thunar):** execute com duplo clique o script `run-dev.sh` ou o atalho `JustPlay-Dev.desktop`.
- **Terminal:** execute `./run-dev.sh`.
- O launcher gerencia encerramento gracioso de subprocessos, previne sobreposição de instâncias concorrentes via lockfile e valida dependências locais com alertas visuais no desktop.

---

## ⌨️ Atalhos de Teclado Globais

| Atalho | Ação |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Focar imediatamente a barra de busca rápida |
| <kbd>Space</kbd> | Alternar entre Tocar e Pausar |
| <kbd>N</kbd> | Avançar para a próxima faixa |
| <kbd>P</kbd> | Voltar para a faixa anterior / reiniciar faixa |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Ajuste fino de ganho em dB na banda selecionada do equalizador |

---

## 🧪 Testes Automatizados

Para rodar a suite completa de testes unitários e de integração E2E:
```bash
npm test
```

Para gerar arquivos de áudio de teste com senoides (.wav) e letras sincronizadas (.lrc):
```bash
node test/generate_sample_audio.js
```
Os arquivos serão gerados na pasta `sample_music/` e podem ser indexados diretamente no player acessando **Ajustes ⚙️ > Gerenciar Pastas de Música**.
