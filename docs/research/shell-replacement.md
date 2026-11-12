# Remplacer Git Bash et pwsh — recherche et preuves (2026-11-12)

Sources : binaire `claude.exe` 2.1.318 (`~/.local/bin`), GitHub (MCP + `gh api`), Microsoft Learn (MCP), Context7 (`/unixwin/niubash`), essais sur le poste. Aucune affirmation de mémoire.

## 1. Ce que Claude Code exige (preuve : code extrait de `claude.exe`)

- Windows : l'outil Bash utilise `CLAUDE_CODE_GIT_BASH_PATH` **seulement si** son nom de fichier est `bash.exe`, `sh.exe`, `bash` ou `sh` ; sinon recherche de Git Bash (`C:\Program Files\Git\bin\bash.exe`, puis le `git` du PATH). Sans bash : outil Bash indisponible.
- Instantané de shell lancé par `spawn(shell, ["-c", "-l", script])` ; le script utilise `declare -F`, `compgen -v`, `shopt -s expand_aliases`, `unalias -a`, `\builtin eval`.
- `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` désactive l'outil PowerShell (message d'erreur explicite si aucun bash n'est trouvé).

## 2. Défaut trouvé : instantané tronqué

Les 3 instantanés `~/.claude/shell-snapshots/snapshot-bash-*.sh` font exactement 70 927 octets et s'arrêtent au milieu de `export PATH='…` (ligne 203). `bash -c 'source …'` → `unexpected EOF`, rc=2 : le PATH sauvegardé n'est jamais réappliqué. PATH courant : 4 365 caractères, 87 entrées. → nettoyage du PATH requis quel que soit le shell.

## 3. Candidats bash

| Candidat | Version | Preuve | Verdict |
|---|---|---|---|
| **niubash** (unixwin, MIT, Rust ; moteur rubash) | v1.5.0 (2026-11-03), `winget Unixwin.Niubash`, zip portable + `SHA256SUMS` | SHA256 OK ; imports PE sans `msys-2.0.dll`/`cygwin1.dll` (dumpbin) ; `git.exe` niu-git importe `VCRUNTIME140` (MSVC) ; **test bout-en-bout `claude -p` réussi** : `SHELL=…\winuxcmd\bin\bash.exe`, `BASH_VERSION=5.3.20(1)-release` | **retenu** |
| brush (reubeno, MIT, Rust) | 0.4.0 installé (2026-05-03) | test `claude -p` **échoue** : `a value is required for '-c <COMMAND>'` ; corrigé par PR #1398 (`d220c79d`, 2026-09-22), **non publié** (383 commits depuis 0.4.0) | secours : build `main` épinglé |
| Git Bash (Git for Windows) | — | MSYS, interdit par l'utilisateur | à retirer |

Rapport tiers (brush#1296) : suite GNU Bash `.tests` (83 fichiers) sous Windows, brush 5/83 correspondances sémantiques — non vérifié localement.

## 4. Utilitaires POSIX/GNU

| Ensemble | Langage | Statut |
|---|---|---|
| **Coreutils for Windows** (`microsoft/coreutils`, `winget Microsoft.Coreutils`) : uutils coreutils + findutils + grep, multi-call | Rust | documenté sur Learn (`learn.microsoft.com/windows/core-utils/overview`), preview |
| WinuxCmd (embarqué par niubash, `winuxcmd.exe` + liens) | C++ majoritaire | fourni avec niubash ; à placer **après** Coreutils dans le PATH |
| sudo, curl, tar, Edit | — | intégrés à Windows 11 (Learn) |
| `gawk` embarqué par niubash | C (GNU) | seul composant non Rust/non MS du shell |

## 5. pwsh

Pas de remplaçant « drop-in » : pwsh est un langage .NET distinct. Remplacement par usage :
- Claude : outil PowerShell désactivé (`CLAUDE_CODE_USE_POWERSHELL_TOOL=0`), tout passe par niubash.
- Windows Terminal : profil par défaut niubash (`niu --install-wt-profile --set-default`, Context7).
- `justfile` (`src`, `nt`) : `windows-shell` pwsh → niubash, après test de chaque recette.
- Windows PowerShell 5.1 reste (composant système) ; pwsh 7 reste installé mais n'est plus appelé.

## 6. Reproductibilité

- Microsoft : **WinGet Configuration** (YAML, `winget configure -f`) — mécanisme documenté sur Learn pour une installation répétable.
- Monorepo `src` : `tools.toml` + `ay up` (sources `github` avec checksum). **Bloquant** : le `ay` 0.2.0 installé ne lit plus `tools.toml` (`unknown variant "ubi"`) et sa recompilation depuis `src/crates/ay` a échoué (`failed to compile aphrody v0.2.0`, cause non encore analysée).
