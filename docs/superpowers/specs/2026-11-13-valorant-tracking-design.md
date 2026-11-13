# /valorant — seguimiento de la división de Valorant (TLH)

Fecha: 2026-11-13 · Estado: borrador para aprobación

## Para qué es

La división de Valorant de TLH (proyecto 2027) no lleva ningún seguimiento de estadísticas. Esta página es **para los propios jugadores**: ver en qué mapas les va mejor, con qué agentes, y qué tiene que mejorar cada uno. Se publica como página **pública** en `thelasthope.dev/valorant`; más adelante puede que se oculte.

## Objetivos

- Ver, para el equipo y para cada jugador, rendimiento **por mapa** y **por agente** (winrate, K/D, HS%, daño).
- Separar lo que juegan **como equipo** (Premier, scrims y torneos) de lo que juegan **por su cuenta** (ranked).
- Guardar el historial, sobre todo los customs, que la API olvida si nadie los consulta.

## No-objetivos (por ahora)

- Login, privacidad o página oculta.
- Datos en vivo o de minutos atrás (basta con una actualización diaria).
- Seguir a otros equipos o a jugadores fuera del roster.
- Análisis con IA. Los "destacados" salen de reglas simples sobre los números.

## Anti-objetivos

- Mezclar en las estadísticas de equipo partidas que no lo son: customs casuales, o partidas donde jugó alguien de fuera en lugar del roster sin que se note.
- Exponer la clave de la API en el navegador o en el repositorio.
- Que la página dependa de la API al cargar: si HenrikDev cae, la página debe seguir mostrando los últimos datos guardados.

## Contexto y restricciones

- **El sitio:** Astro 5 estático en Vercel. Sin adaptador de servidor ni base de datos. Node 22. Estilos en `src/styles/theme.css` (acento violeta `--brand-1: #6d28d9`).
- **Fuente de datos:** HenrikDev API (no oficial), `https://api.henrikdev.xyz/valorant`. Clave en `HENRIKDEV_API_KEY`: en `.env` local (gitignored) y como secreto del repositorio en GitHub. Límite: **30 peticiones por minuto**.
  - La API oficial de Riot exige una clave de producción y que cada jugador inicie sesión con Riot (RSO). Queda para más adelante.
  - tracker.gg queda descartado: no tiene API pública y sus términos prohíben el scraping.
- **Región de la API:** `na` para las seis cuentas, aunque las partidas se juegan en servidores LATAM (Miami). Usar siempre `na` en las rutas.
- **Roster** (lo confirmó el usuario el 2026-11-13). Debe quedar en un archivo de configuración editable, no en el código:
  - Zeiko#BRS
  - BiggS#ING
  - McFly#GOAT
  - ezekiel#bored
  - TDiamond#COL
  - Sharky#kztro
  - Nota: "dagestan aim f#splsh" jugó Premier el 2026-11-08 pero **no** es del roster.
- **Equipo Premier:** nombre "T L H", tag "T L H" (con espacios). Conferencia LATAM_NORTH. `GET /v1/premier/{name}/{tag}` devuelve `member: []`, así que el roster no se puede sacar de ahí.

### Endpoints comprobados (2026-11-13)

| Uso | Endpoint | Notas |
|---|---|---|
| Cuenta / PUUID | `/v1/account/{name}/{tag}` | PUUID estable. Identificar a los jugadores por PUUID, no por nombre. |
| Historial compacto | `/v1/stored-matches/na/{name}/{tag}?mode=competitive\|premier\|custom&size=…` | Una fila por partida: mapa, temporada, agente, K/D/A, disparos, daño y rondas por equipo. Zeiko tiene 385 de ranked desde junio de 2026, 36 de Premier y 9 customs. |
| Partida completa | `/v4/match/na/{match_id}` | ~390 KB. Incluye `rounds[].winning_team_role` (Attack/Defense), plants y defuses, y los 10 jugadores con sus agentes. |
| Últimas partidas | `/v4/matches/na/pc/{name}/{tag}?mode=…&size=10` | Al consultarlas, HenrikDev las guarda en su historial. Así se capturan los customs. |
| Rango actual | `/v3/mmr/na/pc/{name}/{tag}` | Tier, RR, último cambio. |
| Historial de RR | `/v1/mmr-history/na/{name}/{tag}` | Solo las últimas ~10. Para la gráfica hay que guardar una foto diaria o buscar un endpoint con historial guardado. |
| Equipo Premier | `/v1/premier/{name}/{tag}` y `/history` | Puntos, división, puesto, récord e IDs de las partidas de liga. |

