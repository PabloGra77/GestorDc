<?php
declare(strict_types=1);

/** Persistencia de lotes de pago — Portal de Pagos. */
final class PagosLote
{
    public const MAX_PAGOS = 5000;

    /** Carpeta de almacenamiento de archivos generados, fuera del alcance web directo. */
    public static function storageDir(): string
    {
        $dir = dirname(__DIR__, 2) . '/storage/pagos';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        return $dir;
    }

    public static function crear(int $empresaId, string $descripcion, string $fecha): int
    {
        $ref = PagosTexto::referencia();
        $id = PagosDb::insertar(
            'INSERT INTO pagos_lotes (referencia, empresa_id, usuario_id, descripcion, fecha_proceso, estado)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$ref, $empresaId, PagosAuth::id(), PagosTexto::nombre($descripcion, 180), $fecha, 'borrador']
        );
        PagosAudit::registrar('lote.creado', 'lote', (string) $id, ['referencia' => $ref]);
        return $id;
    }

    public static function obtener(int $id): ?array
    {
        return PagosDb::uno(
            'SELECT l.*, e.nombre AS empresa_nombre, e.identificacion, e.tipo_identificacion,
                    e.cuenta_origen, e.tipo_cuenta, u.nombre_completo AS autor
               FROM pagos_lotes l
               JOIN pagos_empresas e ON e.id = l.empresa_id
               JOIN usuarios u ON u.id = l.usuario_id
              WHERE l.id = ?', [$id]);
    }

    public static function pagos(int $loteId): array
    {
        return PagosDb::todos(
            'SELECT * FROM pagos_lote_detalle WHERE lote_id = ? ORDER BY orden', [$loteId]);
    }

    /** Reemplaza por completo el detalle del lote. */
    public static function guardarPagos(int $loteId, array $pagos): void
    {
        if (count($pagos) > self::MAX_PAGOS) {
            throw new RuntimeException('El lote no puede superar ' . self::MAX_PAGOS . ' pagos.');
        }
        foreach ($pagos as $p) {
            if (!is_array($p)) {
                throw new RuntimeException('La estructura de pagos recibida no es válida.');
            }
        }

        PagosDb::transaccion(static function () use ($loteId, $pagos): void {
            PagosDb::ejecutar('DELETE FROM pagos_lote_detalle WHERE lote_id = ?', [$loteId]);

            $sql = 'INSERT INTO pagos_lote_detalle
                    (lote_id, orden, fila_origen, identificacion, tipo_identificacion,
                     producto_destino, tipo_producto, codigo_banco, valor, beneficiario, banco_manual)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)';
            $st = PagosDb::conexion()->prepare($sql);

            $totalCentavos = 0;
            foreach (array_values($pagos) as $i => $p) {
                $centavos = PagosDinero::desdeTexto((string) ($p['valor'] ?? '')) ?? 0;
                $valor = PagosDinero::aDecimal($centavos);
                $totalCentavos += $centavos;
                $st->execute([
                    $loteId,
                    $i + 1,
                    $p['fila_origen'] ?? null,
                    mb_substr((string) ($p['identificacion'] ?? ''), 0, 16),
                    mb_substr((string) ($p['tipo_identificacion'] ?? ''), 0, 2),
                    mb_substr((string) ($p['producto_destino'] ?? ''), 0, 32),
                    mb_substr(strtoupper((string) ($p['tipo_producto'] ?? '')), 0, 2),
                    mb_substr((string) ($p['codigo_banco'] ?? ''), 0, 6),
                    $valor,
                    PagosTexto::nombre((string) ($p['beneficiario'] ?? '')),
                    !empty($p['banco_manual']) ? 1 : 0,
                ]);
            }

            PagosDb::ejecutar(
                'UPDATE pagos_lotes SET cantidad_pagos = ?, valor_total = ? WHERE id = ?',
                [count($pagos), PagosDinero::aDecimal($totalCentavos), $loteId]
            );
        });
    }

    public static function cambiarEstado(int $loteId, string $estado): void
    {
        PagosDb::ejecutar('UPDATE pagos_lotes SET estado = ? WHERE id = ?', [$estado, $loteId]);
    }

