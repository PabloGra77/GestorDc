<?php
declare(strict_types=1);

/**
 * Convierte fila de DB a la forma JSON que espera el frontend.
 */
final class Shapes
{
    public static function usuario(array $row): array
    {
        return [
            'id'              => (int)$row['id'],
            'primerNombre'    => $row['primer_nombre']    ?? null,
            'segundoNombre'   => $row['segundo_nombre']   ?? null,
            'primerApellido'  => $row['primer_apellido']  ?? null,
            'segundoApellido' => $row['segundo_apellido'] ?? null,
            'tipoDocumento'   => $row['tipo_documento']   ?? null,
            'numeroDocumento' => $row['numero_documento'] ?? null,
            'nombreCompleto'  => $row['nombre_completo'],
            'correo'          => $row['correo'],
            'area'            => $row['area'] ?? null,
            'permisos'        => self::jsonOrObject($row['permisos'] ?? '{}'),
            'mustChangePassword' => (bool)($row['must_change_password'] ?? false),
            'activo'          => (bool)$row['activo'],
            'rolId'           => (int)$row['rol_id'],
            'areaId'          => isset($row['area_id']) && $row['area_id'] !== null ? (int)$row['area_id'] : null,
            'nivelAprobacion' => $row['nivel_aprobacion'] ?? null,
            'rol'             => isset($row['r_id']) ? self::role([
                'id'          => $row['r_id'],
                'nombre'      => $row['r_nombre'],
                'descripcion' => $row['r_desc'] ?? null,
                'activo'      => $row['r_activo'],
                'permisos'    => $row['r_permisos'] ?? '{}',
            ]) : null,
        ];
    }

    public static function role(array $row): array
    {
        return [
            'id'          => (int)$row['id'],
            'nombre'      => $row['nombre'],
            'descripcion' => $row['descripcion'] ?? null,
            'activo'      => (bool)$row['activo'],
            'permisos'    => self::jsonOrObject($row['permisos'] ?? '{}'),
        ];
    }

    public static function radicado(array $row): array
    {
        return [
            'id'                    => (int)$row['id'],
            'numero'                => $row['numero'],
            'referencia'            => $row['referencia'],
            'asunto'                => $row['asunto'],
            'estado'                => $row['estado'],
            'tipo'                  => $row['tipo'],
            'solicitanteCorreo'     => $row['solicitante_correo'] ?? null,
            'solicitanteCc'         => $row['solicitante_cc'] ?? null,
            'documentosSolicitados' => $row['documentos_solicitados'] ? json_decode($row['documentos_solicitados'], true) : null,
            'documentosAdjuntos'    => $row['documentos_adjuntos']    ? json_decode($row['documentos_adjuntos'], true)    : null,
            'datosPlantilla'        => $row['datos_plantilla']        ? json_decode($row['datos_plantilla'], true)        : null,
            'creadoEn'              => $row['creado_en'],
            'actualizadoEn'         => $row['actualizado_en'],
        ];
    }

    private static function jsonOrObject($raw)
    {
        if (is_array($raw)) return $raw;
        $decoded = json_decode((string)$raw, true);
        if (!is_array($decoded) || empty($decoded)) return new stdClass();
        return $decoded;
    }
}
