# ⭐ Mission Control

Un dashboard de observabilidad en tiempo real para el framework OpenClaw, construido con React, Tailwind CSS, Zustand y Socket.io.

## Estructura del Proyecto

El proyecto está dividido en dos partes principales:
- `frontend/`: Aplicación React (Vite)
- `backend/`: Servidor Node.js con Express y Socket.io

## Cómo ejecutar el proyecto

Para correr el proyecto completo necesitas dos terminales.

### 1. Iniciar el Backend

Abre una terminal y ejecuta:

```bash
cd backend
node server.js
```

El servidor iniciará en el puerto 3000 y comenzará a emitir eventos de log y estado de agentes.

### 2. Iniciar el Frontend

Abre otra terminal y ejecuta:

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`. Abre esa URL en tu navegador.

## Características

- **Dashboard:** Métricas generales del sistema.
- **Live Feed:** Registro en tiempo real de las acciones de los agentes.
- **Agents:** Lista de agentes activos y su estado actual.
- **Conexión en Tiempo Real:** Actualizaciones instantáneas vía WebSockets.
- **Dark Mode:** Interfaz diseñada íntegramente en modo oscuro con Tailwind CSS.
- **Gestión de Estado Centralizada:** Manejo eficiente del estado con Zustand.