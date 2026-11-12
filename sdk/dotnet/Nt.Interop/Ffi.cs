// Marqueurs lus par sdk/tools/dotnet-ffi/model.ts dans les métadonnées (par nom simple) ; sans effet à l'exécution.
namespace Nt.Interop.Ffi;

/// <summary>Paramètre <c>byte*</c> : chaîne UTF-8 terminée par NUL (bun:ffi <c>cstring</c>) ; champ : tampon fixe UTF-8.</summary>
[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Field)]
public sealed class Utf8Attribute : Attribute
{
}

/// <summary>Paramètre <c>char*</c> : chaîne UTF-16 terminée par NUL ; champ : tampon fixe UTF-16.</summary>
[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Field)]
public sealed class Utf16Attribute : Attribute
{
}

/// <summary>Tampon de sortie UTF-8 suivi d'un <c>int</c> capacité ; la méthode renvoie la longueur en octets (hors NUL).</summary>
[AttributeUsage(AttributeTargets.Parameter)]
public sealed class Utf8BufferAttribute : Attribute
{
}

/// <summary>Tampon de sortie UTF-16 suivi d'un <c>int</c> capacité ; la méthode renvoie la longueur en unités (hors NUL).</summary>
[AttributeUsage(AttributeTargets.Parameter)]
public sealed class Utf16BufferAttribute : Attribute
{
}
