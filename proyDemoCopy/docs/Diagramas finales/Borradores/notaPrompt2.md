regaleme este mismo prompt con las correcciones para que no cambie , ni altere el contenido del texto ni los parrafos solo sobre lo que hay coloque el color que le corresponde y abajo en color morado el adjuntes del texto completo sobre el mismo contenido con la corrección y que no entregue nada de información de las cosas parciales tanto de backend o frontend; solo funcionalidades que esta completas en la implementación del código del proyecto tanto en el backend como en el frontend:

necesito que realice una auditoria al documento donde se valide, revise, analicé y corrija el documento en cuanto la numeración de las figuras de acuerdo a las normas APA edición 7 y la agregación de el ÍNDICE DE TABLAS e ÍNDICE DE FIGURAS que sea automático de acuerdo a las normas APA edición 7; también los espacios verticales entre en los títulos con subtitulo y párrafos y párrafo a párrafo coloque un comentario que diga“espacio 0pt” o “espacio 2pt”  de color fucsia #D41E56 


# Instrucción de Auditoría y Corrección del Documento Prueba.docx

## Objetivo General

Auditar y corregir el documento **Prueba.docx**, ubicado en la carpeta **proyDemo\Diagramas finales**, tomando como única fuente de verdad el código fuente implementado en el proyecto **PROYDEMO**.

El contenido final del documento debe reflejar exclusivamente lo que realmente está implementado en el código del proyecto PROYDEMO.

---

## Criterio Obligatorio de Implementación Completa

### Regla General

Para que una funcionalidad, módulo, requerimiento, historia de usuario o caso de uso sea considerado **implementado**, debe existir una implementación **completa, funcional y verificable tanto en el Backend como en el Frontend**.

No se considerará implementado ningún elemento que cumpla alguna de las siguientes condiciones:

* Existe únicamente en Backend pero no posee interfaz, integración o flujo funcional en Frontend.
* Existe únicamente en Frontend pero no posee lógica funcional o persistencia real en Backend.
* Tiene implementaciones parciales, simuladas, mockeadas o incompletas.
* Posee pantallas sin lógica funcional real.
* Posee servicios o APIs sin consumo efectivo desde la interfaz.
* Tiene componentes desarrollados pero no integrados al flujo operativo del sistema.
* Está documentado pero no puede ejecutarse de principio a fin dentro de la aplicación.

### Regla de Documentación

El documento final NO debe contener implementaciones parciales.

Si una funcionalidad está implementada solo en Backend o solo en Frontend:

* Debe considerarse **NO IMPLEMENTADA**.
* Debe marcarse como hallazgo.
* Debe conservarse el texto original en color **Rojo**.
* Debe agregarse la corrección correspondiente en color **Morado**.
* Debe incluirse una explicación en color **Naranja** indicando que la funcionalidad presenta una implementación parcial y por tanto no cumple los criterios de implementación completa.

Únicamente podrán permanecer como funcionalidades implementadas aquellas que cuenten con:

1. Implementación Backend completa.
2. Implementación Frontend completa.
3. Integración entre Backend y Frontend.
4. Flujo funcional verificable.
5. Evidencia de funcionamiento dentro del sistema.

---

## Actividades de Validación

### 1. Validación del tema "Logros Desbloqueables"

1. Analizar el código fuente del proyecto PROYDEMO.
2. Verificar si existe implementación funcional relacionada con **Logros Desbloqueables**.
3. Confirmar que la funcionalidad esté implementada completamente tanto en Backend como en Frontend.
4. Comparar dicha implementación con el contenido documentado en Prueba.docx.

#### Si los Logros Desbloqueables SÍ están implementados completamente:

* Mantener el contenido correcto.
* Agregar en la **Introducción** una referencia explícita al módulo de **Logros Desbloqueables**.
* Al final del documento agregar una sección denominada **Observaciones y Explicaciones de Auditoría**.
* Describir exactamente qué funcionalidades de logros están implementadas en Backend y Frontend.
* Mostrar estas observaciones en color **Naranja**.

#### Si los Logros Desbloqueables NO están implementados completamente:

