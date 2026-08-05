<?php
declare(strict_types=1);

/**
 * Carga las clases del módulo Portal de Pagos. Un solo require en
 * bootstrap.php en vez de una lista larga — el orden importa porque hay
 * dependencias entre clases (PagosDinero usa PagosTexto, PagosLote usa
 * PagosZip y viceversa para storageDir(), etc.), así que se listan
 * explícitamente en vez de escanear el directorio.
 */
require_once __DIR__ . '/pagos/PagosDb.php';
require_once __DIR__ . '/pagos/PagosAuth.php';
require_once __DIR__ . '/pagos/PagosAudit.php';
require_once __DIR__ . '/pagos/PagosTexto.php';
require_once __DIR__ . '/pagos/PagosDinero.php';
require_once __DIR__ . '/pagos/PagosBancos.php';
require_once __DIR__ . '/pagos/PagosValidador.php';
require_once __DIR__ . '/pagos/PagosPlano.php';
require_once __DIR__ . '/pagos/PagosImportador.php';
require_once __DIR__ . '/pagos/PagosClave.php';
require_once __DIR__ . '/pagos/PagosLote.php';
require_once __DIR__ . '/pagos/PagosZip.php';
require_once __DIR__ . '/pagos/PagosCorreo.php';
