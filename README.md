# Lumina WorkHub MTY

Sistema web para reservar espacios de oficina y estacionamiento en WorkHub MTY. La aplicación permite consultar disponibilidad por fecha, horario y zona, reservar escritorios o salas, solicitar estacionamiento como parte de una reserva de escritorio, hacer check-in, ver ocupación real en el mapa, administrar bloqueos de áreas y consultar accesos de estacionamiento para guardia.

## Contenido

- `luminaBack-main`: API REST con Node.js, Express, TypeScript, PostgreSQL/Supabase y Vitest.
- `luminaFront-main`: SPA con React, Vite, TypeScript, CSS Modules y Vitest Testing Library.
- `README.md`: guía raíz del proyecto.

## Funcionalidades Principales

- Autenticación JWT con roles.
- Reservas de espacios por fecha, horario, piso y categoría.
- Estacionamiento ligado obligatoriamente a una reserva de escritorio o sala.
- Mapa interactivo por piso con disponibilidad, ocupación y fotos de las personas que reservaron.
- Modal de ocupación por espacio con horarios, estado y perfil del ocupante.
- Perfil de usuario con foto cargada desde computadora o móvil.
- Predicción inteligente de ocupación basada en historial.
- Recomendaciones inteligentes de espacios cercanos a personas con las que el usuario suele coincidir.
- Vista administrador con KPIs, gráficas simples y bloqueo de áreas completas.
- Vista guardia para revisar estacionamientos reservados del día.
- Mensajes de error y confirmación con cierre automático y animación.
- Diseño responsivo para desktop y móvil.

## Roles

- `employee`: usuario estándar. Puede reservar espacios, solicitar estacionamiento con su reserva, hacer check-in y gestionar su perfil.
- `admin` o `administrador`: acceso completo a KPIs, bloqueo de áreas y vista guardia.
- `guard` o `guardia`: acceso a la vista de estacionamiento del día.

La migración `migrate_hu17_remove_friends_parking_only_admin_ai.ts` crea el rol `guardia` si no existe.

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL accesible mediante `DATABASE_URL`.
- Variables de entorno del backend.

## Variables de Entorno

Crear `luminaBack-main/.env`:

```env
JWT_SECRET=<secret-seguro>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600

PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://<usuario>:<password>@<host>:<puerto>/<db>
```

Crear `luminaFront-main/.env` solo si la API no corre en `http://localhost:3000`:

```env
VITE_API_URL=http://localhost:3000
```

## Instalación

```bash
cd luminaBack-main
npm install

cd ../luminaFront-main
npm install
```

## Migraciones

Ejecutar desde `luminaBack-main`.

```bash
npx ts-node migrate_hu17_remove_friends_parking_only_admin_ai.ts
```

Esta migración es destructiva por diseño porque aplica los cambios solicitados:

- Elimina la tabla `friendships`.
- Borra reservas sin `space_id`.
- Hace `reservations.space_id` obligatorio.
- Crea `area_blocks`.
- Crea el rol `guardia` si falta.

Recomendación: aplicarla primero en una base de prueba antes de producción.

## Ejecución Local

Backend:

```bash
cd luminaBack-main
npm run dev
```

Frontend:

```bash
cd luminaFront-main
npm run dev
```

URLs por defecto:

- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Pruebas

Backend:

```bash
cd luminaBack-main
npm test
```

Frontend:

```bash
cd luminaFront-main
npm test
```

Build:

```bash
cd luminaBack-main
npm run build

cd ../luminaFront-main
npm run build
```

Cobertura funcional incluida:

- Servicio de reservas: creación con/sin estacionamiento, rechazo sin escritorio, recomendaciones inteligentes.
- Controladores de reservas: creación, errores, ocupación con perfil, recomendaciones.
- Admin/guardia: bloqueo de áreas y consulta de estacionamientos.
- Perfil: lectura y actualización de foto.
- Frontend services: disponibilidad, ocupación, recomendaciones, admin, guardia y perfil.
- Integración UI: recomendación inteligente y reserva de escritorio con estacionamiento.

## Arquitectura

### Backend

- `src/index.ts`: configuración de Express, CORS, JSON body limit y rutas.
- `src/auth`: login, JWT, perfil y repositorios de usuario/roles.
- `src/reservations`: reservas, pisos, estacionamiento, gamificación, recomendaciones, admin y guardia.
- `src/shared`: autenticación y contrato común de base de datos.

### Frontend

