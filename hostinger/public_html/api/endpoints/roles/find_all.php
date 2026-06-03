<?php
declare(strict_types=1);
Auth::requireUser();
$rows = Db::pdo()->query("SELECT * FROM roles ORDER BY id ASC")->fetchAll();
Response::json(array_map([Shapes::class, 'role'], $rows));
