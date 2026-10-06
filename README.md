# RewardLens

Herramienta local para revisar oportunidades de recompensa en GitHub antes de invertir tiempo en resolverlas. Reúne señales como estado de la incidencia, archivo del repositorio, asignación y actividad previa, para acompañar una decisión con evidencia verificable.

## Ejecutar

Necesitas una versión actual de Node.js. El proyecto funciona sin dependencias externas ni `npm install`.

Desde esta carpeta:

```powershell
node serve.mjs
```

Abre **http://127.0.0.1:4317** en el navegador. Para detener el servidor, pulsa `Ctrl+C` en la terminal.

## Verificar

```powershell
node --test tests/*.test.mjs
```

## Interpretar los resultados

La información pública de GitHub ayuda a comprobar si una tarea está abierta y si hay trabajo previo. Un importe en el título, una etiqueta o un comentario no demuestra que el dinero esté reservado, que se acepte otra solución ni que se pague automáticamente. Revisa los enlaces de origen y las reglas del programa antes de presentar trabajo.

Los estados y comentarios pueden cambiar después de una consulta. Si la API no está disponible o limita peticiones, revisa la evidencia disponible y vuelve a consultar más tarde; no interpretes un error de acceso como confirmación de que la oportunidad está abierta.

## Funciones y límites

Consulta el issue, el repositorio y hasta 200 comentarios mediante la API pública de GitHub. El informe muestra el importe que aparece en el título, propuestas detectadas, recomendaciones textuales, asignaciones, fuentes y fecha de consulta. Los historiales parciales se señalan expresamente. Las dos instantáneas de ejemplo son observaciones fechadas, no ofertas actuales.

Puedes guardar el informe como JSON o abrir «Ver informe JSON» y copiarlo si tu navegador no permite la descarga. No necesita claves, cuentas ni datos de pago. Los enlaces que imitan GitHub, incluyen credenciales o llevan parámetros se rechazan antes de consultar la API.

Es una muestra creada con asistencia de Codex. Las señales usan reglas heurísticas y requieren comprobar la conversación original; no confirman financiación, contratación ni cobro. Las pruebas cubren el motor de análisis y el servidor, no todos los posibles programas de recompensas.
