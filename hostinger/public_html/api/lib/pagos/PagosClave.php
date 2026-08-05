<?php
declare(strict_types=1);

/**
 * Generador de contraseñas para el ZIP cifrado del Portal de Pagos: palabras
 * capitalizadas unidas por guion bajo + dos dígitos + un símbolo, al estilo
 * de "Invisibilidad_Activa_Solo_De_Noche_88*" — legible y fácil de digitar a
 * mano en el paso de descompresión del portal del banco, a diferencia de
 * una cadena de caracteres al azar.
 *
 * Con 4 palabras de esta lista (~160) + 2 dígitos + 1 símbolo la entropía
 * ronda los 40 bits — razonable para un archivo que además viaja cifrado
 * con AES-256 y cuya clave nunca se guarda en texto plano (ver PagosLote.php).
 */
final class PagosClave
{
    private const PALABRAS = [
        'Firme','Seguro','Claro','Sereno','Prudente','Atento','Constante','Diligente',
        'Puntual','Vigilante','Estable','Correcto','Ordenado','Cuidadoso','Reservado',
        'Confiable','Diario','Nocturno','Matinal','Central','Directo','Superior',
        'Interno','Actual','Vigente','Formal','Estricto','Sobrio','Exacto','Sencillo',
        'Amplio','Breve','Rapido','Lento','Ligero','Pesado','Fuerte','Suave','Denso',
        'Nitido','Limpio','Discreto','Sobrio','Austero','Modesto','Humilde','Solido',
        'Robusto','Firmeza','Templado','Sereno','Calmado','Tranquilo','Quieto',
        'Silencioso','Visible','Oculto','Cerrado','Abierto','Alto','Bajo','Ancho',
        'Angosto','Recto','Curvo','Plano','Redondo','Cuadrado','Doble','Triple',
        'Unico','Total','Parcial','Completo','Basico','Comun','Especial','Distinto',
        'Nuevo','Viejo','Fresco','Reciente','Antiguo','Moderno','Clasico','Tipico',
        'Norte','Sur','Este','Oeste','Central','Externo','Remoto','Cercano','Lejano',
        'Vecino','Aliado','Amigo','Socio','Miembro','Grupo','Equipo','Sector','Zona',
        'Region','Distrito','Barrio','Ciudad','Puerto','Rio','Valle','Monte','Cerro',
        'Llano','Bosque','Campo','Prado','Jardin','Huerto','Sendero','Camino','Ruta',
        'Puente','Torre','Muro','Cerca','Portal','Umbral','Escudo','Casco','Manto',
        'Velo','Sello','Marca','Signo','Simbolo','Numero','Codigo','Clave','Llave',
        'Candado','Cerrojo','Anillo','Cadena','Nudo','Lazo','Vinculo','Enlace','Punto',
        'Linea','Trazo','Rayo','Destello','Brillo','Sombra','Reflejo','Espejo','Cristal',
        'Piedra','Metal','Hierro','Bronce','Plata','Oro','Cobre','Acero','Roble',
        'Pino','Cedro','Palma','Cactus','Junco','Trigo','Maiz','Cacao','Cafe',
    ];

    private const SIMBOLOS = ['*', '#', '%', '+', '@'];

    public static function generar(int $palabras = 4): string
    {
        $elegidas = [];
        $max = count(self::PALABRAS) - 1;
        for ($i = 0; $i < $palabras; $i++) {
            $elegidas[] = self::PALABRAS[random_int(0, $max)];
        }
        $numero  = str_pad((string) random_int(0, 99), 2, '0', STR_PAD_LEFT);
        $simbolo = self::SIMBOLOS[random_int(0, count(self::SIMBOLOS) - 1)];
        return implode('_', $elegidas) . '_' . $numero . $simbolo;
    }
}