## Enfoques considerados

1. **Estático y regenerado a diario (elegido).** Una GitHub Action programada consulta la API, agrega las partidas nuevas a archivos JSON del repositorio y hace commit. Vercel vuelve a construir el sitio y Astro genera `/valorant` a partir de esos JSON.
   - A favor: sin base de datos ni servidor, carga rápido, la clave no sale de GitHub y el historial queda versionado.
   - En contra: los datos llegan con hasta un día de retraso (se puede lanzar a mano).
2. **Servidor y base de datos** (adaptador de Vercel, cron y Postgres): más fresco, pero añade infraestructura y mantenimiento que hoy no hacen falta. Queda como evolución si algún día quieren datos en vivo o login. Los JSON guardados sirven para migrar.
3. **tracker.gg o scraping:** descartado por sus términos y por la protección contra bots.

El usuario eligió **el 1**.

## Diseño

### Recolección (GitHub Action diaria y manual)

- Se ejecuta con un cron diario y también con `workflow_dispatch`, para lanzarla a mano después de una partida.
- Pasos, respetando el límite de 30 por minuto:
  1. Por cada jugador, pedir `v4/matches` de `custom`, `premier` y `competitive`. Así HenrikDev registra las partidas recientes y no se pierden customs.
  2. Pedir `stored-matches` por jugador y modo, y agregar las filas cuyo `meta.id` no esté ya guardado.
  3. Por cada partida nueva que sea **de equipo** (ver la regla abajo), pedir `v4/match/{id}` **una sola vez** y guardar solo un resumen derivado: lado y resultado de cada ronda, agentes de los 10 jugadores, marcador, rival y stats por jugador del roster. **No** guardar el JSON completo (~390 KB por partida).
  4. Guardar una foto de rango y RR por jugador y el estado del equipo Premier (puntos, división, puesto).
- Si la API falla, el job termina sin tocar los datos.

### Publicación de los datos

`main` tiene un ruleset ("protect main branch") que exige el check de estado "Vercel" y prohíbe force-push, y el equipo trabaja con PRs. Un commit diario de un bot directo a `main` chocaría con eso, y Vercel podría no desplegar commits de `github-actions[bot]` en un repo de organización. Propuesta:

- La Action guarda los JSON en una rama aparte, `valorant-data`, que no es `main` y solo tiene datos. Allí hace commit y push.
- El build de Astro descarga esos JSON de esa rama al construir. El repo es público, así que basta con `raw.githubusercontent.com`. Si la descarga falla, usa la última copia incluida en el repo o muestra la página vacía con un aviso.
- Al terminar, la Action llama a un **Deploy Hook de Vercel** (guardado como secreto `VERCEL_DEPLOY_HOOK_URL`) para reconstruir el sitio.
- Por qué el hook: en este proyecto Vercel solo despliega lo que envía la cuenta **machinemmus** (lo dijo el usuario el 2026-11-13). Un commit de `github-actions[bot]` no se desplegaría. El Deploy Hook reconstruye `main` sin importar quién hizo el commit.
- Configuración manual que hace el usuario, que tiene acceso a Vercel. El plan debe incluirla como pasos para él:
  1. Crear el Deploy Hook para la rama `main`.
  2. Guardar su URL y la clave de HenrikDev como secretos del repositorio (`VERCEL_DEPLOY_HOOK_URL` y `HENRIKDEV_API_KEY`).
  3. Agregar `HENRIKDEV_API_KEY` en Vercel solo si el build la necesita. Con este diseño no la necesita, porque el build solo lee los JSON.
