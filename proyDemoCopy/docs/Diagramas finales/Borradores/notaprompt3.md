# INSTRUCCIÓN DE AUDITORÍA Y CORRECCIÓN DEL DOCUMENTO Prueba.docx

## Objetivo General

Auditar y corregir el documento **Prueba.docx**, ubicado en la carpeta **proyDemo\Diagramas finales**, utilizando como única fuente de verdad el código fuente implementado en el proyecto **PROYDEMO**.

El resultado final debe reflejar exclusivamente funcionalidades que se encuentren completamente implementadas, operativas y verificables tanto en el **backend** como en el **frontend**.

No se debe incluir información parcial, incompleta, estimada, inferida o basada en documentación previa.

### Fuentes NO válidas

No utilizar como evidencia:

* Código comentado.
* Código experimental.
* Código incompleto.
* Funcionalidades parcialmente desarrolladas.
* Endpoints sin integración completa.
* Interfaces sin lógica funcional.
* Lógica backend sin consumo real desde el frontend.
* Componentes frontend sin conexión funcional al backend.
* Funcionalidades planificadas.
* Funcionalidades propuestas.
* Historias futuras.
* Requerimientos pendientes.
* Diagramas que no correspondan a la implementación real.

---

# REGLA CRÍTICA DE VALIDACIÓN

Una funcionalidad solamente podrá considerarse implementada cuando exista evidencia verificable de:

## Backend completo

* Modelos implementados.
* Servicios implementados.
* Reglas de negocio implementadas.
* Persistencia implementada.
* Validaciones implementadas.
* Endpoints funcionales.

## Frontend completo

* Pantallas implementadas.
* Componentes implementados.
* Formularios implementados.
* Navegación implementada.
* Consumo de servicios implementado.
* Manejo de errores implementado.
* Flujo funcional operativo.

## Integración completa

* Comunicación backend–frontend funcional.
* Flujo operativo verificable.
* Evidencia de uso real dentro del sistema.

### Regla obligatoria

Si una funcionalidad existe únicamente en backend o únicamente en frontend, debe considerarse NO IMPLEMENTADA para efectos del documento.

No se debe documentar ninguna funcionalidad parcial.

---

# REGLA CRÍTICA DE CONSERVACIÓN DEL DOCUMENTO

Se debe mantener estrictamente la estructura original del documento.

NO está permitido:

* Reescribir párrafos originales.
* Cambiar la redacción original.
* Resumir contenido.
* Fusionar párrafos.
* Dividir párrafos.
* Modificar numeraciones.
* Modificar títulos.
* Cambiar el orden de las secciones.
* Eliminar contenido original.

Únicamente está permitido:

* Aplicar colores.
* Agregar observaciones de auditoría.
* Agregar correcciones debajo del texto observado.
* Agregar explicaciones técnicas.
* Agregar contenido faltante validado.

El texto original siempre debe permanecer visible.

---

# REGLA ESPECIAL DE CORRECCIÓN

Cuando una sección contenga información incorrecta, incompleta o no implementada:

1. Mantener el texto original exactamente igual.
2. Marcar el texto original en color ROJO.
3. Insertar inmediatamente debajo la corrección COMPLETA en color MORADO.
4. Insertar debajo una explicación técnica en color NARANJA.

### IMPORTANTE

La corrección en color MORADO debe contener el texto completo corregido.

NO se deben realizar modificaciones parciales dentro del párrafo.

NO se deben utilizar frases abreviadas.

NO se deben insertar únicamente fragmentos corregidos.

Se debe escribir nuevamente todo el contenido correspondiente con la corrección aplicada y en color MORADO.

Las correcciones deben ser mínimas y puntuales, conservando la redacción original tanto como sea posible.

---

# REGLA ABSOLUTA DE INFORMACIÓN

Solo debe permanecer información que tenga evidencia de implementación completa en:

* Backend.
* Frontend.
* Integración funcional.

Toda información que no cumpla simultáneamente estas tres condiciones debe marcarse como incorrecta.

No interesa información parcial.

