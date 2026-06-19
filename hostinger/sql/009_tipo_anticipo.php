<?php
declare(strict_types=1);
// Runner migracion 009: crea/actualiza el tipo de solicitud "Anticipo". CLI. Borrar tras usar.
require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/db.php';
Config::load(__DIR__ . '/.env');
$pdo = Db::pdo();

$bid = 0; $id = static function () use (&$bid) { $bid++; return 'an' . $bid; };

$areas = $pdo->query("SELECT id, nombre, slug FROM areas")->fetchAll();
$allIds = array_map(static fn($a) => (int)$a['id'], $areas);
$contaId = null; $areaBase = $allIds[0] ?? 1;
foreach ($areas as $a) {
    if (stripos((string)$a['nombre'], 'contab') !== false || strtolower((string)$a['slug']) === 'contabilidad') { $contaId = (int)$a['id']; }
}
if ($contaId === null) $contaId = $areaBase;

$soloViaje = ['campo'=>'categoria','en'=>['Viaje']];
$campos = [
  ['key'=>'categoria','label'=>'¿Para qué necesitas el anticipo?','type'=>'select','required'=>true,'group'=>'Solicitud de anticipo','opciones'=>['Viaje','Hospedaje','Alimentación','Transporte','Otro']],
  ['key'=>'valorPesos','label'=>'Valor total solicitado','type'=>'valor-pesos','required'=>true,'group'=>'Solicitud de anticipo'],
  ['key'=>'justificacion','label'=>'Justificación / explicación','type'=>'textarea','required'=>true,'group'=>'Solicitud de anticipo'],
  // --- Solo cuando es Viaje ---
  ['key'=>'destino','label'=>'Destino del viaje (con mapa)','type'=>'direccion','required'=>true,'group'=>'Solicitud de anticipo','mostrarSi'=>$soloViaje],
  ['key'=>'motivo','label'=>'Motivo del viaje','type'=>'text','required'=>false,'group'=>'Solicitud de anticipo','mostrarSi'=>$soloViaje],
  ['key'=>'tipoTransporte','label'=>'Medio de transporte','type'=>'select','required'=>true,'group'=>'Solicitud de anticipo','mostrarSi'=>$soloViaje],
  ['key'=>'soporteCosto','label'=>'Soporte/cotización del costo (avión, bus, taxi…)','type'=>'file','required'=>false,'group'=>'Solicitud de anticipo','mostrarSi'=>$soloViaje],
  // --- Detalle de gastos (hospedaje, comida, etc.) con soporte por fila validado por IA ---
  ['key'=>'detalleGastos','label'=>'Detalle de gastos (agrega hospedaje, comida, transporte… con su soporte)','type'=>'tabla-items','required'=>false,'group'=>'Solicitud de anticipo','columnas'=>['Concepto','Valor'],'conFactura'=>true,'verificaciones'=>['total','establecimiento','fecha','alteracion']],
  ['key'=>'autorizadoPor','label'=>'Autorizado por (director de tu área o un usuario)','type'=>'persona','required'=>true,'group'=>'Solicitud de anticipo'],
  ['key'=>'fechaLegalizacion','label'=>'¿Cuándo legalizarás con facturas?','type'=>'date','required'=>true,'group'=>'Compromiso de legalización'],
];

$flujo = [
  ['rol'=>'analista','label'=>'Analista del área','orden'=>1],
  ['rol'=>'director','label'=>'Director del área','orden'=>2],
  ['rol'=>'contabilidad','label'=>'Área final (Contabilidad)','orden'=>3],
];

$flujoAreas = ['areasParticipantes'=>$allIds, 'areaInicialId'=>null, 'areaFinalId'=>$contaId, 'remision'=>new stdClass()];

