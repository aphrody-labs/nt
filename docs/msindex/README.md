# msindex : pile Microsoft indexée et prouvée sur ce poste

Généré le 2026-11-12 par `sdk/tools/msindex` (`just msindex <src>`), vérifiable par `just msindex-verify <src>`.
Machine : Windows 26H1 build 28120 (28000.7.amd64fre.br_release_flt.260716-1702). Index : `target/index/msindex.sqlite` (tables node, edge, proof, fts).

Empreinte du graphe : `1b9767a8e6b276d7c3766b9379880d9e815ab34b8112e7b7e5f66ec5db7976a1` ; des preuves : `8ce53b64fdda6ca36d74a0ab68705c1d85f1595776993e868f3c706c582bde95`.

## Sources

- Win32 + WDK + WinRT : Windows.Win32.winmd et Windows.winmd de windows-rs (2196dbbc27), Windows.Wdk.winmd (NuGet microsoft.windows.wdk.win32metadata 0.13.25-experimental, SHA-512 vérifié).
- Windows App SDK 2.6.5 : 11 paquets NuGet ; sources WindowsAppSDK et microsoft-ui-xaml (1723 types IDL, 17 fonctionnalités).
- .NET : .NET 10.0.15, .NET 11.0.0 (packs de référence et runtime partagé).
- windows-rs : 326 crates du monorepo nt.
- C/C++ : UCRT 10.0.26100.0 (1529 déclarations, 1257 exportées par ucrtbase.dll), 11 DLL CRT/STL, `import std` MSVC 14.52.37025 (894 noms).
- API Sets : schéma v6 du système, 989 contrats.

## Preuves

| contrôle | réussis | total | méthode |
|---|---|---|---|
| RoGetActivationFactory | 1820 | 1848 | fabrique obtenue (IID_IActivationFactory), classes en processus |
| activation-export | 1847 | 1848 | DllPath exporte DllGetActivationFactory |
| apiset-host | 857 | 989 | PEB->ApiSetMap : le contrat a une DLL hôte |
| dotnet-impl | 8262 | 8262 | type de référence défini (TypeDef) par le runtime partagé, redirections ExportedType suivies |
| loader | 16697 | 16806 | LoadLibraryExW(DONT_RESOLVE_DLL_REFERENCES) + GetProcAddress (processus enfant) |
| pe-export | 18409 | 18520 | contrat API Set résolu, nom présent dans la table d'exports PE de l'hôte |
| ucrtbase-export | 1257 | 1529 | déclaration _ACRTIMP exportée par ucrtbase.dll |
| wasdk-activation | 1665 | 1665 | appxfragment du paquet -> DLL du paquet exportant DllGetActivationFactory |
| winrt-registered | 1864 | 1891 | HKLM\SOFTWARE\Microsoft\WindowsRuntime\ActivatableClassId |

## Nœuds par type

- constant : 155908
- method : 107924
- field : 103326
- property : 48674
- struct : 32493
- function : 18520
- interface : 15749
- constructor : 10319
- class : 10195
- enum : 8463
- export : 4735
- delegate : 3780
- event : 2575
- cargo-feature : 1694
- c-function : 1529
- idl-runtimeclass : 1180
- apiset : 989
- namespace : 936
- std-export : 894
- header : 849
- attribute : 825
- assembly : 343
- idl-enum : 328
- crate : 326
- idl-interface : 171
- idl : 170
- component : 95
- idl-delegate : 65
- idl-gated : 49
- winmd : 40
- idl-apicontract : 25
- idl-struct : 24
- scope : 18
- feature : 17
- package : 11
- dll : 11
- source : 6
- repo : 2
- runtime : 2
- rdl-area : 2
- index : 1
- rdl : 1
- headers : 1
- module : 1