- El código de la página y de la Action entra a `main` por PR, como siempre.

### Datos guardados

Archivos JSON dentro del repositorio (ruta propuesta: `src/data/valorant/`):

- Roster y configuración: jugadores con Riot ID y PUUID, y nombre/tag del equipo Premier.
- Partidas por jugador: filas compactas sin duplicados por `match_id`.
- Partidas de equipo: resumen derivado por partida.
- Fotos de rango por jugador y fecha, y fotos del estado de Premier.

### Regla de "partida de equipo"

- **Premier:** toda partida de Premier del equipo T L H cuenta, aunque juegue alguien de fuera del roster. *(Decisión de Claude: es una partida oficial del equipo y el resultado cuenta en la liga.)* Esas partidas se guardan con su alineación y se marcan en la página con una etiqueta "con suplente: <nombre>". Las stats del suplente no se suman a ningún jugador del roster.
- **Customs (scrims y torneos):** cuenta como partida de equipo si **al menos 4 de los 6 jugadores del roster están en el mismo lado**. El resto de customs no cuenta en las estadísticas de equipo.
- **Ranked:** nunca es de equipo. Cuenta solo para la pestaña de cada jugador.

### La página `/valorant`

Una página con pestañas: **Equipo** y una por cada jugador. El boceto aprobado (local, no está en el repo) está en `.superpowers/brainstorm/96894-1794596298/content/layout-b-v2.html`; lo que importa de él está descrito aquí.

- **Filtros** arriba: modo (Premier, Scrims/Torneos, Ranked; varios a la vez) y periodo (acto actual o todo).
  - En la pestaña Equipo, por defecto: Premier + Scrims, acto actual.
  - En la de cada jugador, por defecto: Ranked, acto actual.
- **Pestaña Equipo:**
  - Puesto en Premier (división, posición, puntos) y récord.
  - Tabla de mapas: partidas, winrate, % de rondas ganadas en ataque y en defensa.
  - Al tocar un mapa: qué agente jugó cada jugador ahí, partidas, winrate y K/D.
  - Composiciones por mapa (los 5 agentes) con su winrate.
  - Últimas partidas: fecha, modo, mapa, marcador y rival.
    - En Premier, el rival es el nombre del equipo.
    - En customs, por defecto se muestra el rival como "Scrim vs <Riot ID del primer jugador rival>". *(Decisión de Claude.)*
    - Un archivo de etiquetas editable a mano (`match_id` → nombre del rival, tipo `scrim|torneo` y `incluir: true|false`) permite nombrar el rival, separar scrims de torneos y corregir un custom que la regla de 4 de 6 clasificó mal. La Action nunca sobrescribe ese archivo. Mientras un custom no tenga etiqueta, cuenta como "scrim".
- **Pestaña de jugador:**
  - Rango y RR actuales, K/D, HS% y daño por ronda.
  - Una línea de "destacados" generada con reglas, por ejemplo el peor y el mejor mapa, o una tendencia de HS% o K/D en las últimas 10 partidas frente al periodo.
  - Tabla de agentes: partidas, winrate, K/D, HS%.
  - Tabla de mapas: partidas, winrate, K/D, agente más jugado.
  - Gráfica de RR en el tiempo, hecha con las fotos diarias.
- Debe seguir el estilo del sitio (`theme.css`), funcionar en móvil y mostrar "Actualizado: fecha".
- Los filtros y las pestañas funcionan en el navegador sin pedir nada a la API: los datos van incrustados en el build.

## A decidir por el builder

- La estructura exacta de los JSON y los nombres de archivo.
- El cálculo de ataque y defensa por ronda a partir de `winning_team_role` y el equipo del roster, incluida la prórroga.
- Los umbrales de los "destacados" y un mínimo de partidas para mostrar un winrate, para no sacar conclusiones con 1 o 2 partidas.
- La librería de la gráfica: preferir algo liviano o SVG a mano, sin añadir una dependencia pesada.
- La hora del cron.
- Cómo se ve la página si un jugador no tiene datos en el filtro elegido (Sharky hoy no tiene partidas de equipo).
