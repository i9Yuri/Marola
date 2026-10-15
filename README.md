# Marola 🌅🌊

Player de música desktop offline imersivo para Linux (Nobara / Fedora-based), construído sob a arquitetura e conceito visual **"Sunset & Sea"**. A faixa em reprodução transforma a cena em um pôr do sol dinâmico: a capa do álbum torna-se o sol no disco de vinil giratório, o oceano abaixo reage ao ritmo e intensidade sonora através de superposição de ondas senoidais em Canvas, e toda a paleta cromática transiciona fluidamente com interpolação linear (lerp) a cada nova faixa.

---

## 🚀 Funcionalidades Principais

- **Conceito Visual "Sunset & Sea":**
  - **Cena Central Imersiva:** Pôr do sol dinâmico com iluminação harmônica (`--sky0`, `--sky1`, `--sky2`, `--sun-rgb`, `--sea0`, `--sea1`, `--accent`).
  - **Disco de Vinil / Sol:** Capa da faixa embutida ou gerador procedural vetorial de gradientes (anéis, pontos, diagonais, listras, cônico) com ranhuras táteis e pulso sincronizado com a energia da música.
  - **Oceano em Canvas 2D (`#sea`):** Algoritmo de superposição de ondas senoidais multi-camadas com reflexo pontilhado da luz solar na água ponderado por BPM e ritmo, com suporte nativo a `prefers-reduced-motion`.
  - **Seekbar Ondular em Canvas 2D (`#seekc`):** Linha tracejada e onda senoidal modulada pela posição atual com playhead circular e tooltip de minutagem em tempo real.
  - **Doca Flutuante de Controles:** Barra de comando com efeito `backdrop-filter: blur(16px) saturate(1.25)`.
  - **Equalizador Gráfico de 10 Bandas (Som):** Curva cúbica Bézier de 40Hz a 16kHz, ajuste de ganhos de -12dB a +12dB via arraste e teclado, presets dedicados (Cinema/Phonk, Graves fortes, Voz clara, Sunset & Sea) e nós biquad reais no pipeline de áudio.

- **Motor de Áudio Dual-Deck (Deck A / Deck B):**
  - Transição contínua entre faixas via Web Audio API.
  - Crossfade em tempo real configurável de 0s a 12s (padrão: 3s).
  - Rampa suave de atenuação e ganho mútuo sem engasgos ou cliques.
  - Suporte a seleção de dispositivo de saída de áudio (Audio Output Sink).

- **Fila & Modos de Reprodução:**
  - Gerenciamento dinâmico de fila com remoção granular e contagem de tempo restante.
  - Modos: Sequencial, Repetir Lista (`repeat-all`), Repetir Faixa (`repeat-one`) e Aleatório (`shuffle` sem repetições imediatas).

- **Extração de Metadados & Letras:**
  - Suporte a `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a`, `.opus`, `.aac` via `music-metadata`.
  - Capas de álbuns embutidas decodificadas e exibidas diretamente.
  - Sincronização de letras em tempo real via arquivos `.lrc` ou tags embutidas (USLT/SYLT).

- **Persistência & Métricas (Top Tracks):**
  - Armazenamento atômico local em JSON (`userData/justplay_db.json`).
  - Registro de contagem de execuções (`play_count`) e timestamp (`last_played_at`) ao atingir pelo menos 50% de execução de cada faixa.
  - Ranking dinâmico "Mais Tocadas" ordenado estritamente por `play_count DESC`.
  - CRUD completo de Playlists com ordenação personalizada.

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
Os arquivos serão gerados na pasta `sample_music/` e podem ser abertos diretamente no player clicando em "Vitrola" (Adicionar Pasta).