* Considerar como NO IMPLEMENTADO cualquier desarrollo parcial.
* Marcar en color **Rojo** el texto incorrecto existente.
* Conservar el texto original para evidenciar el hallazgo.
* Agregar inmediatamente después la corrección completa en color **Morado**.
* Incluir una explicación en color **Naranja** indicando si la ausencia corresponde a Backend, Frontend, integración o funcionalidad incompleta.

---

### 2. Validación de la sección "Resultados de las Pruebas"

Revisar el plan de pruebas y verificar contra la evidencia disponible.

#### Reglas

* Las tablas deben contener únicamente funcionalidades completas que hayan sido probadas de extremo a extremo (Frontend + Backend).

* Si existe un elemento listado sin evidencia de pruebas completas:

  * Marcarlo en color **Rojo**.

* Si existe evidencia de pruebas para un elemento que no aparece en la tabla:

  * Agregarlo en color **Azul**.

* Validar que todos los resultados reportados correspondan a pruebas reales realizadas sobre el proyecto.

* No aceptar pruebas únicamente de Backend o únicamente de Frontend como evidencia de implementación completa.

---

### 3. Validación de Requerimientos Funcionales

Comparar los requerimientos funcionales documentados contra la implementación real del código.

#### Para cada requerimiento

* Verificar Backend.
* Verificar Frontend.
* Verificar integración.
* Verificar funcionamiento real.

#### Clasificación

* Si está completamente implementado:

  * Mantenerlo en color **Verde**.

* Si falta Backend, Frontend o integración:

  * Considerarlo NO IMPLEMENTADO.
  * Conservar el texto original en color **Rojo**.
  * Agregar la corrección completa en color **Morado**.
  * Incluir una explicación en color **Naranja**.

* Si existe un requerimiento completamente implementado y no aparece en el documento:

  * Agregarlo en color **Azul**.

---

### 4. Validación de Requerimientos No Funcionales

Aplicar exactamente el mismo procedimiento utilizado para los requerimientos funcionales.

Validar que todos los requerimientos no funcionales implementados en PROYDEMO estén reflejados correctamente en el documento y que cuenten con soporte real cuando aplique tanto en Backend como en Frontend.

---

### 5. Validación de Historias de Usuario

Comparar cada historia de usuario con la funcionalidad realmente implementada.

Una historia solo podrá considerarse completada si el flujo asociado funciona integralmente en Backend y Frontend.

Aplicar la Leyenda de Revisión:

* Verde: historia correcta y verificada.
* Rojo: historia incorrecta, parcial o no implementada.
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
* No exista contenido que represente implementaciones parciales.
* Toda funcionalidad documentada tenga evidencia de Backend, Frontend e integración.

---

## Sección Final Obligatoria

Agregar al final del documento una sección llamada:

### Resultados de la Auditoría

Incluir:

1. Funcionalidades verificadas completamente (Backend + Frontend).
2. Funcionalidades documentadas pero no implementadas.
3. Funcionalidades implementadas parcialmente.
4. Funcionalidades implementadas pero no documentadas.
5. Hallazgos encontrados.
6. Correcciones realizadas.
7. Recomendaciones de mejora documental.
8. Observaciones sobre Logros Desbloqueables.
9. Evidencia de validación de integración Backend–Frontend.

---

# LEYENDA DE REVISIÓN

✅ Verde: información correcta verificada contra el aplicativo PROYDEMO y completamente implementada en Backend y Frontend.

❌ Rojo: texto del documento que NO cumple con lo implementado en PROYDEMO o que presenta implementación parcial.

✏️ Morado: corrección con el texto completo que sí corresponde al aplicativo PROYDEMO.

🧭 Naranja: explicación detallada del hallazgo, incluyendo si la diferencia corresponde a Backend, Frontend, integración o funcionalidad incompleta.

🆕 Azul: contenido nuevo agregado durante la auditoría.

## Restricción Final Obligatoria

NO se permite documentar funcionalidades parcialmente implementadas como funcionalidades completas.

Toda afirmación del documento debe estar respaldada por evidencia verificable en:

* Backend.
* Frontend.
* Integración entre ambos.

Si cualquiera de estos tres componentes falta, la funcionalidad deberá clasificarse como **NO IMPLEMENTADA O IMPLEMENTADA PARCIALMENTE**, según corresponda; actualiza el archivo prueba.docx.
