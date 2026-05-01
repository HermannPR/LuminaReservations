# WorkHub MTY

Sistema web para gestionar reservas de espacios de oficina y estacionamiento en WorkHub MTY. La aplicación permite consultar disponibilidad por fecha, horario, piso y zona; reservar escritorios o salas; solicitar estacionamiento como parte de una reserva de espacio; hacer check-in; visualizar ocupación real sobre planos; recibir recomendaciones inteligentes; administrar bloqueos operativos; y consultar accesos de estacionamiento desde una vista exclusiva para guardia.

Repositorio: `https://github.com/alexRodArana/WorkHub_MTY`

## Contenido

- `luminaBack-main`: API REST con Node.js, Express, TypeScript, PostgreSQL/Supabase y Vitest.
- `luminaFront-main`: SPA con React, Vite, TypeScript, CSS Modules y Vitest Testing Library.
- `README.md`: documentación raíz del proyecto.

## Funcionalidades Principales

- Autenticación JWT con roles.
- Reservas de espacios por fecha, horario, piso y categoría.
- Estacionamiento ligado obligatoriamente a una reserva de escritorio o sala.
- Mapa interactivo por piso con disponibilidad, ocupación y fotos de las personas que reservaron.
- Modal de ocupación por espacio con horarios, estado y perfil del ocupante.
- Perfil de usuario con foto cargada desde computadora o móvil.
- Predicción inteligente de ocupación basada en historial, demanda y distribución actual.
- Recomendaciones inteligentes resaltadas directamente en el mapa con brillo visual y explicación breve al hacer hover.
- Recomendaciones distribuidas entre pisos cuando el usuario no filtra un piso específico.
- Vista administrador con KPIs, medidores, gráficas de demanda, distribución por estado, top usuarios y bloqueo de áreas completas.
- Vista guardia exclusiva para revisar estacionamientos reservados del día.
- Monitoreo en tiempo real por Server-Sent Events para reflejar reservas, cancelaciones, check-ins y bloqueos sin refrescar la página.
- Mensajes de error y confirmación con cierre automático y animación.
- Diseño responsivo para desktop y móvil con transiciones y microanimaciones.

## Roles

- `employee`: usuario estándar. Puede reservar espacios, solicitar estacionamiento con su reserva, hacer check-in y gestionar su perfil.
- `admin` o `administrador`: acceso al dashboard operativo, KPIs y bloqueo/liberación de áreas.
- `guard` o `guardia`: acceso exclusivo a la vista de estacionamientos reservados.

La migración `migrate_hu17_remove_friends_parking_only_admin_ai.ts` crea el rol `guardia` si no existe.

El rol `guard`/`guardia` no tiene acceso a dashboard, nueva reserva, mis reservas, logros, perfil ni administración. Si intenta abrir otra ruta autenticada, el frontend lo redirige automáticamente a `/guardia`.

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

# Opcionales
ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=1
RESERVATION_TIMEZONE=America/Monterrey
CHECK_IN_ALLOWED_CIDRS=10.0.0.0/8,192.168.0.0/16
# CHECK_IN_WINDOW_OVERRIDE_MINUTES=30
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

## Datos Demo

Desde `luminaBack-main` existen scripts auxiliares para poblar datos de prueba:

```bash
npx ts-node seed_demo_users_and_reservations.ts
node seed_guard_user.js
```

Úsalos solo contra una base de desarrollo o QA. No ejecutes seeds de prueba en producción sin revisar el contenido.

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
- Mantiene estacionamiento como complemento de una reserva de espacio, no como reserva independiente.

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
- Restricción de rutas por rol para guardia.
- Integración UI: recomendación inteligente y reserva de escritorio con estacionamiento.

Última validación local:

- Backend: `npm test` con 14 pruebas y `npm run build`.
- Frontend: `npm run lint`, `npm test` con 12 pruebas y `npm run build`.

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
- `GET /reservations/events`
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
- Las reservas vencidas sin check-in se expiran automáticamente como `no_show`.

## Predicciones y Recomendaciones

El motor inteligente usa datos existentes del sistema y no requiere un proveedor externo. Es un modelo local, auditable y rápido diseñado para explicar sus decisiones en la interfaz sin bloquear el flujo manual de reserva.

Señales usadas:

- Ocupación histórica por día de semana, horario, piso y categoría.
- Reservas actuales del mismo horario.
- Usuarios con los que el usuario autenticado ha coincidido frecuentemente.
- Coordenadas del layout para priorizar espacios cercanos.
- Preferencias recientes del usuario por espacio, piso y categoría.
- Presión histórica de demanda por asiento.

La respuesta incluye:

- `predicted_occupancy`: porcentaje estimado.
- `prediction_label`: `baja`, `media` o `alta`.
- `model`: nombre, versión, confianza y factores usados.
- `recommendations`: espacios ordenados por score, confianza, señales, explicación breve y persona cercana si aplica.

En el frontend, las recomendaciones se muestran como brillo sobre el mapa. Si no hay filtro de piso, el backend reparte las recomendaciones entre pisos para evitar que todas queden concentradas en el primer piso. Al hacer hover sobre un espacio recomendado se muestra una razón corta, por ejemplo cercanía con una persona frecuente o afinidad con el historial del usuario.

## Monitoreo en Tiempo Real

La API expone `GET /reservations/events` como un canal SSE autenticado. El frontend mantiene una conexión `EventSource` mientras la sesión está activa y escucha eventos de:

- `reservation.created`
- `reservation.cancelled`
- `reservation.checked_in`
- `area_block.created`
- `area_block.deleted`

Cada evento incluye `id`, `type`, `timestamp` y, cuando aplica, fecha de reserva, espacio, piso, usuario actor y si afecta estacionamiento.

Vistas que se resincronizan sin refrescar:

- `/nueva-reserva`: disponibilidad, ocupación del mapa y recomendaciones.
- `/dashboard`: reserva del día, próximas reservas, historial corto y métricas de logros.
- `/mis-reservas`: lista activa o historial según la pestaña abierta.
- `/admin`: KPIs, gráficas, ocupación y bloqueos.
- `/guardia`: reservas de estacionamiento del día.

## Vista Administrador

La vista `/admin` muestra:

- Reservas totales del día.
- Reservas confirmadas, activas, canceladas y no show.
- Uso de estacionamiento.
- Usuarios únicos.
- Ocupación general.
- Medidores visuales de ocupación y estacionamiento.
- Distribución de reservas por estado.
- Demanda por hora.
- Usuarios con más actividad.
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

La ruta y el endpoint requieren rol `guard` o `guardia`; el usuario administrador no ve esta pestaña por defecto.

Además, el usuario guardia solo ve la pestaña Guardia en la navegación.

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
- Refresco selectivo por eventos realtime en lugar de recargar la aplicación completa.
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
7. Probar `/guardia` con usuario guardia.
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

- `luminaBack-main`: `npm test` con 14 pruebas, `npm run build`.
- `luminaFront-main`: `npm run lint`, `npm test` con 12 pruebas, `npm run build`.

## Seguridad

- No subas archivos `.env` ni tokens personales al repositorio.
- Rota cualquier token que haya sido pegado en chats, terminales compartidas o logs.
- Usa una base de datos separada para desarrollo, pruebas y producción.
- Revisa las migraciones destructivas antes de ejecutarlas contra datos reales.
