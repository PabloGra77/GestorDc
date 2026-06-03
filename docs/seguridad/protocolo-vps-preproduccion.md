# Protocolo VPS de Preproduccion y Produccion

Fecha de referencia: 16 de abril de 2026.

Este documento define controles obligatorios antes de desplegar a produccion en el VPS.

## 1) Reglas operativas obligatorias

### Conexion a base de datos
- Los puertos de base de datos (3306, 5432, etc.) no se exponen al exterior.
- La conexion administrativa debe hacerse solo por tunel SSH.
- En el cliente SQL local (DBeaver/TablePlus), el host de base de datos debe ser localhost y el puerto el interno del contenedor.

Ejemplo de tunel SSH local hacia Postgres interno:

```bash
ssh -L 5432:localhost:5432 dev@IP_DEL_SERVIDOR
```

### Aislamiento de recursos
- Prohibido borrar, detener o modificar contenedores, volumenes, redes o imagenes que no pertenezcan al proyecto propio.
- Toda accion en el VPS es auditable por logs.

### Uso de puertos
- Puertos reservados del sistema: 80, 443, 22, 81 y 9443.
- Si el proyecto necesita publicar un nuevo puerto, se debe solicitar apertura formal en firewall para la IP autorizada.

### Seguridad por IP
- El acceso al VPS se controla por whitelist de IP publica.
- Si cambia la conexion a internet, se debe notificar para actualizar reglas de firewall antes de continuar.

### Higiene de infraestructura
- El equipo responsable debe limpiar periodicamente imagenes huerfanas y contenedores en desuso de su propio proyecto.
- Nunca realizar limpieza global que afecte recursos de terceros.

## 2) Checklist de salida a produccion

Ejecutar en este orden:

1. Validar que la base de datos no tenga publicacion de puertos en docker-compose.
2. Validar que ningun servicio publique puertos reservados (80, 443, 22, 81, 9443).
3. Validar que servicios internos (api/web) esten ligados a 127.0.0.1 si van detras de reverse proxy.
4. Confirmar que no se operaran recursos de otros proyectos.
5. Confirmar que la IP publica actual sigue autorizada.
6. Ejecutar limpieza segura solo de recursos propios no usados.

## 3) Comandos de referencia seguros

Inspeccion de estado del proyecto actual:

```bash
docker compose ps
docker compose images
docker compose config
```

Limpieza limitada a recursos no usados del propio contexto (usar con criterio):

```bash
docker image prune -f
docker container prune -f
```

Nota: no usar comandos destructivos amplios si no se tiene certeza de alcance.

## 4) Integracion con este repositorio

- Ejecutar script de preflight antes de cada despliegue:

```bash
bash infra/scripts/preflight-vps.sh
```

- Si el script reporta ERROR, no desplegar hasta corregir.
