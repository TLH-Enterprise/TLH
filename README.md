# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Valorant: datos

La página `/valorant` muestra las estadísticas de la división de Valorant. Los datos vienen de la API de HenrikDev:

- Una GitHub Action (`.github/workflows/valorant-collect.yml`) corre todos los días a las 5:00 (hora de Colombia) y también se puede lanzar a mano.
- La Action guarda las partidas en la rama `valorant-data` (carpeta `data/`) y luego avisa a Vercel para reconstruir el sitio.
- Antes de cada build, `scripts/valorant/fetch-data.mjs` descarga esos datos a `public/valorant-data.json`. Si no puede descargarlos, la página sale vacía pero el build no falla.

### Configuración inicial (una sola vez)

1. **Deploy Hook en Vercel:** Project → Settings → Git → Deploy Hooks. Crea uno con nombre `valorant` para la rama `main` y copia la URL.
2. **Secretos en GitHub:** en TLH-Enterprise/TLH → Settings → Secrets and variables → Actions, crea:
   - `HENRIKDEV_API_KEY`: la clave de HenrikDev.
   - `VERCEL_DEPLOY_HOOK_URL`: la URL del paso 1.
3. **Primera corrida:** en Actions → "Valorant collect" → Run workflow. Comprueba que aparece un commit en la rama `valorant-data` y un deploy nuevo en Vercel.

### Uso diario

- **Nombrar rivales, marcar torneos o sacar partidas:** edita `data/labels.json` en la rama `valorant-data` desde GitHub. Ejemplo:
  ```json
  {
    "<match_id>": { "rival": "Nombre del equipo", "type": "torneo" },
    "<otro_match_id>": { "include": false }
  }
  ```
  - `include: true` fuerza a contar como partida del equipo un custom que la regla automática no detectó (la regla pide al menos 4 jugadores del roster en el mismo lado).
- **Cambiar el roster:** edita `src/data/valorant/roster.json` con un PR.
- **Probar en local:** crea un `.env` con `HENRIKDEV_API_KEY=...` y corre:
  ```sh
  set -a; . ./.env; set +a
  node scripts/valorant/collect.ts /tmp/valorant-data
  VALORANT_DATA_DIR=/tmp/valorant-data npm run dev
  ```