- `src/components`: pantallas y componentes visuales.
- `src/services`: clientes HTTP.
- `src/types`: contratos compartidos del frontend.
- `src/utils`: validación y helpers.
- `src/data`: etiquetas y layouts base.

## API Principal

Autenticación:

- `POST /auth/login`
- `GET /auth/profile`
- `PATCH /auth/profile`

Reservas:

- `GET /reservations/availability`
- `GET /reservations/occupancy`
- `GET /reservations/recommendations`
- `POST /reservations`
- `GET /reservations/my`
- `POST /reservations/:id/check-in`
- `DELETE /reservations/:id`

Pisos:

- `GET /reservations/floors`
- `GET /reservations/floors/:id/spaces`

Admin:

- `GET /reservations/admin/overview`
- `POST /reservations/admin/area-blocks`
- `DELETE /reservations/admin/area-blocks/:id`

Guardia:

- `GET /reservations/guard/parking`

## Reglas de Negocio

- Toda reserva requiere escritorio, sala o espacio reservable.
- El estacionamiento solo se solicita dentro de una reserva de espacio.
- El estacionamiento requiere al menos 24 horas de anticipación.
- Un usuario no puede tener reservas de oficina traslapadas.
- Un usuario no puede tener estacionamientos traslapados.
- Un espacio bloqueado por admin no aparece disponible ni puede reservarse.
- El check-in respeta ventana de anticipación y red permitida si se configura.

## Predicciones y Recomendaciones

El motor inteligente usa datos existentes del sistema:

- Ocupación histórica por día de semana, horario, piso y categoría.
- Reservas actuales del mismo horario.
- Usuarios con los que el usuario autenticado ha coincidido frecuentemente.
- Coordenadas del layout para priorizar espacios cercanos.

La respuesta incluye:

- `predicted_occupancy`: porcentaje estimado.
- `prediction_label`: `baja`, `media` o `alta`.
- `recommendations`: espacios ordenados por score, razones y persona cercana si aplica.

No requiere proveedor externo de IA; es un motor local, auditable y rápido.

## Vista Administrador

La vista `/admin` muestra:

- Reservas totales del día.
- Reservas activas.
- Reservas con estacionamiento.
- Usuarios únicos.
- Ocupación general.
- Ocupación por piso.
- Ocupación por categoría.
- Bloqueos activos.

También permite bloquear o liberar un área completa por piso y categoría.

## Vista Guardia

La vista `/guardia` muestra reservas de estacionamiento por fecha:

- Persona.
- Foto o iniciales.
- Lugar asignado.
- Horario.
- Código de reserva.
- Espacio de oficina asociado.

## Fotos de Perfil

Las fotos se guardan como data URL en `users.profile_photo_url`.

Restricciones:

- PNG, JPG/JPEG o WEBP.
- Tamaño máximo validado por backend: 750 KB.
- El frontend recorta y comprime a avatar cuadrado antes de enviar.

## Rendimiento

Mejoras incluidas:

- Consultas independientes en paralelo con `Promise.all`.
- Recomendaciones y disponibilidad consultadas en paralelo desde UI.
- Agrupación de ocupación por espacio en backend para reducir trabajo del cliente.
- Eliminación de llamadas sociales innecesarias.
- Memos en mapa para lookups por espacio.
- Asignación de estacionamiento transaccional con `FOR UPDATE SKIP LOCKED`.
- Build de producción con Vite y TypeScript.

## Operación

Para validar una instalación:

1. Aplicar migración en base de prueba.
2. Ejecutar backend.
3. Ejecutar frontend.
4. Iniciar sesión con un usuario activo.
5. Probar `/nueva-reserva`.
6. Probar `/admin` con usuario admin.
7. Probar `/guardia` con usuario admin o guardia.
8. Correr pruebas y builds.

## Troubleshooting

- `UNAUTHORIZED`: token expirado o no enviado.
- `FORBIDDEN`: usuario sin rol requerido.
- `PARKING_TOO_LATE`: estacionamiento solicitado con menos de 24 horas.
- `PARKING_CONFLICT`: el usuario ya tiene estacionamiento traslapado.
- `SPACE_UNAVAILABLE`: el espacio fue reservado o bloqueado.
- `DATABASE_ERROR`: revisar `DATABASE_URL`, migraciones y conectividad.

## Estado de Calidad

Comandos verificados durante el desarrollo:

- `luminaBack-main`: `npm test`, `npm run build`
- `luminaFront-main`: `npm test`, `npm run build`, `npm run lint`
