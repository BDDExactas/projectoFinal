Plataforma Financiera - Sistema de Gestión de Portfolio

DESCRIPCION GENERAL

Este proyecto es una plataforma web diseñada para simplificar la gestión de carteras de inversión. El sistema permite a los usuarios mantener un control centralizado de sus cuentas bancarias y portfolios, registrar transacciones financieras, gestionar instrumentos financieros y monitorear la valorización de sus tenencias.

Nota: la carga por Excel fue reemplazada por formularios CRUD en la pestaña "Transacciones" de la app.

El modelo financiero se basa en tres conceptos principales:

1. Cuentas (Accounts)
   - Representan contenedores de valores: cuentas bancarias, portfolios de inversión u otros tipos de depósitos
   - Cada cuenta contiene un conjunto de instrumentos financieros
   - Las cuentas pertenecen a un usuario
   - Ejemplo: "Banco Galicia", "Portfolio Inversion", "Mercado Pago"

2. Instrumentos Financieros (Instruments)
   - Activos que se pueden comprar, vender o mantener en una cuenta
   - Tipos: acciones (stock), bonos (bond), efectivos (cash), otros
   - Cada instrumento tiene un código único: AL30, YPFD, BA24C, LOMA, METRD, USD, ARS
   - Ejemplo: "AL30" (bono argentino), "YPFD" (accion), "USD" (divisa)

3. Tenencias (Holdings)
   - Cantidad y registro de cada instrumento en cada cuenta
   - Se actualiza con transacciones: compras, ventas, depósitos, retiros
   - Permite calcular la valorización total y el precio promedio de compra

FUNCIONALIDADES PRINCIPALES

1. AUTENTICACION Y GESTION DE USUARIOS

- Registro de nuevos usuarios con credenciales seguras
- Login con email y contraseña (encriptadas con bcrypt)
- Gestión de sesiones basadas en cookies firmadas
- Logout y cierre de sesión
- Autenticación requerida para acceder a todas las funcionalidades


2. DASHBOARD Y RESUMEN DE PORTFOLIO

Visualización centralizada del estado financiero:

- Valor total del portfolio
  - Suma de todas las tenencias valorizadas en moneda base (ARS por defecto)
  - Conversión automática de múltiples monedas a través de tasas de cambio
- Resumen por cuenta
  - Desglose de valor total para cada cuenta
  - Cantidad de instrumentos por cuenta
  - Moneda de operación
- Rendimiento del portfolio
  - Gráfico de desempeño histórico
  - Análisis de variaciones de valor
- Transacciones recientes
  - Histórico de últimas operaciones
  - Detalle de compras, ventas, depósitos, retiros

3. GESTION DE TENENCIAS

Visualización detallada de activos por instrumento:

Tabla Tenencias por Instrumento - muestra:
  - Código del instrumento
  - Tipo de instrumento (acción, bono, efectivo, etc.)
  - Cuenta donde se encuentra
  - Cantidad total disponible
  - Precio promedio de compra (calculado sobre histórico)
  - Precio actual del mercado
  - Valorización total (cantidad x precio actual)
- Agregar activo
  - Seleccionar cuenta, instrumento y cantidad
  - Registra una transacción de compra
  - Crea la tenencia si no existe o incrementa la cantidad
- Ajustar cantidades
  - Botones por fila para incrementar (Agregar) o reducir (Quitar) holdings
  - Diálogos con campos de cantidad y precio opcional
  - Registra transacciones de compra (buy) o venta (sell)
- Recalculo automático de precio promedio
  - Se actualiza con cada transacción importada o manual
  - Promedio ponderado del histórico de precios

4. SEGUIMIENTO DE PRECIOS

Gestión centralizada del histórico de cotizaciones:

- Tabla de precios históricos
  - Lista de precios registrados por instrumento y fecha
  - Precio actual en moneda especificada
  - Variación porcentual respecto al precio anterior
  - Historial completo disponible para consulta
- Agregar precio manual
  - Formulario para ingresar precio de un instrumento en una fecha específica
  - Permite especificar moneda (ARS, USD, EUR, etc.)
  - Útil para actualizar cotizaciones manuales o históricas
- Actualizar precios automáticos
  - Sincronización con Yahoo Finance para tasas de cambio
  - Actualiza automáticamente precios de divisas (USD, EUR, etc.)
  - Botón para disparar actualización manual
  - Moneda base (ARS) anclada a valor 1
- Agregar activo desde precios
  - Botón global para crear nuevas tenencias
  - Selecciona cuenta, instrumento y cantidad
  - Simplifica la entrada sin ir a otra sección

5. IMPORTACION DE TRANSACCIONES

Sistema flexible para carga masiva de datos:

- Carga de Excel
  - Aceptar archivos .xlsx y .xls
  - Interfaz drag-and-drop intuitiva
  - Vista previa antes de procesar
- Procesamiento de archivo
  - Validación de estructura Excel
  - Mapeo de columnas requeridas: fecha, cuenta, instrumento, tipo, cantidad, precio (opcional)
  - Tipos de transacción soportados: compra (buy), venta (sell), depósito (deposit), retiro (withdrawal), dividendo (dividend), interés (interest)
- Manejo de errores
  - Detección de filas inválidas
  - Mensajes de error específicos por línea
  - Resumen de procesadas vs. errores
  - Opción de ver detalles de errores
- Actualización automática del portfolio
  - Ajusta cantidades en tenencias
  - Crea transacciones en base de datos
  - Registra archivo importado para trazabilidad

Formatos soportados en Excel:
  - fecha (YYYY-MM-DD)
  - cuenta (nombre de la cuenta)
  - instrumento (código del instrumento)
  - tipo (buy, sell, deposit, withdrawal, dividend, interest)
  - cantidad (número)
  - precio (opcional, número)
  - descripcion (opcional, texto)

6. GESTION DE INSTRUMENTOS

Base de datos de activos financieros disponibles:

- Catálogo de instrumentos
  - Código único (AL30, YPFD, BA24C, LOMA, METRD, etc.)
  - Nombre descriptivo
  - Tipo (acción, bono, efectivo, otros)
  - Moneda base
- Creación de nuevos instrumentos
  - Admins pueden registrar nuevos activos
  - Necesario para poder operar con ellos
- Asociación a transacciones
  - Cada transacción referencia un instrumento
  - Permite traceback y análisis por tipo de activo

NOTAS Y LIMITACIONES

- Sistema de precios actualiza automáticamente solo tasas de cambio (Yahoo Finance)
- Precios de instrumentos (acciones, bonos) deben agregarse manualmente
- Archivo Excel se procesa en tiempo real (puede tardar para archivos muy grandes)
- Base de datos: cambios de esquema requieren scripts SQL manuales
- Moneda base configurada por defecto en ARS
- Precio promedio se calcula sobre histórico de instrument_prices (todas las fechas)

DESARROLLO FUTURO

Mejoras potenciales:
- Sincronización de precios de acciones desde APIs externas
- Reportes PDF exportables
- Análisis técnico y gráficos avanzados
- Alertas de precio
- Control de acceso por roles (admin, view-only)
- API pública para integraciones externas
- Mobile app
- Soporte multi-usuario avanzado
