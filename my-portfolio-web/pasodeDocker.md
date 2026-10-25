# Docker — Paso a paso desde cero

Cada bloque empieza con un `cd` de ruta absoluta. Copia y pega el bloque completo:
da igual dónde esté la terminal, cae solo en la carpeta correcta.

**Resultado final:** 4 contenedores, en 2 stacks.

| Stack | Contenedor | Puerto host |
|-------|------------|-------------|
| `fastapi-portafolio` | `fastapi-portafolio-postgres-dev` | 5434 |
| `fastapi-portafolio` | `fastapi-portafolio-redis-dev`    | 6381 |
| `nest-portafolio`    | `nest-portafolio-postgres-dev`    | 5433 |
| `nest-portafolio`    | `nest-portafolio-redis-dev`       | 6380 |

---

## Paso 0 — Encender Docker Desktop

Abre Docker Desktop. Espera a que el engine esté corriendo.

Si al correr un `docker ...` sale `error during connect ... dockerDesktopLinuxEngine`,
es que Docker todavía no arrancó. Espera y repite.

---

## Paso 1 — Borrar los contenedores viejos

Los contenedores ya tienen el nombre nuevo, pero siguen colgando del **stack**
viejo (`fastapi-backend` / `nest-backend`). Hay que borrarlos para que se
recreen bajo el stack nuevo. El `-p` con el nombre viejo es obligatorio.

📁 **Carpeta: `fastapi-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\fastapi-backend
docker compose -p fastapi-backend -f docker-compose.dev.yml down
```

📁 **Carpeta: `nest-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\nest-backend
docker compose -p nest-backend -f docker-compose.dev.yml down
```

---

## Paso 2 — Levantar FastAPI

📁 **Carpeta: `fastapi-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\fastapi-backend
docker compose -f docker-compose.dev.yml up -d
```

---

## Paso 3 — Levantar NestJS

📁 **Carpeta: `nest-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\nest-backend
docker compose -f docker-compose.dev.yml up -d
```

**Comprobar** (📁 carpeta: cualquiera):

```bash
docker ps
```

Deben salir los 4 con nombre nuevo:

```
fastapi-portafolio-postgres-dev
fastapi-portafolio-redis-dev
nest-portafolio-postgres-dev
nest-portafolio-redis-dev
```

---

## Paso 4 — Migrar la base de datos de FastAPI

Las DB arrancan vacías (volumen nuevo). Hay que crear las tablas.

📁 **Carpeta: `fastapi-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\fastapi-backend
.venv/Scripts/python.exe -m alembic upgrade head
```

---

## Paso 5 — Migrar la base de datos de NestJS

📁 **Carpeta: `nest-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\nest-backend
npx prisma migrate deploy
npm run prisma:seed
```

> `prisma:seed` es opcional. Crea el usuario admin: `admin@portfolio.dev` / `admin12345`.

Listo. Ya tienes los 4 contenedores con los nombres nuevos y las DB migradas.

---

# Uso diario

## Levantar

📁 **Carpeta: `fastapi-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\fastapi-backend
docker compose -f docker-compose.dev.yml up -d
```

📁 **Carpeta: `nest-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\nest-backend
docker compose -f docker-compose.dev.yml up -d
```

## Apagar (conserva los datos)

📁 **Carpeta: `fastapi-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\fastapi-backend
docker compose -f docker-compose.dev.yml down
```

📁 **Carpeta: `nest-backend`.**

```bash
cd C:\Users\angui\Documents\my-portfolio-web\nest-backend
docker compose -f docker-compose.dev.yml down
```

> `down` a secas **conserva** los datos. `down -v` **sí los borra**.

## Comandos útiles

📁 **Carpeta: cualquiera** (van por nombre de contenedor, no dependen de la ruta).

```bash
docker logs -f nest-portafolio-postgres-dev
docker exec -it nest-portafolio-postgres-dev psql -U postgres -d portfolio_nest
docker exec -it fastapi-portafolio-postgres-dev psql -U postgres -d portfolio
docker exec -it fastapi-portafolio-redis-dev redis-cli
docker stop fastapi-portafolio-postgres-dev
```
andrea@g.com
123456789