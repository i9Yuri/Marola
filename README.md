# JustPlay 🎵

Player de música desktop offline funcional para Linux (Nobara / Fedora-based), focado em usabilidade direta, fila de reprodução estável, persistência local de estatísticas e playlists, e transição de áudio com crossfade ajustável em tempo real.

---

## 🚀 Funcionalidades Principais

- **Motor de Áudio Dual-Deck (Deck A / Deck B):**
  - Transição contínua entre faixas via Web Audio API.
  - Crossfade em tempo real configurável via slider de 0s a 12s (padrão: 3s).
  - Rampa suave de atenuação e ganho mútuo sem engasgos ou cliques.
- **Fila & Modos de Reprodução:**
  - Gerenciamento dinâmico de fila: adicionar ao final, remover faixa e reordenar posições (subir/descer).
  - Modos: Sequencial, Repetir Lista (`repeat-all`), Repetir Faixa (`repeat-one`) e Aleatório (`shuffle` sem repetições imediatas).
- **Extração de Metadados & Letras:**
  - Suporte a `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a` via `music-metadata`.
  - Capas de álbuns embutidas decodificadas e exibidas diretamente.
  - Sincronização de letras em tempo real via arquivos `.lrc`同名 ou tags embutidas (USLT/SYLT) com autoscroll e destaque da estrofe corrente.
- **Persistência & Métricas (Top Tracks):**
  - Armazenamento atômico local em JSON (`userData/justplay_db.json`).
  - Registro de contagem de execuções (`play_count`) e timestamp (`last_played_at`) ao atingir pelo menos 50% de execução de cada faixa.
  - Ranking dinâmico "Mais Tocadas" ordenado estritamente por `play_count DESC`.
  - CRUD completo de Playlists com ordenação personalizada (alfabética, data de criação ou manual) e ordenação interna de faixas.
- **Interface Slate/Zinc:**
  - Design sóbrio, dark e moderno focado em legibilidade (tons de ardósia e acentos em azul-aço).

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

Inicie o player:
```bash
npm start
```

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
Os arquivos serão gerados na pasta `sample_music/` e podem ser abertos diretamente no player clicando em "Adicionar Pasta".
