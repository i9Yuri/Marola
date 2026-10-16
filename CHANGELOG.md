# Changelog - Marola

Todas as alterações notáveis neste projeto são documentadas neste arquivo.

## [Unreleased] - 2026-10-16

### 🚀 Desempenho & Renderização a 60 FPS
- **Análise Espectral Reativa com `AnalyserNode`:**
  - Instanciação de nó único com `fftSize = 128` (64 bins de frequência) e amortecimento de 0.8.
  - Alocação estática única do vetor de frequência `Uint8Array(64)` na inicialização, garantindo zero coletas de lixo (GC) no loop `requestAnimationFrame`.
  - Extração em tempo real de graves e sub-graves (20Hz a 160Hz) com amortecimento exponencial ($\alpha \approx 0.18$).
  - Modulação reativa física das ondas marinhas (`(1 + E_smooth * 1.4)`) e pulso da coroa solar (`--pulse` e `--halo`).
- **Isolamento de Camadas & Desacoplamento de Scroll:**
  - Aplicação de `contain: strict; content-visibility: auto; will-change: scroll-position;` em `.list`.
  - Camada acelerada por GPU (`transform: translateZ(0); will-change: transform;`) em `.sea canvas` e `.seek canvas`.
  - Cache dinâmico da altura do viewport (`cachedViewportHeight`), eliminando chamadas síncronas de medição de layout (`clientHeight`, `offsetHeight`) durante a rolagem.

### 🎧 Subsistema de Áudio & Topologia de Nós
- **Grafo Serial Estrito do Equalizador:**
  - Topologia encadeada em série:
    `AudioSourceNode -> InputGainNode -> Biquad[0..9] -> AnalyserNode -> OutputGainNode -> AudioContext.destination`.
  - Eliminação de duplicações de filtros e bypass destrutivo no frontend.
  - Implementação de atenuação e ganho suaves via `setTargetAtTime` para alternância de bypass (15ms) e alteração de bandas sem estalos acústicos.
- **Assinaturas Mandatórias Implementadas:**
  - `setupAudioPipeline(audioElement)`
  - `getFrequencyEnergy(): number`
  - `setBandGain(bandIndex, gainDb)`
  - `setMasterVolume(level)`
  - `setEqualizerBypass(bypass)`

### 📚 Catálogos, Capas & Top 100
- **Catálogo de Álbuns Memoizado:**
  - Pré-aquecimento do catálogo em memória `{ albumKey: { id, name, artist, trackCount, coverUri } }`.
  - Renderização puramente declarativa com `loading="lazy"` nas imagens.
- **Avatares Procedurais de Artistas:**
  - Geração de avatares com círculos harmônicos e tipografia em caixa alta contendo as iniciais estilizadas (ex.: "Noah And The Whale" $\to$ "NW").
- **Playlist do Sistema "As 100 Mais Tocadas":**
  - Consulta estrita com cláusula `playCount > 0` (`queryTopPlayedTracks()`).
  - Estado vazio contextual informativo caso nenhuma música tenha sido reproduzida ainda.
  - Badges ordinais estilizados (1º a 100º) na listagem das faixas.

### 🎛️ Ergonomia & Controles de Janela
- **Desobstrução do Slider de Volume:**
  - Configuração de `touch-action: none` em `.vol` e `#vol`.
  - Interrupção de propagação de ponteiros (`stopPropagation`) para isolar de listeners da doca.
  - Ajuste suave no ganho do `OutputGainNode` com tempo de subida de 5ms.
- **Estabilização da Titlebar no Linux:**
  - Configuração explícita de `-webkit-app-region: drag` e exclusões (`no-drag`) com cursores apropriados em botões, links, atalhos e busca.
- **Cinemática do Modal de Ajustes:**
  - Transições suaves orientadas a classes (`.modal-backdrop` e `.modal-window` com `.is-visible` e `.is-closing`).
  - Entrada com curva `cubic-bezier(0.16, 1, 0.3, 1)` (260ms) e saída reversa em 180ms com fechamento ao clicar fora.