    /**
     * Borra el lote por completo: el registro, sus pagos (cascada) y los
     * archivos generados (.txt/.csv/.zip, incluidas versiones anteriores de
     * una reapertura). Solo admin. Queda un registro en auditoría con una
     * foto del lote antes de borrarlo — es lo único que sobrevive.
     * @return array{ok:bool, mensaje:string}
     */
    public static function eliminar(int $loteId, string $motivo): array
    {
        if (trim($motivo) === '') {
            return ['ok' => false, 'mensaje' => 'Escriba el motivo de la eliminación.'];
        }
        $lote = self::obtener($loteId);
        if (!$lote) {
            return ['ok' => false, 'mensaje' => 'El lote no existe.'];
        }

        PagosAudit::registrar('lote.eliminado', 'lote', (string) $loteId, [
            'motivo'         => $motivo,
            'referencia'     => $lote['referencia'],
            'empresa'        => $lote['empresa_nombre'],
            'descripcion'    => $lote['descripcion'],
            'estado'         => $lote['estado'],
            'cantidad_pagos' => $lote['cantidad_pagos'],
            'valor_total'    => $lote['valor_total'],
            'archivo_nombre' => $lote['archivo_nombre'],
            'sha256'         => $lote['archivo_sha256'],
            'sha256_zip'     => $lote['archivo_zip_sha256'],
            'generado_por'   => $lote['generado_por'],
            'generado_en'    => $lote['generado_en'],
        ]);

        PagosDb::ejecutar('DELETE FROM pagos_lotes WHERE id = ?', [$loteId]);

        foreach (glob(self::storageDir() . '/' . $loteId . '.*') ?: [] as $archivo) {
            @unlink($archivo);
        }
        foreach (glob(self::storageDir() . '/' . $loteId . '_v*.*') ?: [] as $archivo) {
            @unlink($archivo);
        }

        return ['ok' => true, 'mensaje' => 'Lote ' . $lote['referencia'] . ' eliminado.'];
    }

    /**
     * Genera el archivo, lo guarda en storage y marca el lote.
     * @return array{ok:bool, mensaje:string, contenido?:string, nombre?:string}
     */
    public static function generarArchivo(int $loteId, int $maxLenCuenta): array
    {
        $lote  = self::obtener($loteId);
        if (!$lote) {
            return ['ok' => false, 'mensaje' => 'El lote no existe.'];
        }
        if ($lote['estado'] === 'generado') {
            return ['ok' => false, 'mensaje' => 'Este lote ya fue generado. Cree uno nuevo o anúlelo.'];
        }
        if ($lote['estado'] === 'anulado') {
            return ['ok' => false, 'mensaje' => 'El lote está anulado.'];
        }

        $pagos = self::pagos($loteId);
        $validador = new PagosValidador($maxLenCuenta);
        $hallazgos = $validador->validarLote($lote, $pagos);

        if (!PagosValidador::esValido($hallazgos)) {
            return ['ok' => false, 'mensaje' =>
                'El lote tiene ' . count(PagosValidador::errores($hallazgos))
                . ' errores. Corríjalos antes de generar el archivo.'];
        }

        try {
            $contenido    = PagosPlano::generar($lote, $pagos, $lote['fecha_proceso']);
            $contenidoCsv = PagosPlano::generarCsv($lote, $pagos, $lote['fecha_proceso']);
        } catch (RuntimeException $e) {
            return ['ok' => false, 'mensaje' => $e->getMessage()];
        }

        // Nombre presentado fijo y simple: la referencia queda internamente
        // (BD, ruta en storage/, auditoría) pero no en el nombre descargado.
        $nombre    = 'ArchivoPagos.txt';
        $nombreCsv = 'ArchivoPagos.csv';
        $hash      = hash('sha256', $contenido);
        $hashCsv   = hash('sha256', $contenidoCsv);
        @file_put_contents(self::storageDir() . '/' . $loteId . '.txt', $contenido);
        @file_put_contents(self::storageDir() . '/' . $loteId . '.csv', $contenidoCsv);

        PagosDb::ejecutar(
            'UPDATE pagos_lotes SET estado = ?, archivo_nombre = ?, archivo_sha256 = ?,
                    archivo_nombre_csv = ?, archivo_sha256_csv = ?,
                    generado_por = ?, generado_en = NOW() WHERE id = ?',
            ['generado', $nombre, $hash, $nombreCsv, $hashCsv, PagosAuth::id(), $loteId]
        );
        PagosAudit::registrar('lote.generado', 'lote', (string) $loteId, [
            'referencia' => $lote['referencia'],
            'pagos'      => count($pagos),
            'total'      => $lote['valor_total'],
            'sha256'     => $hash,
            'sha256_csv' => $hashCsv,
        ]);

        return ['ok' => true, 'mensaje' => 'Archivo generado.',
                'contenido' => $contenido, 'nombre' => $nombre,
                'contenido_csv' => $contenidoCsv, 'nombre_csv' => $nombreCsv];
    }