$plantilla = ['bloques'=>[
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>10,'w'=>174,'tipo'=>'encabezado','titulo'=>'AUTORIZACIÓN DE ANTICIPO','subtitulo'=>'DIRECCIÓN FINANCIERA','area'=>'CONTABILIDAD','codigo'=>'DF-CON-FR-010','fecha'=>'{{fecha}}','version'=>'1','paginaTexto'=>'1 de 1','src'=>'/logo-payops-dark.png'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>46,'w'=>174,'tipo'=>'titulo','texto'=>'SOLICITUD Y AUTORIZACIÓN DE ANTICIPO','alineacion'=>'centro','tamano'=>13,'negrita'=>true],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>58,'w'=>174,'tipo'=>'texto','tamano'=>11,'alineacion'=>'izquierda','texto'=>'Fecha: {{fecha}}. Yo, {{nombre}}, identificado(a) con documento No. {{cedula}}, solicito de manera formal un anticipo por valor de $ {{valor}} ({{valorLetras}}) destinado a: {{categoria}}. Justificación: {{justificacion}}. En caso de viaje — Destino: {{destino}}; Motivo: {{motivo}}. Me comprometo a legalizar este anticipo con las facturas y/o soportes correspondientes a más tardar el {{fechaLegalizacion}}, entendiendo que de no hacerlo el valor podrá ser descontado de mi nómina.'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>120,'w'=>174,'tipo'=>'campo','campoKey'=>'categoria','etiqueta'=>'Categoría:','alineacion'=>'izquierda'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>130,'w'=>174,'tipo'=>'campo','campoKey'=>'valorPesos','etiqueta'=>'Valor del anticipo:','alineacion'=>'izquierda'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>140,'w'=>174,'tipo'=>'campo','campoKey'=>'autorizadoPor','etiqueta'=>'Autorizado por:','alineacion'=>'izquierda'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>150,'w'=>174,'tipo'=>'campo','campoKey'=>'fechaLegalizacion','etiqueta'=>'Compromiso de legalización:','alineacion'=>'izquierda'],
  ['id'=>$id(),'pagina'=>1,'x'=>18,'y'=>200,'w'=>80,'tipo'=>'firma','campoFirma'=>'profesional','etiqueta'=>'Firma del solicitante'],
]];

$slug = 'anticipo';
$exist = $pdo->prepare("SELECT id FROM tipos_solicitud WHERE slug = :s LIMIT 1");
$exist->execute([':s'=>$slug]);
$row = $exist->fetch();

$cJson = json_encode($campos, JSON_UNESCAPED_UNICODE);
$fJson = json_encode($flujo, JSON_UNESCAPED_UNICODE);
$faJson = json_encode($flujoAreas, JSON_UNESCAPED_UNICODE);
$pJson = json_encode($plantilla, JSON_UNESCAPED_UNICODE);

if ($row) {
    $up = $pdo->prepare("UPDATE tipos_solicitud SET nombre=:n, descripcion=:d, activo=1, campos_plantilla=:c, flujo_aprobacion=:f, flujo_areas=:fa, plantilla_pdf=:p WHERE id=:id");
    $up->execute([':n'=>'Anticipo',':d'=>'Solicitud de anticipo de dinero (viaje, hospedaje, alimentación, transporte u otro). Se legaliza con facturas.',':c'=>$cJson,':f'=>$fJson,':fa'=>$faJson,':p'=>$pJson,':id'=>(int)$row['id']]);
    echo "ANTICIPO actualizado id={$row['id']}\n";
} else {
    $insSql = "INSERT INTO tipos_solicitud (area_id, nombre, descripcion, slug, activo, orden, campos_plantilla, flujo_aprobacion, flujo_areas";
    $colPlantilla = false;
    try { $pdo->query("SELECT plantilla_pdf FROM tipos_solicitud LIMIT 1"); $colPlantilla = true; } catch (Throwable $e) {}
    if ($colPlantilla) $insSql .= ", plantilla_pdf";
    $insSql .= ") VALUES (:a,:n,:d,:s,1,5,:c,:f,:fa" . ($colPlantilla ? ",:p" : "") . ")";
    $ins = $pdo->prepare($insSql);
    $args = [':a'=>$contaId,':n'=>'Anticipo',':d'=>'Solicitud de anticipo de dinero (viaje, hospedaje, alimentación, transporte u otro). Se legaliza con facturas.',':s'=>$slug,':c'=>$cJson,':f'=>$fJson,':fa'=>$faJson];
    if ($colPlantilla) $args[':p'] = $pJson;
    $ins->execute($args);
    echo "ANTICIPO creado id=" . $pdo->lastInsertId() . "\n";
}
echo "areas participantes: " . implode(',', $allIds) . " | areaFinal(conta)={$contaId}\n";
echo "MIGRACION_009_OK\n";
