<?php
declare(strict_types=1);

final class RadicadoHelpers
{
    public static function correoValido(string $v): bool
    {
        return (bool)preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $v);
    }

    public static function normalizarCc(string $v): string
    {
        return preg_replace('/[^0-9]/', '', $v) ?? '';
    }

    /**
     * Formato: {Dia}{YY}{mm}-{AREA}{NNNN}
     *   Dia   = inicial del dia de la semana (L Lunes, M Martes, X Miercoles, J Jueves, V Viernes, S Sabado, D Domingo)
     *   YY    = dos digitos del año (zona Bogota)
     *   mm    = minuto actual (00-59)
     *   AREA  = dos letras derivadas del nombre del area (sin acentos, mayuscula)
     *   NNNN  = consecutivo por area (rellenado a 4 con ceros), comienza en 0001
     *
     * Ejemplo: M2604-ES0001  (Martes 2026, minuto 04, area Estadistica, consecutivo 1)
     */
    public static function generarNumero(PDO $pdo, string $areaNombre = ''): string
    {
        // Zona horaria Bogota para reflejar dia/minuto local
        $tz = new DateTimeZone('America/Bogota');
        $now = new DateTime('now', $tz);
        $diaLetras = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // ISO 1..7
        $dayIdx = (int)$now->format('N') - 1;
        $dayLetter = $diaLetras[$dayIdx] ?? 'X';
        $yy = $now->format('y');
        $minute = $now->format('i');

        $areaCode = self::codigoArea($areaNombre);
        $prefijo = "{$dayLetter}{$yy}{$minute}-{$areaCode}";

        // Calcular siguiente consecutivo por area buscando el maximo actual.
        $likeArea = "_____-{$areaCode}____"; // 5 + 1 + 2 + 4 = 12 chars
        $maxStmt = $pdo->prepare(
            "SELECT COALESCE(MAX(CAST(SUBSTRING(numero_radicado, 9, 4) AS UNSIGNED)), 0) AS maxn
             FROM solicitudes WHERE numero_radicado LIKE :p"
        );
        $maxStmt->execute([':p' => $likeArea]);
        $maxN = (int)($maxStmt->fetch()['maxn'] ?? 0);

        for ($i = 1; $i <= 100; $i++) {
            $next = $maxN + $i;
            if ($next > 9999) {
                throw new RuntimeException('Consecutivo agotado para el area ' . $areaCode);
            }
            $candidato = $prefijo . str_pad((string)$next, 4, '0', STR_PAD_LEFT);
            $chk = $pdo->prepare(
                "SELECT 1 FROM radicados WHERE numero = :n1
                 UNION
                 SELECT 1 FROM solicitudes WHERE numero_radicado = :n2 LIMIT 1"
            );
            $chk->execute([':n1' => $candidato, ':n2' => $candidato]);
            if (!$chk->fetch()) return $candidato;
        }
        throw new RuntimeException('No fue posible generar un numero de radicado unico');
    }

    /**
     * Deriva un codigo de area de 2 letras desde el nombre del area.
     * - Quita acentos y normaliza a ASCII
     * - Toma las dos primeras letras alfanumericas
     * - Si no hay letras, retorna 'XX'
     */
    public static function codigoArea(string $nombre): string
    {
        $sin = strtr($nombre, [
            'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
            'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ü'=>'U','Ñ'=>'N',
        ]);
        $clean = preg_replace('/[^A-Za-z0-9]/', '', $sin) ?? '';
        $code = strtoupper(substr($clean, 0, 2));
        return $code !== '' ? str_pad($code, 2, 'X') : 'XX';
    }

    public static function generarReferenciaOps(PDO $pdo, string $cc): string
    {
        for ($i = 0; $i < 8; $i++) {
            $semilla = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
            $referencia = "OPS-CC-{$cc}-{$semilla}";
            $s = $pdo->prepare("SELECT id FROM radicados WHERE referencia = :r LIMIT 1");
            $s->execute([':r' => $referencia]);
            if (!$s->fetch()) return $referencia;
        }
        throw new RuntimeException('No fue posible generar una referencia OPS unica');
    }

    public static function resolverCorreos(PDO $pdo, ?array $destinatarios): array
    {
        if (!$destinatarios) return [];
        $out = [];
        foreach ($destinatarios as $raw) {
            $item = trim((string)$raw);
            if ($item === '') continue;
            if (self::correoValido($item)) {
                $out[strtolower($item)] = true;
                continue;
            }
            $s = $pdo->prepare(
                "SELECT correo FROM usuarios
                 WHERE LOWER(nombre_completo) = LOWER(:n) OR LOWER(correo) = LOWER(:c)
                 LIMIT 1"
            );
            $s->execute([':n' => $item, ':c' => $item]);
            $u = $s->fetch();
            if ($u && !empty($u['correo'])) {
                $out[strtolower($u['correo'])] = true;
            }
        }
        return array_keys($out);
    }
}