    /**
     * Empaca el .txt + .csv ya generados en un .zip cifrado con AES-256 y
     * una contraseña aleatoria. La contraseña se cifra en reposo con la
     * clave maestra (config `.env`) — nunca se guarda en texto plano.
     * @return array{ok:bool, mensaje:string, clave?:string, nombre?:string}
     */
    public static function empaquetar(int $loteId, string $claveMaestra): array
    {
        $lote = self::obtener($loteId);
        if (!$lote) {
            return ['ok' => false, 'mensaje' => 'El lote no existe.'];
        }
        if ($lote['estado'] !== 'generado') {
            return ['ok' => false, 'mensaje' => 'Primero genere el archivo del lote.'];
        }
        if (!PagosZip::soportaCifrado()) {
            return ['ok' => false, 'mensaje' =>
                'Este servidor no soporta ZIP cifrado con AES (la extensión zip no tiene '
                . 'libzip con cifrado). No se puede generar el paquete protegido; descargue '
                . 'el .txt y el .csv por separado y comuníquelos por un canal seguro distinto.'];
        }

        $rutaTxt = self::storageDir() . '/' . $loteId . '.txt';
        $rutaCsv = self::storageDir() . '/' . $loteId . '.csv';
        if (!is_file($rutaTxt) || !is_file($rutaCsv)) {
            return ['ok' => false, 'mensaje' => 'Faltan los archivos generados. Genere el archivo de nuevo.'];
        }

        $clave = PagosClave::generar();
        $rutaZip = self::storageDir() . '/' . $loteId . '.zip';
        $ok = PagosZip::crearCifrado($rutaZip, [
            ($lote['archivo_nombre'] ?: 'ArchivoPagos.txt')    => (string) file_get_contents($rutaTxt),
            ($lote['archivo_nombre_csv'] ?: 'ArchivoPagos.csv') => (string) file_get_contents($rutaCsv),
        ], $clave);
        if (!$ok) {
            return ['ok' => false, 'mensaje' => 'No se pudo crear el ZIP cifrado.'];
        }

        $hashZip = hash('sha256', (string) file_get_contents($rutaZip));
        PagosDb::ejecutar(
            'UPDATE pagos_lotes SET archivo_zip_nombre = ?, archivo_zip_sha256 = ?, archivo_zip_clave = ? WHERE id = ?',
            ['ArchivoPagos.zip', $hashZip, self::cifrarClave($clave, $claveMaestra), $loteId]
        );
        PagosAudit::registrar('lote.empaquetado', 'lote', (string) $loteId, ['sha256_zip' => $hashZip]);

        return ['ok' => true, 'mensaje' => 'ZIP cifrado generado.', 'clave' => $clave, 'nombre' => 'ArchivoPagos.zip'];
    }

    /** Descifra y devuelve la contraseña del ZIP del lote, o null si no tiene. */
    public static function claveZip(int $loteId, string $claveMaestra): ?string
    {
        $blob = PagosDb::valor('SELECT archivo_zip_clave FROM pagos_lotes WHERE id = ?', [$loteId]);
        if ($blob === null || $blob === '') {
            return null;
        }
        return self::descifrarClave((string) $blob, $claveMaestra);
    }

