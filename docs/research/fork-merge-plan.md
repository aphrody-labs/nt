# Forks + fusion : remplacer Git for Windows, MSYS2 et WSL (plan, 2026-11-12)

État des dépôts relevé le 2026-11-12 via `gh api` (langage, licence, dernier push). Mécanique existante réutilisée : `C:\src` (`src.lock.json`, `ay lock`, `ay git fork status|sync`, forks sous `aphrody-labs`).

## Ce que chaque fork remplace

| Rôle | Dépôt amont (push) | Licence | Remplace |
|---|---|---|---|
| Shell bash | unixwin/niubash (11-12), unixwin/rubash (11-12) | MIT | Git Bash / MSYS2 bash |
| Commandes Unix | microsoft/coreutils (10-22), uutils/coreutils, findutils, diffutils, sed (11-11/12) | MIT / Apache-2.0 | MSYS2 coreutils/findutils/diffutils/sed |
| Commandes complémentaires | unixwin/WinuxCmd (C++, 11-12) | MIT | reste de MSYS2 (awk, etc.) |
| git | microsoft/git (Scalar, 11-11) + recette MSVC unixwin/niu-git (GPL-2.0, 10-28) | GPL-2.0 | Git for Windows |
| Linux | microsoft/nvx (micro-VM Alpine/Ubuntu/Azure Linux sur OpenVMM, 11-12), microsoft/openvmm (11-12), microsoft/litebox (binaires Linux sur Windows, 11-12) | MIT | WSL2 (nvx) / WSL1 (litebox) |
| Isolation | hyperlight-dev/hyperlight, microsoft/mxc (11-12) | Apache-2.0 / MIT | — |
| Paquets / config | microsoft/winget-cli (C++, 11-12), PowerShell/DSC (Rust, 11-12) | MIT | scripts d'installation |
| pwsh | PowerShell/PowerShell (C#, 11-12) | MIT | conservé en fork (compatibilité scripts), plus appelé par défaut |
| Terminal | microsoft/terminal (11-11), microsoft/intelligent-terminal (fork avec agents, 11-12) | MIT | Windows Terminal |
| UI | microsoft/microsoft-ui-xaml, microsoft/WindowsAppSDK (11-12), microsoft/webui (Rust SSR, 11-12, déjà dans C:\src) | MIT | — |
| Outils | microsoft/edit, microsoft/sudo (Rust, 11-04/07) | MIT | nano/sudo MSYS |

## Étapes

1. Forks GitHub sous l'organisation choisie (côté serveur, aucun clone local).
2. Entrées dans `C:\src` (`third_party/<org>/<repo>`, sparse si > 100 Mo : WSL2-Linux-Kernel 2,9 Go, microsoft/git 416 Mo, microsoft-ui-xaml 489 Mo), `ay lock`, remotes `origin` = fork / `upstream` = amont, `ay git fork sync`.
3. File de patchs par fork (branche `aphrody/main`), CI de build Windows MSVC/Rust.
4. Distribution unique « shell » : niubash + coreutils + git MSVC + nvx, empaquetée et installée par `configuration/*.dsc.winget` + `tools.toml`.
5. Retrait de Git for Windows (désinstallation) quand `git` MSVC couvre gh, cargo, jj et les dépôts de `C:\src` (tests à écrire), puis de WSL quand nvx couvre les usages Linux (docker-desktop dépend de WSL : à traiter).

## Points de vigilance

- niu-git et microsoft/git sont GPL-2.0 : leurs forks restent GPL-2.0.
- Le build habituel de microsoft/git passe par le SDK Git for Windows (MSYS2) ; la recette niu-git (MSVC) est la voie sans MSYS — à prouver sur microsoft/git.
- Docker Desktop utilise la distribution WSL `docker-desktop` : retirer WSL casse Docker tant qu'un remplaçant n'est pas validé.
