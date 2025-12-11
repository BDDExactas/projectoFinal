Plataforma Financiera - Sistema de Gestión de Portfolio

## DESCRIPCIÓN GENERAL

Este proyecto es una plataforma web diseñada para simplificar la gestión de carteras de inversión. El sistema permite a los usuarios mantener un control centralizado de sus cuentas bancarias y portfolios, registrar transacciones financieras, gestionar instrumentos financieros y monitorear la valorización de sus tenencias.

**Nota técnica:** La carga por Excel fue reemplazada por formularios CRUD en la pestaña "Transacciones" de la app para mayor flexibilidad.

--- 

## LO ACORDADO vs LO HECHO

### Acordado:
- ✅ Gestión de cuentas (accounts)
- ✅ Gestión de instrumentos (instruments)
- ✅ Registro de transacciones
- ✅ Cálculo de holdings (tenencias)
- ✅ Dashboard con resumen de portfolio
- ✅ Seguimiento de precios
- ⚠️ Importación de Excel (REEMPLAZADO por formularios CRUD)


### Implementado adicional:
- ✅ CRUD completo para transacciones con inline editing
- ✅ CRUD para precios con actualización manual
- ✅ Sistema de autenticación con sesiones
- ✅ Cálculo automático de precio promedio ponderado
- ✅ Conversión de monedas en dashboard
- ✅ Validación de datos con Zod

---

## DIAGRAMA ENTIDAD-RELACIÓN (DER)

![alt text](image-1.png)