    private static function cifrarClave(string $clave, string $claveMaestra): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $ct = openssl_encrypt($clave, 'aes-256-gcm', hex2bin($claveMaestra), OPENSSL_RAW_DATA, $iv, $tag);
        return $iv . $tag . (string) $ct;
    }

    private static function descifrarClave(string $blob, string $claveMaestra): ?string
    {
        if (strlen($blob) < 28) {
            return null;
        }
        $iv  = substr($blob, 0, 12);
        $tag = substr($blob, 12, 16);
        $ct  = substr($blob, 28);
        $out = openssl_decrypt($ct, 'aes-256-gcm', hex2bin($claveMaestra), OPENSSL_RAW_DATA, $iv, $tag);
        return $out === false ? null : $out;
    }

    /** Lotes visibles según el permiso del usuario. */
    public static function listar(int $limite = 50): array
    {
        $sql = 'SELECT l.*, e.nombre AS empresa_nombre, u.nombre_completo AS autor
                  FROM pagos_lotes l
                  JOIN pagos_empresas e ON e.id = l.empresa_id
                  JOIN usuarios u ON u.id = l.usuario_id';
        $params = [];
        // Sin el permiso "verTodosLosLotes" (equivalente a Nómina/Consulta del
        // diseño original), cada quien solo ve lo propio.
        if (!PagosAuth::puede('verTodosLosLotes')) {
            $sql .= ' WHERE l.usuario_id = ?';
            $params[] = PagosAuth::id();
        }
        $sql .= ' ORDER BY l.creado_en DESC LIMIT ' . (int) $limite;
        return PagosDb::todos($sql, $params);
    }

    /** Control de acceso a un lote concreto, además del permiso general. */
    public static function puedeVer(array $lote): bool
    {
        if (!PagosAuth::puede('verLotes')) {
            return false;
        }
        if (!PagosAuth::puede('verTodosLosLotes')) {
            return (int) $lote['usuario_id'] === PagosAuth::id();
        }
        return true;
    }

    public static function puedeEditar(array $lote): bool
    {
        if ($lote['estado'] !== 'borrador' && $lote['estado'] !== 'validado') {
            return false;
        }
        if (!PagosAuth::puede('crearLotes')) {
            return false;
        }
        if (!PagosAuth::puede('verTodosLosLotes')) {
            return (int) $lote['usuario_id'] === PagosAuth::id();
        }
        return true;
    }

    public static function puedeReabrir(array $lote): bool
    {
        return $lote['estado'] === 'generado' && PagosAuth::puede('reabrirLotes');
    }

    /**
     * Reabre un lote ya generado para poder corregirlo. No borra los
     * archivos anteriores: los versiona (_v2, _v3, ...) para poder
     * demostrar qué se generó originalmente si ya se subió al portal del
     * banco — reabrir aquí NO lo retira de allí.
     * @return array{ok:bool, mensaje:string}
     */
    public static function reabrir(int $loteId, string $motivo): array
    {
        $lote = self::obtener($loteId);
        if (!$lote || !self::puedeReabrir($lote)) {
            return ['ok' => false, 'mensaje' => 'No puede reabrir este lote.'];
        }
        if (trim($motivo) === '') {
            return ['ok' => false, 'mensaje' => 'Escriba el motivo de la reapertura.'];
        }

        // La versión que se archiva es la que está vigente ahora mismo (sin
        // sufijo): la primera vez que se reabre es la v1, la segunda la v2...
        // mismo número que "version_anterior" en la auditoría de abajo.
        $version = (int) $lote['veces_reabierto'] + 1;
        foreach (['txt', 'csv', 'zip'] as $ext) {
            $ruta = self::storageDir() . '/' . $loteId . '.' . $ext;
            if (is_file($ruta)) {
                @rename($ruta, self::storageDir() . '/' . $loteId . '_v' . $version . '.' . $ext);
            }
        }

        PagosDb::transaccion(static function () use ($loteId, $motivo, $lote): void {
            PagosAudit::registrar('lote.reabierto', 'lote', (string) $loteId, [
                'motivo'                 => $motivo,
                'version_anterior'       => (int) $lote['veces_reabierto'] + 1,
                'archivo_anterior'       => $lote['archivo_nombre'],
                'sha256_anterior'        => $lote['archivo_sha256'],
                'sha256_csv_anterior'    => $lote['archivo_sha256_csv'],
                'sha256_zip_anterior'    => $lote['archivo_zip_sha256'],
                'generado_por_anterior'  => $lote['generado_por'],
                'generado_en_anterior'   => $lote['generado_en'],
            ]);
            PagosDb::ejecutar(
                'UPDATE pagos_lotes SET estado = ?, archivo_nombre = NULL, archivo_sha256 = NULL,
                        archivo_nombre_csv = NULL, archivo_sha256_csv = NULL,
                        archivo_zip_nombre = NULL, archivo_zip_sha256 = NULL, archivo_zip_clave = NULL,
                        generado_por = NULL, generado_en = NULL,
                        veces_reabierto = veces_reabierto + 1, reabierto_por = ?, reabierto_en = NOW()
                  WHERE id = ?',
                ['borrador', PagosAuth::id(), $loteId]
            );
        });

        return ['ok' => true, 'mensaje' => 'Lote reabierto. Los archivos anteriores quedaron versionados en storage/pagos/.'];
    }

    /** Anula un lote (borrador, validado o generado) sin borrarlo. */
    public static function anular(int $loteId, string $motivo): array
    {
        $lote = self::obtener($loteId);
        if (!$lote) {
            return ['ok' => false, 'mensaje' => 'El lote no existe.'];
        }
        if ($lote['estado'] === 'anulado') {
            return ['ok' => false, 'mensaje' => 'El lote ya está anulado.'];
        }
        if (trim($motivo) === '') {
            return ['ok' => false, 'mensaje' => 'Escriba el motivo de la anulación.'];
        }
        PagosDb::ejecutar('UPDATE pagos_lotes SET estado = ? WHERE id = ?', ['anulado', $loteId]);
        PagosAudit::registrar('lote.anulado', 'lote', (string) $loteId, [
            'motivo' => $motivo, 'referencia' => $lote['referencia'],
        ]);
        return ['ok' => true, 'mensaje' => 'Lote ' . $lote['referencia'] . ' anulado.'];
    }
}
