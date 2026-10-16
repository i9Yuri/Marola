# Changelog

Todas as alterações notáveis neste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-10-16

### Adicionado
- **Lançador Rápido por Duplo Clique (`run-dev.sh`):** Ponto de entrada executável na raiz com validações visuais de dependências, gerenciamento de subprocessos e launcher XDG (`JustPlay-Dev.desktop`) para execução em desenvolvimento sem terminal.
- **Janela Frameless Nativa no Linux:** Modo `frame: false` com barra de título personalizada e estabilização de arraste via `-webkit-app-region: drag`, com exclusões interativas (`no-drag`) e cursores contextuais.
- **Seletor Real de Dispositivos de Áudio (Audio Output Sink):** Dropdown dinâmico na aba Som enumerando dispositivos físicos de saída (`audiooutput`), integração com `setSinkId()` e ouvinte automático de conexões de hardware (`devicechange`).
- **Playlist do Sistema "As 100 Mais Tocadas":** Filtro estrito de faixas com execuções registradas (`playCount > 0`), contagem atômica de reproduções, badges ordinais (1º a 100º) e estado vazio contextual.
- **Tema AMOLED Puro & Matiz Ambiental:** Suporte a `[data-theme="amoled"]` com pretos absolutos (`#000000`) para telas OLED e superfícies harmonizadas dinamicamente à cor de acento da faixa em reprodução.
- **Análise Espectral Reativa com `AnalyserNode`:** Conexão direta no grafo de áudio com `fftSize = 128` (64 bins) e amortecimento de 0.8, com buffer estático `Uint8Array(64)` (zero GC no RAF). Modulação física em tempo real das ondas do mar (`#sea`) por $(1 + E_{smooth} \cdot 1.4)$ e pulso solar.
- **Avatares Procedurais de Artistas:** Geração automática em Canvas de avatares circulares com gradiente suave e iniciais em caixa alta para artistas sem arte de capa cadastrada.

### Modificado
- **Reconstrução Estética Completa "Sunset & Sea":** Transposição e integração do novo design de interface inspirado no pôr do sol à beira-mar, com transição contínua de paletas cromáticas entre faixas via interpolação linear (lerp).
- **Gerenciador de Pastas Unificado em Ajustes:** Centralização da adição, remoção e reindexação de diretórios locais de música dentro do modal de Ajustes, eliminando a redundância da Vitrola no menu lateral.
- **Normalização dos Presets do Equalizador:** Substituição de perfis experimentais por curvas acústicas convencionais de 10 bandas (Flat, Bass Boost, Treble Boost, Rock, Pop, Jazz, Classical, Dance, Acoustic, Electronic).
- **Seletor de Cores de Acento Aprimorado:** Inclusão de botão dinâmico de gradiente cônico sem emojis como primeira opção de destaque cromático.
- **Catálogo de Álbuns Memoizado:** Indexação e cache em memória com renderização declarativa e carregamento assíncrono sob demanda via `loading="lazy"`.
- **Indicador Fluido de Abas (.tab-indicator):** Trilho vetorial desacoplado montado sobre o cabeçalho de abas, animado por hardware com aceleração `cubic-bezier(0.2, 0.8, 0.2, 1)` e máscara ondulada SVG (`--wavemask`).

### Corrigido
- **Gargalos de Queda de FPS e Congelamento de Animação:** Implementação de virtualização nativa de faixas e isolamento estrito de layout (`contain: strict; content-visibility: auto; will-change: scroll-position;`), eliminando repaints do Canvas durante a rolagem de bibliotecas densas e sustentando 60 FPS contínuos.
- **Desacoplamento e Estabilização do Grafo de Áudio:** Grafo serial obrigatório (`AudioSourceNode -> InputGainNode -> Biquad[0..9] -> AnalyserNode -> OutputGainNode -> AudioContext.destination`) com rampas de ganho suaves (15ms) via `setTargetAtTime` na alternância de bypass e controle de volume, eliminando cliques acústicos e mantendo o espectro visual ativo.
- **Dessincronização na Contagem de Faixas por Pasta:** Cálculo atômico baseado em correspondência de prefixo de caminhos normalizados, garantindo exatidão na contagem da biblioteca.
- **Margens e Limites da Seekbar Ondular:** Correção no cálculo de bounding box e raio do playhead circular, eliminando cortes geométricos nas extremidades (0:00 e término).
- **Fluidez e Isolamento do Controle Deslizante de Volume:** Aplicação de `touch-action: none` e contenção de propagação de eventos de ponteiro (`stopPropagation`), desobstruindo o arraste horizontal do controle na doca inferior.
- **Prevenção de Sobreposição de Telas:** Correção nos estados de visibilidade e z-index entre navegação de playlists, palco central e equalizador.
