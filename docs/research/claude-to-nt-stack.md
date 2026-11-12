# De Claude Code au noyau NT : couches, latences, leviers (2026-11-12)

Sources : binaire `claude.exe` 2.1.318 (lecture du code embarqué), doc Anthropic (code.claude.com, platform.claude.com — relevé par agent, URLs dans le rapport), Microsoft Learn (MCP on Windows, Windows AI security book, Policy CSP WindowsAI), GitHub (microsoft/*, vercel-labs/*), mesures hyperfine sur ce poste. Machine : `~/.claude/skills/windows-machine/profile.md`.

## 1. La chaîne, couche par couche

| # | Couche | Ce qui s'y passe | Preuve |
|---|---|---|---|
| 0 | Modèle (API Anthropic) | inférence, une décision par tour | — (hors poste) |
| 1 | `claude.exe` | exécutable autonome **Bun 1.4.4** (Windows x64, 342 Mo), outils lancés par `Bun.spawn` | chaîne `Bun v1.4.4 (Windows x64)` dans le binaire |
| 2a | Outil Bash | un processus par commande : `bash.exe -c "source <snapshot> && eval <cmd>"` ; snapshot créé à l'ouverture de session via `spawn(shell, ["-c","-l",script])` | code extrait du binaire ; agent shell |
| 2b | Outil PowerShell | `cmd.exe` → `chcp 65001` → `pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass` (désactivé ici : `CLAUDE_CODE_USE_POWERSHELL_TOOL=0`) | binaire + doc tools-reference |
| 2c | Serveurs MCP | stdio (processus persistant) ou HTTP ; préférés à la GUI par Claude (ordre documenté : MCP > Bash > Chrome > computer use) | doc computer-use |
| 2d | Claude in Chrome | `claude.exe` ↔ tube `\\.\pipe\claude-mcp-browser-bridge-<user>` ↔ hôte natif (`cmd.exe` → `.bat` → `claude.exe --chrome-native-host`) ↔ extension (`chrome.debugger`) | agent Chrome |
| 3 | Win32 / sous-systèmes | `CreateProcessW`, consoles (conhost/ConPTY), UI Automation (COM inter-processus), `SendInput`, Windows.Graphics.Capture | sources agent-desktop (`crates/windows`) |
| 4 | Sécurité | Defender (analyse de chaque nouveau processus), UIPI (intégrité), bureau sécurisé (UAC), VBS actif | profil machine ; skill agent-desktop |
| 5 | Noyau | `ntoskrnl` (processus, objets, ALPC), `win32k*.sys` dont `win32kbase_rs.sys` (Rust), DWM pour la composition | `rust-in-windows.md` |

## 2. Latences mesurées (ce poste, hyperfine)

| Opération | Coût |
|---|---|
| Démarrage niubash `-c exit` | 16,3 ms (Git Bash 19,2 ms, brush 8,4 ms) |
| Appel outil Bash de Claude (agent shell) | ~20 ms ; PowerShell ~185 ms (.NET) |
| Création de l'instantané de session (Git Bash, avant/après nettoyage) | 1 452 → 100 ms |
| `agent-desktop` lancement à vide | 10,8 ms |
| `list-windows` | 25,7 ms |
| Arbre UIA d'une fenêtre (Windows Terminal, 8 Ko JSON) | 91,9 ms |
| Capture PNG fenêtre / écran 2560x1440 | 335 / 317 ms |
| Capture via computer use API | 1 000–1 800 tokens d'entrée par image (doc Anthropic) |

Constat : à chaque action, le **tour de modèle** (inférence) domine de plusieurs ordres de grandeur ; côté poste, la GUI par capture d'écran est la voie la plus chère, l'arbre d'accessibilité ~3,5× moins cher et beaucoup moins de tokens.

## 3. Ce qui éloigne Claude du noyau (et le levier)

| Frein | Levier appliqué / proposé |
|---|---|
| Un processus par commande Bash, émulation `fork()` MSYS, arguments tronqués à ~8 186 caractères par Git Bash | **niubash** natif (fait), instantané réparé (fait), Coreutils Microsoft (fait) |
| PowerShell = démarrage .NET ~185 ms + `cmd.exe` intermédiaire | outil PowerShell désactivé (fait) |
| Pas de computer use dans Claude Code CLI sous Windows (macOS seulement) | **MCP persistant `agent-desktop mcp --headed`** (UIA + SendInput + WGC, 67 outils) et `agent-browser mcp`, enregistrés en scope user (fait) |
| Lancement d'un processus par action GUI | mode MCP : processus unique, plus de coût de lancement |
| Capture PNG pleine résolution (317 ms) | patch du fork `aphrody-labs/agent-desktop` : format/échelle configurables, réutilisation du frame pool (à faire) |
| Polling de l'interface | `wait --event` / `--wait-for` (événements UIA) au lieu de captures répétées |
| Aller-retours modèle | `desktop_batch` (plusieurs actions par tour) ; arbre d'accessibilité plutôt qu'images |
| Isolation Windows des agents (MCP ODR contenu, espace de travail agent) | activation par l'utilisateur seulement (section 4) |

## 4. Réglages qui relèvent de l'utilisateur (sécurité)

Je ne modifie pas ces réglages ; ils changent la posture de sécurité de la machine.

| Réglage | Chemin | Effet | Source |
|---|---|---|---|
| Fonctionnalités agentiques expérimentales | Paramètres > Système > Composants IA > Outils d'agent | compte agent, espace de travail agent ; condition de la surface MCP (`odr mcp list` répond aujourd'hui « MCP surface is not enabled ») | Learn, Windows security book (agentic security) |
| Réduire les protections des connecteurs d'agent | Paramètres > Système > Avancé > Composants IA | serveurs MCP non packagés hors conteneur (moins sûr) | Learn, MCP containment |
| Computer use de Claude Desktop | Claude Desktop > Settings > This computer | contrôle GUI natif par Anthropic sous Windows (préversion, plans Pro/Max/Ultra) | doc Anthropic desktop |
| UAC / bureau sécurisé | — | aucun agent (y compris agent-desktop) ne pilote le bureau sécurisé ; laisser tel quel | skill agent-desktop |
