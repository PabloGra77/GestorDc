<?php
declare(strict_types=1);
/**
 * Migración 010: actualiza campos_plantilla del tipo "anticipo" para que
 * coincida exactamente con el nuevo AnticipOPanel del frontend.
 * - Elimina campos innecesarios/nunca mostrados: mesAnioRadicar, cuentaCobro,
 *   certBancaria, soporteCosto, detalleGastos, etc.
 * - Marca como no-required los campos que el panel calcula/envía automáticamente.
 * - Deja required solo: justificacion, valorPesos, autorizadoPor, fechaLegalizacion.
 *
 * Uso: php 010_fix_anticipo_campos.php
 * Ejecutar UNA sola vez desde la raíz del proyecto en el servidor.
 */
require_once __DIR__ . '/../public_html/api/lib/config.php';
require_once __DIR__ . '/../public_html/api/lib/db.php';
Config::load(__DIR__ . '/../public_html/.env');
$pdo = Db::pdo();

$stmt = $pdo->prepare("SELECT id, campos_plantilla FROM tipos_solicitud WHERE slug = 'anticipo' LIMIT 1");
$stmt->execute();
$row = $stmt->fetch();
if (!$row) { echo "ERROR: tipo 'anticipo' no encontrado.\n"; exit(1); }

$camposLimpios = [
  ['key'=>'justificacion',    'label'=>'Justificación / explicación',         'type'=>'textarea',    'required'=>true,  'group'=>'Solicitud de anticipo'],
  ['key'=>'valorPesos',       'label'=>'Valor total solicitado',               'type'=>'valor-pesos', 'required'=>true,  'group'=>'Solicitud de anticipo'],
  ['key'=>'categoria',        'label'=>'Categorías de gasto',                  'type'=>'text',        'required'=>false, 'group'=>'Solicitud de anticipo'],
  ['key'=>'tipoTransporte',   'label'=>'Medio de transporte',                  'type'=>'text',        'required'=>false, 'group'=>'Solicitud de anticipo'],
  ['key'=>'destino',          'label'=>'Destino',                              'type'=>'text',        'required'=>false, 'group'=>'Solicitud de anticipo'],
  ['key'=>'autorizadoPor',    'label'=>'Autorizado por',                       'type'=>'persona',     'required'=>true,  'group'=>'Solicitud de anticipo'],
  ['key'=>'fechaLegalizacion','label'=>'Compromiso de legalización (fecha)',   'type'=>'date',        'required'=>true,  'group'=>'Compromiso de legalización'],
];

$up = $pdo->prepare("UPDATE tipos_solicitud SET campos_plantilla = :c WHERE id = :id");
$up->execute([':c' => json_encode($camposLimpios, JSON_UNESCAPED_UNICODE), ':id' => (int)$row['id']]);

echo "campos_plantilla actualizado para tipo 'anticipo' (id={$row['id']})\n";
echo "Campos requeridos: justificacion, valorPesos, autorizadoPor, fechaLegalizacion\n";
echo "MIGRACION_010_OK\n";
