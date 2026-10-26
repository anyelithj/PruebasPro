# Instrucción de Auditoría y Corrección del Documento Prueba.docx

## Objetivo General

Auditar y corregir el documento **Prueba.docx**, ubicado en la carpeta **proyDemo\Diagramas finales**, tomando como única fuente de verdad el código fuente implementado en el proyecto **PROYDEMO**.

El contenido final del documento debe reflejar exclusivamente lo que realmente está implementado en el código del proyecto PROYDEMO.

---

## Actividades de Validación

### 1. Validación del tema "Logros Desbloqueables"

1. Analizar el código fuente del proyecto PROYDEMO.
2. Verificar si existe implementación funcional relacionada con **Logros Desbloqueables**.
3. Comparar dicha implementación con el contenido documentado en Prueba.docx.

#### Si los Logros Desbloqueables SÍ están implementados:

* Mantener el contenido correcto.
* Agregar en la **Introducción** una referencia explícita al módulo de **Logros Desbloqueables**.
* Al final del documento agregar una sección denominada **Observaciones y Explicaciones de Auditoría**.
* En esta sección describir exactamente qué funcionalidades de logros están implementadas en el código.
* Mostrar estas observaciones en color **Naranja**.

#### Si los Logros Desbloqueables NO están implementados:

* Marcar en color **Rojo** el texto incorrecto existente.
* Conservar el texto original para evidenciar el hallazgo.
* Agregar inmediatamente después la corrección completa en color **Morado**.
* Incluir una explicación en color **Naranja** indicando por qué el contenido original no corresponde con la implementación real.

---

### 2. Validación de la sección "Resultados de las Pruebas"

Revisar el plan de pruebas y verificar contra la evidencia disponible.

#### Reglas:

* Las tablas deben contener únicamente los archivos, módulos o funcionalidades que realmente fueron sometidos a pruebas.

* Si existe un elemento listado en la tabla sin evidencia de pruebas:

  * Marcarlo en color **Rojo**.

* Si existe evidencia de pruebas para un elemento que no aparece en la tabla:

  * Agregarlo en color **Azul**.

* Validar que todos los resultados reportados correspondan a pruebas reales realizadas sobre el proyecto.

---

### 3. Validación de Requerimientos Funcionales

Comparar los requerimientos funcionales documentados contra la implementación real del código.

#### Para cada requerimiento:

* Si está correctamente implementado:

  * Mantenerlo en color **Verde**.

* Si no corresponde con la implementación:

  * Conservar el texto original en color **Rojo**.
  * Agregar la corrección completa en color **Morado**.
  * Incluir una explicación en color **Naranja**.

* Si existe un requerimiento implementado en el código que no aparece en el documento:

  * Agregarlo en color **Azul**.

---

### 4. Validación de Requerimientos No Funcionales

Realizar el mismo procedimiento aplicado a los requerimientos funcionales.

Validar que todos los requerimientos no funcionales implementados en PROYDEMO estén reflejados correctamente en el documento.

---

### 5. Validación de Historias de Usuario

Comparar cada historia de usuario con la funcionalidad realmente implementada.

Aplicar la Leyenda de Revisión:

* Verde: historia correcta y verificada.
* Rojo: historia incorrecta o no implementada.
* Morado: versión corregida.
* Naranja: explicación de la diferencia encontrada.
* Azul: historia faltante agregada durante la auditoría.

---

### 6. Validación Integral del Documento

Verificar que:

* La introducción refleje únicamente funcionalidades existentes.
* Los diagramas y descripciones correspondan al sistema implementado.
* Los requerimientos funcionales estén completos.
* Los requerimientos no funcionales estén completos.
* Las historias de usuario estén completas.
* Los resultados de pruebas sean consistentes con las evidencias.
* No exista contenido que describa funcionalidades inexistentes en PROYDEMO.

---

## Sección Final Obligatoria

Agregar al final del documento una sección llamada:

### Resultados de la Auditoría

Incluir:

1. Funcionalidades verificadas.
2. Funcionalidades documentadas pero no implementadas.
3. Funcionalidades implementadas pero no documentadas.
4. Hallazgos encontrados.
5. Correcciones realizadas.
6. Recomendaciones de mejora documental.
7. Observaciones sobre Logros Desbloqueables.

---

# LEYENDA DE REVISIÓN

✅ Verde: información correcta verificada contra el aplicativo PROYDEMO.

❌ Rojo: texto del documento que NO cumple con lo implementado en PROYDEMO; se conserva tal cual para evidenciar el hallazgo.

✏️ Morado: corrección con el texto completo que sí corresponde al aplicativo PROYDEMO (reemplazo recomendado).

🧭 Naranja: explicación del porqué el texto en rojo no cumple con lo implementado en PROYDEMO.

🆕 Azul: contenido nuevo agregado durante la auditoría (introducción ampliada, requerimientos faltantes, historias de usuario faltantes, resultados de pruebas faltantes, matriz de trazabilidad, validación UML, conclusiones y mejoras).