No interesa funcionalidad incompleta.

No interesa funcionalidad en desarrollo.

No interesa funcionalidad futura.

No interesa funcionalidad documentada sin evidencia de implementación.

---

# VALIDACIONES OBLIGATORIAS

## 1. Logros Desbloqueables

Analizar el código fuente completo.

### Si está implementado completamente

* Mantener contenido.
* Marcar en Verde.
* Agregar evidencia encontrada.
* Agregar observación en Naranja.

### Si NO está implementado completamente

* Mantener texto original.
* Marcar en Rojo.
* Agregar corrección completa en Morado.
* Agregar explicación técnica en Naranja.
* Especificar exactamente qué elementos faltan en backend, frontend o integración.

---

## 2. Resultados de Pruebas

Validar cada prueba contra evidencia real.

Solo deben permanecer:

* Casos ejecutados.
* Casos verificables.
* Funcionalidades completas.

### Reglas

* Evidencia válida → Verde.
* Sin evidencia → Rojo.
* Evidencia existente y no documentada → Azul.

No reportar pruebas de funcionalidades parciales.

---

## 3. Requerimientos Funcionales

Validar uno por uno.

### Implementado completamente

* Mantener.
* Marcar en Verde.

### No implementado completamente

* Mantener texto original.
* Marcar en Rojo.
* Agregar corrección completa en Morado.
* Agregar explicación en Naranja.

### Implementado y ausente

* Agregar en Azul.

---

## 4. Requerimientos No Funcionales

Aplicar exactamente las mismas reglas anteriores.

---

## 5. Historias de Usuario

Comparar contra la implementación real.

### Leyenda

* Verde: implementada completamente.
* Rojo: incorrecta o no implementada.
* Morado: corrección completa.
* Naranja: explicación técnica.
* Azul: historia implementada pero ausente.

No validar historias parciales.

---

## 6. Validación Integral

Verificar que:

* La introducción refleje únicamente funcionalidades completas.
* Los diagramas correspondan a la implementación real.
* Los requerimientos funcionales sean verificables.
* Los requerimientos no funcionales sean verificables.
* Las historias de usuario sean verificables.
* Los resultados de pruebas tengan evidencia.
* No exista contenido basado únicamente en backend.
* No exista contenido basado únicamente en frontend.
* No exista contenido basado en implementaciones parciales.

---

# LEYENDA DE COLORES

🟢 Verde

Información correcta y validada en backend, frontend e integración.

🔴 Rojo

Información incorrecta, inexistente, incompleta o parcialmente implementada.

🟣 Morado

Versión completa corregida del texto auditado.

🟠 Naranja

Explicación técnica del hallazgo.

🔵 Azul

Información completamente implementada pero ausente en el documento.

---

# RESULTADOS DE LA AUDITORÍA

Agregar obligatoriamente una sección final denominada:

## Resultados de la Auditoría

Debe incluir:

1. Funcionalidades completamente verificadas.
2. Funcionalidades documentadas pero no implementadas.
3. Funcionalidades implementadas pero no documentadas.
4. Hallazgos encontrados.
5. Correcciones realizadas.
6. Recomendaciones documentales.
7. Observaciones sobre Logros Desbloqueables.

---

# RESTRICCIÓN FINAL ABSOLUTA

El documento final debe reflejar exclusivamente funcionalidades completamente implementadas y verificables en el proyecto PROYDEMO.

No documentar:

* Backend parcial.
* Frontend parcial.
* Integraciones parciales.
* Funcionalidades incompletas.
* Código en desarrollo.
* Código sin uso operativo.
* Funcionalidades futuras.
* Funcionalidades planeadas.

Toda corrección debe basarse únicamente en evidencia verificable encontrada en el código fuente real.

No modificar ni reescribir el contenido original; únicamente colorearlo, validarlo y agregar debajo las correcciones completas y explicaciones correspondientes.

La corrección en color MORADO debe escribirse completa, conservando al máximo la redacción original y aplicando únicamente los ajustes mínimos necesarios para que el texto quede correcto.
