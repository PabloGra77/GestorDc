<?php
declare(strict_types=1);

Auth::requireUser();
PagosAuth::requerir('crearLotes');

$csv = PagosImportador::plantillaCsv();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Length: ' . strlen($csv));
header('Content-Disposition: attachment; filename="plantilla-portal-pagos.csv"');
header('X-Content-Type-Options: nosniff');
echo $csv;
exit;
