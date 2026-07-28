<div align="center">

<img src="./image.png" alt="bgrun" width="600" />

**Gestor de procesos listo para producción con panel de control y API programática, diseñado para ejecutar sus contenedores, servicios y agentes de IA.**

[![npm](https://img.shields.io/npm/v/bgrun?color=F7A41D&label=npm&logo=npm)](https://www.npmjs.com/package/bgrun)
[![CI](https://github.com/Mements/bgr/actions/workflows/ci.yml/badge.svg)](https://github.com/Mements/bgr/actions/workflows/ci.yml)
[![bun](https://img.shields.io/badge/runtime-bun-F7A41D?logo=bun)](https://bun.sh/)
[![license](https://img.shields.io/npm/l/bgrun)](./LICENSE)

Inicie, detenga, reinicie y monitoree cualquier proceso — desde servidores de desarrollo hasta contenedores de Docker.
Configuración cero. Un solo comando. Panel de control hermoso incluido.

```bash
bunx bgrun --help
```

</div>

---

## ¿Por qué bgrun?

| Característica | PM2 | bgrun |
|----------------|-----|-------|
| Runtime | Node.js | Bun (inicio 5× más rápido) |
| Instalación | `npm i -g pm2` (50+ deps) | `bun i -g bgrun` (deps mínimas) |
| Formato config | JSON / JS / YAML | TOML (o ninguno) |
| Panel | `pm2 monit` (TUI) | `bgrun --dashboard` (web UI completa) |
| Soporte lenguaje | Cualquiera | Cualquiera |
| Consciente de Docker | ❌ | ✅ detecta estado del contenedor |
| Gestión de puertos | Manual | Detección y limpieza automática |
| Observación de archivos | Integrada | Integrada |
| API programática | ✅ | ✅ (TypeScript de primera clase) |
| Persistencia de procesos | ✅ | ✅ (SQLite) |

> **Nota:** Se prefiere `bunx bgrun`. El comando `bgrun` simple solo funciona si lo instaló globalmente o ya tiene un shim correspondiente en el `PATH`.

---

## Inicio Rápido

```bash
# Ejecutar sin instalación global
bunx bgrun --help

# Omitir la carga automática de .config.toml para comandos únicos
bunx bgrun --no-config -- bun run script.ts

# Iniciar un proceso
bunx bgrun --name my-api --directory ./my-project --command "bun run server.ts"

# Iniciar un proceso gestionado con un nombre de fecha generado automáticamente
bunx bgrun -- bun run server.ts

# Ejecutar en la terminal actual con el entorno de config cargado
bunx bgrun inline -- bun run dev

# Exportar el entorno de config en su shell actual
Invoke-Expression (bunx bgrun envit)

# Listar todos los procesos
bunx bgrun

# Abrir el panel web
bunx bgrun --dashboard
```

Eso es todo. bgrun rastrea el PID, captura stdout/stderr, detecta el puerto y sobrevive al cierre de la terminal.

---

## 📊 Panel Web

\
Inicie con `bunx bgrun --dashboard` y abra `http://localhost:3001`. Los procesos se agrupan automáticamente por directorio de trabajo.

**Exponga con Caddy** para acceso remoto:

```
bgrun.yourdomain.com {
    reverse_proxy localhost:3001
}
```

Características:
- Estado del proceso en tiempo real vía SSE (sin polling)
- Iniciar, detener, reiniciar y eliminar procesos desde la UI
- Visor de logs stdout/stderr en vivo con búsqueda y desplazamiento virtual
- Memoria, PID, puerto, runtime y reinicios del guardián a simple vista
- Interruptor de guardián por proceso (reinicio automático en caso de fallo)
- Atajos de teclado — `↑/↓` o `j/k` para navegar, `Enter` para abrir, `R` reiniciar, `S` detener, `G` guardián, `D` eliminar, `N` nuevo, `?` ayuda
- Búsqueda con debounce, insignia de conteo de resultados y persistencia entre actualizaciones SSE
- Desplazamiento virtual auto-calibrado para archivos de log grandes (10K+ líneas)
- Alternancia de tema oscuro / claro
- Diseño móvil responsivo con vista de tarjetas
- Grupos de directorios colapsables
- Menú contextual de clic derecho en las filas de procesos

---

## Tabla de Contenidos

- [Comandos Core](#core-commands)
- [Panel de Control](#dashboard)
- [Observación de Archivos](#file-watching)
- [Manejo de Puertos](#port-handling)
- [Integración con Docker](#docker-integration)
- [Proxy Inverso Caddy](#caddy-reverse-proxy)
- [Configuración TOML](#toml-configuration)
- [API Programática](#programmatic-api)
- [Dependencias de Procesos](#process-dependencies)
- [Rotación de Logs](#log-rotation)
- [Guardián (Auto-Reinicio)](#guard-auto-restart)
- [Migrando desde PM2](#migrating-from-pm2)
- [Casos Borde y Comportamientos](#edge-cases--behaviors)
- [Referencia Completa de CLI](#full-cli-reference)

---

## Comandos Core

### Iniciar un proceso

```bash
bgrun --name my-api \
    --directory ~/projects/my-api \
    --command "bun run server.ts"
```

Inicio gestionado anónimo:

```bash
bgrun -- bun run server.ts
```

Esto genera un nombre basado en la fecha, como `april-fifth`. Si ese nombre ya existe, bgrun añade `-hhmmss`.

Forma corta — si ya está *dentro* del directorio del proyecto:

```bash
bgrun --name my-api --command "bun run server.ts"
# bgrun usa el directorio actual por defecto
```

### Listar procesos

```bash
bgrun                  # Tabla legible
bgrun --json           # JSON legible por máquina
bgrun --filter api     # Filtrar por grupo (env BGR_GROUP)
```

### Ver un proceso

```bash
bgrun my-api           # Mostrar estado, PID, puerto, runtime, comando
bgrun my-api --logs    # Mostrar stdout + stderr entrelazados
bgrun my-api --logs --log-stdout --lines 50  # Solo las últimas 50 líneas de stdout
```

### Detener, reiniciar, eliminar

```bash
bgrun --stop my-api       # Detención gradual (SIGTERM → SIGKILL)
bgrun --restart my-api     # Detener y luego iniciar de nuevo con el mismo comando
bgrun --delete my-api      # Detener y eliminar de la base de datos
bgrun --clean              # Eliminar todos los procesos detenidos
bgrun --nuke               # ☠️  Eliminar todo
```

### Reinicio forzado

Cuando un proceso se queda trabado o su puerto queda huérfano:

```bash
bgrun --name my-api --command "bun run server.ts" --force
```

`--force` hará lo siguiente:
1. Matar el proceso existente mediante el PID
2. Detectar todos los puertos que estaba usando (vía `netstat` del OS)
3. Matar cualquier proceso zombie que aún mantenga esos puertos
4. Esperar a que los puertos se liberen
5. Iniciar desde cero

---

## Dashboard

bgrun incluye un panel web integrado para gestionar todos sus procesos visualmente.

```bash
bgrun --dashboard
```

El panel proporciona:
- **Tabla de procesos en tiempo real** con estado, PID, puerto, runtime
- Acciones de **inicio/detención/reinicio/eliminación** con un solo clic
- **Visor de logs** con pantalla monoespaciada y auto-scroll
- **Cajón de detalles del proceso** con pestañas de stdout/stderr
- **Auto-actualización** cada 5 segundos

### Selección de puerto del panel

El panel utiliza [Melina.js](https://github.com/7flash/melina.js) para el servicio y sigue una selección de puerto inteligente:

| Escenario | Comportamiento |
|-----------|----------------|
| `bgrun --dashboard` | Inicia en el puerto 3000. Si está ocupado, retrocede automáticamente a 3001, 3002, etc. |
| `BUN_PORT=4000 bgrun --dashboard` | Inicia en el puerto 4000. Falla con error si el puerto está ocupado. |
| `bgrun --dashboard --port 5000` | Igual que `BUN_PORT=5000` — explícito, sin retroceso. |
| Panel ya en ejecución | Imprime la URL actual y el PID en lugar de iniciar una segunda instancia. |

El puerto real siempre se detecta desde el proceso en ejecución y se muestra correctamente en la salida de `bgrun`.

---

## Observación de Archivos

Para desarrollo, bgrun puede observar cambios en los archivos y reiniciar automáticamente:

```bash
bgrun --name frontend \
    --directory ~/projects/frontend \
    --command "bun run dev" \
    --watch
```

Esto monitorea el directorio de trabajo en busca de cambios y reinicia el proceso cuando se modifican los archivos. Combine con `--force` para asegurar reinicios limpios:

```bash
bgrun --name api \
    --command "bun run server.ts" \
    --watch \
    --force \
    --config .dev.toml
```

---

## Manejo de Puertos

bgrun detecta automáticamente en qué puertos TCP está escuchando un proceso consultando el OS. Esto significa:

- **No se necesita configuración de puertos** — bgrun descubre los puertos desde `netstat`
- **No hay suposiciones de variables de entorno** — bgrun no adivina `PORT` o `BUN_PORT`
- **Reinicios limpios** — `--force` mata todas las vinculaciones de puertos huérfanas antes de reiniciar
- **Visualización precisa** — el puerto mostrado en la salida de `bgrun` es el puerto vinculado *real*

### Cómo funciona

```
1. bgrun lanza su proceso
2. El proceso inicia y se vincula a un puerto (como desee)
3. bgrun consulta `netstat -ano` (Windows) o `ss -tlnp` (Linux)
4. bgrun encuentra todos los puertos TCP LISTEN para el PID del proceso
5. Estos puertos se muestran en la tabla y se usan para la limpieza
```

### Resolución de conflictos de puertos

Si reinicia un proceso con `--force` y su puerto antiguo aún está retenido por un zombie:

```
1. bgrun detecta los puertos retenidos por el PID antiguo
2. Envía SIGTERM al proceso antiguo
3. Mata cualquier proceso restante en esos puertos
4. Espera a que los puertos queden libres (hasta 5 segundos)
5. Inicia el nuevo proceso
```

---

## Integración con Docker

bgrun puede gestionar contenedores de Docker junto con procesos regulares:

```bash
# Iniciar un contenedor de Postgres
bgrun --name postgres \
    --command "docker run --name bgr-postgres -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16"

# Iniciar un contenedor de Redis
bgrun --name redis \
    --command "docker run --name bgr-redis -p 6379:6379 redis:7-alpine"
```

### Cómo maneja bgrun Docker

bgrun es **consciente de Docker** — cuando detecta un comando `docker run`, hace lo siguiente:

1. **Verifica el estado del contenedor** vía `docker inspect` en lugar de verificar el PID
2. **Gestiona el ciclo de vida del contenedor** — detiene contenedores con `docker stop` al ejecutar `bgrun --stop`
3. **Reporta el estado correcto** — muestra Running/Stopped basado en el estado del contenedor, no en el estado del proceso

### Alternativa a Docker Compose

En lugar de `docker-compose.yml`, use bgrun para orquestar contenedores junto con su app:

```bash
#!/bin/bash
# start-stack.sh

# Base de datos
bgrun --name db \
    --command "docker run --name bgr-db -p 5432:5432 \
              -v pgdata:/var/lib/postgresql/data \
              -e POSTGRES_DB=myapp \
              -e POSTGRES_PASSWORD=secret \
              postgres:16" \
    --force

# Caché
bgrun --name cache \
    --command "docker run --name bgr-cache -p 6379:6379 redis:7-alpine" \
    --force

# Su app (no Docker, solo un proceso regular)
bgrun --name api \
    --directory ~/projects/my-api \
    --command "bun run server.ts" \
    --config production.toml \
    --force

# Ver todo
bgrun
```

La ventaja sobre Docker Compose: los procesos de su app y los contenedores de Docker se gestionan en el **mismo lugar** con los **mismos comandos**.

---

## Proxy Inverso Caddy

bgrun se complementa naturalmente con [Caddy](https://caddyserver.com/) para despliegues en producción con HTTPS automático.

### Configuración básica

```bash
# Inicia su app en cualquier puerto (bgrun lo detecta)
bgrun --name my-api --command "bun run server.ts" --force

# Verifique qué puerto obtuvo
bgrun
# → my-api  ● Running  :3000  bun run server.ts
```

**Caddyfile:**

```caddy
api.example.com {
    reverse_proxy localhost:3000
}

dashboard.example.com {
    reverse_proxy localhost:3001
}
```

### Configuración multiservicio

```bash
# Iniciar servicios
bgrun --name api       --command "bun run api/server.ts"     --force
bgrun --name frontend  --command "bun run frontend/server.ts" --force
bgrun --name admin     --command "bun run admin/server.ts"    --force

# Iniciar panel
bgrun --dashboard
```

### Gestionando Caddy con bgrun

Incluso puede gestionar el propio Caddy como un proceso de bgrun:

```bash
bgrun --name caddy \
    --directory /etc/caddy \
    --command "caddy run --config Caddyfile" \
    --force
```

Ahora `bgrun` muestra todo su stack — servidores de app, bases de datos y proxy inverso — en un solo lugar.

---

## Configuración TOML

bgrun carga archivos de configuración TOML y los aplana en variables de entorno:

```bash
bgrun --name api --command "bun run server.ts" --config production.toml
```

```toml
# production.toml
[server]
port = 3000
host = "0.0.0.0"

[database]
url = "postgresql://localhost/myapp"
pool_size = 10

[auth]
jwt_secret = "your-secret-here"
session_ttl = 3600
```

**Se convierte en:**
```
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
DATABASE_URL=postgresql://localhost/myapp
DATABASE_POOL_SIZE=10
AUTH_JWT_SECRET=your-secret-here
AUTH_SESSION_TTL=3600
```

La convención: `[section]` se convierte en el prefijo, `key` en el sufijo, unidos por `_` y en mayúsculas.

Si no se especifica `--config`, bgrun busca automáticamente `.config.toml` en el directorio de trabajo.

### Cargar entorno de config sin gestionar el proceso

Ejecute un comando en la terminal actual con el entorno de config aplicado:

```bash
bgrun inline -- bun run dev
```

Imprima comandos de shell que exportan los valores de config en su shell actual:

```powershell
Invoke-Expression (bgrun envit)
```

```bash
eval "$(bgrun envit --shell sh)"
```

---

## API Programática

bgrun expone sus internos como funciones de TypeScript importables:

> **Nota de empaquetado:** la CLI se distribuye desde `dist/index.js`, la API programática de Bun se resuelve a través de `dist/api.js`, y el backend del panel utiliza artefactos de tiempo de ejecución construidos en `dist/*` vía `dashboard/lib/runtime.ts`.
> Los paquetes publicados ahora son prioritarios en `dist`; los archivos `src/` del repositorio siguen siendo la fuente de verdad para desarrollo/construcción y no forman parte de la superficie del paquete de tiempo de ejecución.
> **Hooks de construcción:** `npm`/`bun` ejecutan el script `prepare` del paquete en la instalación local desde el repo y antes del empaquetado/publicación, por lo que se activa `bun run build` para refrescar `dist/`. `prepublishOnly` también ejecuta `bun run build` justo antes de `npm publish`.

```bash
bun add bgrun
```

### Gestión de procesos

```typescript
import {
  getAllProcesses,
  getProcess,
  isProcessRunning,
  terminateProcess,
  handleRun,
  getProcessPorts,
  readFileTail,
  calculateRuntime,
} from 'bgrun'

// Listar todos los procesos
const procs = getAllProcesses()

// Iniciar un proceso programáticamente
await handleRun({
  action: 'run',
  name: 'my-api',
  command: 'bun run server.ts',
  directory: '/path/to/project',
  force: true,
  remoteName: '',
})

// Verificar estado
const proc = getProcess('my-api')
if (proc) {
  const alive = await isProcessRunning(proc.pid)
  const ports = await getProcessPorts(proc.pid)
  const runtime = calculateRuntime(proc.timestamp)
  console.log({ alive, ports, runtime })
}

// Leer logs
const myProc = getProcess('my-api')
if (myProc) {
  const stdout = await readFileTail(myProc.stdout_path, 100) // últimas 100 líneas
  const stderr = await readFileTail(myProc.stderr_path, 100)
}

// Detener un proceso
await terminateProcess(proc.pid)
```

### Construir un panel personalizado

```typescript
import { getAllProcesses, isProcessRunning, calculateRuntime } from 'bgrun'

// Endpoint de Express/Hono/Elysia
export async function GET() {
  const procs = getAllProcesses()
  const enriched = await Promise.all(
    procs.map(async (p) => ({
      name: p.name,
      pid: p.pid,
      running: await isProcessRunning(p.pid),
      runtime: calculateRuntime(p.timestamp),
    }))
  )
  return Response.json(enriched)
}
```

---

## Migrando desde PM2

Si viene de PM2, aquí tiene un mapeo directo de comandos:

### Mapeo de comandos

| PM2 | bgrun |
|-----|-------|
| `pm2 start app.js --name api` | `bgrun --name api --command "node app.js"` |
| `pm2 start app.js -i max` | *(cluster mode no soportado — use múltiples procesos nombrados)* |
| `pm2 list` | `bgrun` |
| `pm2 show api` | `bgrun api` |
| `pm2 logs api` | `bgrun api --logs` |
| `pm2 logs api --lines 50` | `bgrun api --logs --lines 50` |
| `pm2 stop api` | `bgrun --stop api` |
| `pm2 restart api` | `bgrun --restart api` |
| `pm2 delete api` | `bgrun --delete api` |
| `pm2 flush` | `bgrun --clean` |
| `pm2 kill` | `bgrun --nuke` |
| `pm2 monit` | `bgrun --dashboard` |
| `pm2 save` / `pm2 resurrect` | *(automático — los procesos persisten en SQLite)* |

### ecosystem.config.js → TOML + shell script

**Archivo ecosystem de PM2:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'server.js',
      cwd: './api',
      env: { PORT: 3000, NODE_ENV: 'production' },
    },
    {
      name: 'worker',
      script: 'worker.js',
      cwd: './workers',
      env: { QUEUE: 'default' },
    },
  ],
}
```

**Equivalente en bgrun:**

```toml
# api.toml
[server]
port = 3000

[node]
env = "production"
```

```bash
#!/bin/bash
# start.sh
bgrun --name api    --directory ./api     --command "node server.js" --config api.toml --force
bgrun --name worker --directory ./workers --command "node worker.js" --force
```

### Diferencias clave

1. **Sin modo cluster** — bgrun gestiona procesos independientes. Para multi-núcleo, ejecute múltiples instancias nombradas (`api-1`, `api-2`) detrás de un balanceador de carga.

2. **Sin `pm2 startup`** — bgrun no se instala como un servicio del sistema. Use el sistema de inicio de su OS (systemd, launchd, Programador de Tareas de Windows) para ejecutar bgrun al arrancar:

   ```ini
   # /etc/systemd/system/bgrun-api.service
   [Unit]
   Description=My API via bgrun

   [Service]
   ExecStart=/usr/local/bin/bgrun --name api --directory /var/www/api --command "bun run server.ts" --force
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. **Rotación de logs integrada** — bgrun rota automáticamente los logs cuando superan los 10MB, manteniendo las últimas 5000 líneas. La rotación manual también está disponible vía la API del panel.

4. **Bun requerido** — bgrun se ejecuta en Bun, pero los *procesos que gestiona* pueden ser cualquier cosa: Node.js, Python, Ruby, Go, Docker, scripts de shell.

---

## Dependencias de Procesos

bgrun admite la declaración de dependencias de inicio de procesos mediante la variable de entorno `BGR_DEPENDS_ON`:

```bash
# Iniciar un escuchador de precios (sin dependencias)
bgrun --name price-feed --command "bun run sqd.ts" --force

# Iniciar un worker que depende del flujo de precios
BGR_DEPENDS_ON=price-feed bgrun --name mm-worker --command "bun run worker.ts" --force
```

Cuando inicia `mm-worker`, bgrun iniciará automáticamente `price-feed` primero si no se está ejecutando ya.

### Características

- **Ordenamiento topológico** — los procesos se inician en el orden de dependencia correcto
- **Detección de ciclos** — bgrun advierte si las dependencias forman un ciclo
- **Auto-inicio** — las dependencias no satisfechas se inician automáticamente
- **API** — `GET /api/deps` devuelve el grafo completo de dependencias con el orden de inicio

### Configuración de dependencias vía API

```bash
curl -X POST http://localhost:3001/api/deps \
  -H 'Content-Type: application/json' \
  -d '{"name": "mm-worker", "dependsOn": ["price-feed", "redis"]}'
```

---

## Rotación de Logs

bgrun incluye rotación automática de logs para evitar el crecimiento ilimitado de los archivos:

- **Rotación basada en tamaño**: Los archivos que superen los 10MB se truncan, manteniendo las últimas 5000 líneas
- **Verificaciones automáticas**: La rotación se ejecuta cada 60 segundos junto con el panel
- **Encabezado de rotación**: Los archivos rotados incluyen un encabezado de marca de tiempo para auditabilidad
- **Rotación manual**: Se activa a través de la API del panel

```bash
# Verificar tamaños de logs
curl http://localhost:3001/api/logs/rotate

# Forzar rotación ahora
curl -X POST http://localhost:3001/api/logs/rotate
```

---

## Guardián (Auto-Reinicio)

bgrun incluye un proceso guardián independiente que monitorea y reinicia automáticamente los procesos que fallan:

```bash
# Habilitar el guardián para un proceso
BGR_KEEP_ALIVE=true bgrun --name my-api --command "bun run server.ts" --force
```

El guardián verifica los procesos cada 30 segundos y reinicia cualquiera que se haya detenido. Características:

- **Backoff exponencial** — evita tormentas de reinicios para procesos que fallan repetidamente
- **Interruptor por proceso** — habilite/deshabilite el guardián mediante el icono del escudo en el panel
- **Centinela del guardián** — el panel muestra un punto verde pulsante cuando el guardián está activo
- **Contador de reinicios** — el panel rastrea el total de reinicios del guardián en todos los procesos

---

## Casos Borde y Comportamientos

### ¿Qué pasa cuando un proceso falla?

bgrun registra el proceso como **Detenido (Stopped)**. El PID y los archivos de log se preservan para que pueda inspeccionar qué sucedió:

```bash
bgrun my-api --logs --log-stderr
```

Para el auto-reinicio en caso de fallo, use el script del guardián:

```bash
bun run guard.ts my-api 30  # Verificar cada 30 segundos, reiniciar si está muerto
```

### ¿Qué pasa con `bgrun --force` si el puerto está trabado?

bgrun consulta al OS todos los puertos TCP retenidos por el PID antiguo, los mata y espera hasta 5 segundos para la limpieza. Si los puertos siguen retenidos después de eso, el nuevo proceso se inicia de todos modos (y probablemente elegirá un puerto diferente).

### ¿Qué pasa si inicio dos procesos con el mismo nombre?

El nuevo proceso reemplaza al antiguo. Si el antiguo todavía se está ejecutando, use `--force` para matarlo primero. Sin `--force`, bgrun se negará a iniciar si ya hay un proceso ejecutándose con ese nombre.

### ¿Qué pasa si se mata el propio bgrun?

Los procesos gestionados siguen ejecutándose — son procesos independientes del OS. Cuando ejecute `bgrun` nuevamente, se reconectará a la base de datos SQLite y verificará qué PIDs siguen vivos. Los procesos muertos se marcan como **Detenidos (Stopped)**.

### ¿Y en Windows?

bgrun funciona en Windows. La gestión de procesos utiliza `taskkill` y `wmic` en lugar de señales de Unix. La detección de puertos utiliza `netstat -ano`. El panel se ejecuta en su navegador, por lo que funciona en todas partes.

### ¿Puedo gestionar procesos en un servidor remoto?

No directamente — bgrun gestiona procesos en la máquina local. Para la gestión remota, ejecute bgrun en el servidor remoto y exponga el panel detrás de un proxy inverso (vea la [sección de Caddy](#caddy-reverse-proxy)).

---

## Rutas de Log Personalizadas

Por defecto, los logs van a `~/.bgr/<nombre>-out.txt` y `~/.bgr/<nombre>-err.txt`. Sobrescriba con:

```bash
bgrun --name api \
    --command "bun run server.ts" \
    --stdout /var/log/api/stdout.log \
    --stderr /var/log/api/stderr.log
```

O proporcione un directorio y deje que `bgrun` derive ambos nombres de archivo de log a partir del nombre del proceso:

```bash
bgrun --name api \
    --command "bun run server.ts" \
    --logs-dir /var/log/api
```

---

## Grupos de Procesos

Etiquete procesos con `BGR_GROUP` para organizarlos y filtrarlos:

```bash
BGR_GROUP=prod bgrun --name api         --command "bun run server.ts" --force
BGR_GROUP=prod bgrun --name worker      --command "bun run worker.ts" --force
BGR_GROUP=dev  bgrun --name dev-server  --command "bun run dev"       --force

# Mostrar solo procesos de producción
bgrun --filter prod

# Mostrar solo procesos de desarrollo
bgrun --filter dev
```

---

## Integración con Git

Obtenga los últimos cambios antes de iniciar:

```bash
bgrun --name api \
    --directory ~/projects/api \
    --command "bun run server.ts" \
    --fetch \
    --force
```

`--fetch` ejecuta `git pull` en el directorio de trabajo antes de iniciar el proceso. Combine con `--force` para un flujo de despliegue limpio:

```bash
# Script de despliegue
bgrun --name api --directory /var/www/api --command "bun run server.ts" --fetch --force
```

---

## Estructura de Archivos

```
~/.bgr/
├── bgr.sqlite              # Base de datos de procesos (SQLite)
├── myapp-out.txt           # logs de stdout
├── myapp-err.txt           # logs de stderr
├── bgr-dashboard-out.txt   # stdout del Panel
└── bgr-dashboard-err.txt   # stderr del Panel
```

Todo el estado reside en `~/.bgr/`. Para restablecer todo, elimine este directorio.

---

## Referencia Completa de CLI

| Opción | Descripción | Defecto |
|---------|-------------|---------|
| `--name <nombre>` | Nombre del proceso | *(requerido para inicio)* |
| `--directory <ruta>` | Directorio de trabajo | Directorio actual |
| `--command <cmd>` | Comando a ejecutar | *(requerido para inicio)* |
| `--config <ruta>` | Archivo config TOML para variables de entorno | `.config.toml` |
| `--force` | Matar proceso y puertos existentes antes de iniciar | `false` |
| `--fetch` | Ejecutar git pull antes de iniciar | `false` |
| `--watch` | Auto-reiniciar al cambiar archivos | `false` |
| `--stdout <ruta>` | Ruta personalizada para log de stdout | `~/.bgr/<name>-out.txt` |
| `--stderr <ruta>` | Ruta personalizada para log de stderr | `~/.bgr/<name>-err.txt` |
| `--db <ruta>` | Ruta personalizada para base de datos SQLite | `~/.bgr/bgr.sqlite` |
| `--json` | Salida de la lista de procesos en JSON | `false` |
| `--filter <grupo>` | Filtrar por `BGR_GROUP` | *(mostrar todos)* |
| `--logs` | Mostrar logs del proceso | `false` |
| `--log-stdout` | Mostrar solo stdout | `false` |
| `--log-stderr` | Mostrar solo stderr | `false` |
| `--lines <n>` | Número de líneas de log | Todas |
| `--stop <nombre>` | Detener un proceso | - |
| `--restart <nombre>` | Reiniciar un proceso | - |
| `--delete <nombre>` | Eliminar un proceso | - |
| `--clean` | Eliminar procesos detenidos | - |
| `--nuke` | Eliminar TODOS los procesos | - |
| `--dashboard` | Lanzar panel web | - |
| `--port <número>` | Puerto para el panel | 3000 |
| `--version` | Mostrar versión | - |
| `--help` | Mostrar ayuda | - |

### Variables de Entorno

| Variable | Descripción | Defecto |
|----------|-------------|---------|
| `DB_NAME` | Nombre personalizado del archivo de base de datos | `bgr` |
| `BGR_GROUP` | Asignar proceso a un grupo | *(ninguno)* |
| `BGR_KEEP_ALIVE` | Habilitar auto-reinicio del guardián para este proceso | `false` |
| `BGR_DEPENDS_ON` | Lista separada por comas de dependencias de procesos | *(ninguno)* |
| `BUN_PORT` | Puerto del panel (explícito, sin retroceso) | *(auto: 3000+)* |

---

## Requisitos

- [Bun](https://bun.sh) v1.0.0+

---

## Licencia

MIT

---

<div align="center">

Construido con ⚡ Bun

</div>
