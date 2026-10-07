# Auditoría UX — Mini Tanda (todas las vistas) — 2026-10-07

Modo: **audit** (ux-craft §7.2). Rama `fix/ui-polish` (HEAD `b82c90b`), build de producción servido con `vite preview` en :4331.
Pasada nueva: no repite los 47 hallazgos de `docs/UX-AUDIT.md` (todos marcados como resueltos en su §7); donde un hallazgo roza uno anterior, se indica.

**Resumen:** 33 hallazgos (1 sev4 · 8 sev3 · 12 sev2 · 12 sev1).
Usuario y tarea evaluados: dueña/o de una micro-panadería que opera sola desde el teléfono (hipótesis) · tarea primaria: **registrar el pedido de un cliente en una tanda** y después **cobrarlo y entregarlo**.

**Los 3 que más afectan a la tarea primaria**
1. A-01 — La búsqueda de clientes no ignora acentos: "jose" no encuentra "José Hernández" y ofrece crear un duplicado — **sev 4**
2. A-02 — Atrás (gesto o botón del navegador) con la hoja de venta abierta sale de la página y tira el borrador sin preguntar — **sev 3**
3. A-04 — El fondo invisible del combobox se come el primer toque en cualquier otro control del formulario de venta — **sev 3**

---

## Paso 0 — Contexto (§2)

- **Documentos:** `docs/SPECS.md`, `mini-tandas-vapp/README.md`, `docs/UX-AUDIT.md`. **No existe `DESIGN.md` ni `PRODUCT.md`** (ver A-19).
- **Tokens:** `src/shared/assets/main.css:1-85` — color (claro y oscuro con paleta propia, no invertida), `--space-1..8`, roles `--gap-section` / `--gap-grid` / `--pad-card`, `--radius` 10/6, `--shadow*`, `--color-scrim`. **Sin tokens de tipografía ni de movimiento.**
- **Componentes compartidos:** `src/shared/ui/` (ActionMenu, Combobox, ConfirmDialogHost, QuantityStepper, TabList, ToastHost, useDialogFocus, useScrollLock…). Iconos: lucide-vue-next.
- **Stack:** Vue 3 + Pinia + vue-router (rutas por archivo), sql.js + IndexedDB, sin backend. UI en inglés (decisión del spec), locale del navegador para moneda/fechas.
- **Superficie:** **Operar** (herramienta diaria). Una fuente de sistema bien ajustada es válida aquí; lo que se exige es coherencia, no voz de marca.
- **Dominio (§4.3):** mezcla de *SaaS pequeño* y *fintech ligera* (saldos, abonos, pagos): aplican "no redondear", "estados de pago claros", "bloqueo/aviso ante importes anómalos".

### Intent (§3.1)
- **Usuario primario (hipótesis):** una persona que hornea y vende; registra pedidos que le llegan por WhatsApp o en persona, a menudo con una mano y con prisa; usa el teléfono más que el escritorio.
- **Tarea primaria:** registrar un pedido (cliente + productos) en la tanda abierta. Secundarias: marcar entregas el día de reparto, registrar cobros, consultar quién debe.
- **Éxito:** funcional — un pedido en <30 s sin errores de cliente ni de importe; emocional — confianza en que los saldos son correctos.
- **Peor caso:** saldo de un cliente partido o inflado (duplicados, sobrepago por un cero de más), pedido perdido al cerrar sin querer, pérdida total de datos al importar.
- **Datos extremos probados:** nombres largos (producto de 70 caracteres, cliente de 4 palabras), producto sin variaciones, SKU sin precio, tanda sin ventas, base vacía, 320 px, texto al 200 %.

## Método

- Código leído: `src/pages/**`, `src/features/**`, `src/shared/ui/**`, `src/core/App.vue`, `main.css`, `index.html`.
- **Datos sembrados por la UI** con Playwright (Chromium, locale es-MX): 4 productos (con/sin variaciones, con/sin foto, SKU sin precio, nombre largo), 5 clientes (uno creado desde el combobox), 4 tandas (programada abierta, programada en producción, anticipada lista con inventario, programada cerrada), 9 ventas, entregas.
- **Capturas** de 10 vistas + 11 estados (editor de producto en sus 2 pestañas, hoja de venta vacía/con combobox/con líneas, confirmación de descarte, menú ⋯, formulario de tanda, error de pago, vacíos, 404) a **375, 768 y 1440 px, claro y oscuro** (132 + 15 capturas; en el repositorio solo se incluyen las citadas por A-01..A-09, en [`ux-craft-audit/`](ux-craft-audit/)).
- **Medido:** recorrido con Tab, estilos computados, tamaños de objetivos, contraste calculado (WCAG 2) de 41 pares de tokens, reflow a 320 px, texto al 200 % (simulado con `html{font-size:200%}`), comportamiento de Atrás, del toast y del combobox.

---

## Hallazgos (sev 4 → 1)

### A-01 La búsqueda de clientes distingue acentos y empuja a crear duplicados
- Severidad: **4** (frecuente × medio, +1 persistente: el duplicado no se puede renombrar, fusionar ni borrar si ya tiene venta) · Esfuerzo: S · Confianza: observado
- Dónde: Tanda › hoja "New sale" › combobox Client › al escribir · `src/shared/ui/Combobox.vue:89-93` (`label.toLowerCase().includes(q)`)
- Problema: en **el combobox Client**, escribir "jose" no encuentra "José Hernández" y la única fila es **+ Create "jose"** ([captura `22-accent-search-1440-light.png`](ux-craft-audit/22-accent-search-1440-light.png)), lo que provoca **clientes duplicados con el saldo partido entre dos fichas** (Tesler/Postel: el sistema carga con la variación; §4.2: búsqueda que ignora mayúsculas y acentos).
- Arreglo: normalizar ambos lados antes de comparar: `const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`; además, cuando el texto se parece a un cliente existente (mismo `fold`, o distancia ≤2), mostrar "¿Quisiste decir José Hernández?" por encima de "Create".

### A-02 Atrás con la hoja de venta abierta sale de la página y pierde el borrador
- Severidad: **3** (ocasional × alto) · Esfuerzo: M · Confianza: observado
- Dónde: Tanda › hoja "New sale" con líneas › gesto/botón Atrás · `src/features/tandas/components/SaleDialog.vue` (no hay entrada de historial ni `onBeforeRouteLeave`)
- Problema: con 1 línea en el borrador, `history.back()` cerró la hoja **y navegó fuera** (sin el diálogo "Discard this sale?" que sí aparece con ×, Esc o el fondo), lo que provoca **perder el pedido a medio capturar** con el gesto más común de Android (§3.5 scrim/modal: "Atrás cierra el modal"; §4.2 bottom sheet: "Atrás cierra la hoja; con cambios sin guardar, pide confirmar").
- Arreglo: al abrir, `history.pushState({ sheet: true }, '')`; en `popstate` llamar a `requestClose()` (que ya confirma); al cerrar por otra vía, `history.back()` para retirar la entrada. Añadir `onBeforeRouteLeave` en `tandas/[id].vue` que pida confirmar si `draftSize() > 0`.

### A-03 Un pago mayor que lo pendiente se aplica a la venta sin aviso
- Severidad: **3** (ocasional × crítico, −1 por el Undo y el borrado de pagos) · Esfuerzo: S · Confianza: observado
- Dónde: Cliente › Record payment › Apply to = una venta · `src/features/clients/components/PaymentForm.vue:63-89`
- Problema: en **el formulario de pago**, $5,000 aplicados a una venta con $120 pendientes se aceptan sin preguntar y la venta queda en "Balance -$4,880.00" ([captura `23-overpay-1440-light.png`](ux-craft-audit/23-overpay-1440-light.png)), lo que provoca **saldos erróneos por un cero de más** (§4.3 fintech: avisos por escenario, nunca redondear ni aceptar en silencio; Nielsen #5 prevención de errores).
- Arreglo: si `value > sale.balance`, mostrar inline bajo el importe "Esta venta solo debe $120.00. El resto ($4,880.00) quedará como saldo a favor." con dos acciones: "Aplicar $120.00 a la venta" / "Registrar $5,000.00 (crédito)". Con "General payment", avisar si supera la deuda total del cliente.

### A-04 El fondo invisible del combobox se come el primer toque en otro control
- Severidad: **3** (frecuente × medio) · Esfuerzo: S · Confianza: observado
- Dónde: Hoja de venta › Client/Product abiertos › toque en otro campo o en × · `src/shared/ui/Combobox.vue:250` (`.combo-backdrop` fijo a pantalla completa, z-index 80)
- Problema: con la lista de Client abierta, un clic en Product dejó el foco en Client (medido); tras cancelar el descarte, el foco vuelve a Product, la lista se reabre sola y el clic en **×** queda interceptado (Playwright: "combo-backdrop intercepts pointer events"), lo que provoca **toques muertos y la sensación de que la hoja no responde** en el camino principal (§3.5: todo toque produce un cambio visible ≤100 ms; Doherty).
- Arreglo: quitar el backdrop y cerrar con `focusout` (si `relatedTarget` no está dentro de `root` ni de la lista) más un `pointerdown` en `document` que no haga `preventDefault`; no reabrir la lista al recibir foco programático (`focus()` ya lo intenta; aplicar lo mismo en el retorno de foco del diálogo).

### A-05 El editor de producto no tiene URL: Atrás sale de Products y tira lo no guardado
- Severidad: **3** (ocasional × alto) · Esfuerzo: M · Confianza: observado
- Dónde: Products › New product / Edit › gesto Atrás · `src/pages/products/index.vue:22-50` (estado `formOpen` local)
- Problema: con el nombre escrito y sin guardar, Atrás llevó a `/tandas` (la vista anterior), lo que provoca **perder el borrador y salir de la sección** cuando el usuario esperaba volver a la lista (Jakob; §4.2 master-detail: "la selección vive en la URL"; Nielsen #3 control y libertad).
- Arreglo: llevar el editor a la URL (`/products?edit=<id>` o `/products/new`, `/products/:id`) para que Atrás vuelva a la lista; `onBeforeRouteLeave` con confirmación si la pestaña General tiene cambios sin guardar. Lo mismo, en menor grado, para el formulario "New tanda" (`/tandas?new=1` ya existe: no limpiarlo de la URL hasta crear o cancelar).

### A-06 No se puede corregir el nombre de un cliente
- Severidad: **3** (ocasional × medio, +1 persistente) · Esfuerzo: M · Confianza: observado
- Dónde: Clients › ⋯ (solo "Delete") y Cliente › ⋯ · `src/pages/clients/index.vue:124,143` (`:show-edit="false"`), `ClientSummaryCard.vue:27`
- Problema: los clientes se crean al vuelo desde la venta (texto libre) pero **no existe Editar**; y en cuanto tienen una venta no se pueden borrar, lo que provoca **erratas permanentes** ("Lupe" vs "Lupita") y empeora A-01 (Nielsen #3 control y libertad; §3.3: toda situación tiene salida).
- Arreglo: añadir "Rename" en el ⋯ de cliente (diálogo con un campo, validación de nombre vacío y aviso si coincide con otro cliente). A medio plazo, "Merge into…" para fusionar duplicados (mueve ventas y pagos).

### A-07 La lista de ventas de una tanda no resume ni filtra por entrega o cobro
- Severidad: **3** (frecuente el día de reparto × medio) · Esfuerzo: M · Confianza: inferido
- Dónde: Tanda › Sales (todas las vistas) · `src/features/tandas/components/SaleList.vue:58-121`, `src/pages/tandas/[id].vue`
- Problema: la tanda muestra tarjetas de venta en orden de creación, sin totales (ventas, cobrado, pendiente, entregadas x/y), sin búsqueda por cliente y sin filtro "Sin entregar / Pendiente de pago"; con 30 pedidos, el día de reparto hay que leer todas las tarjetas ([captura `03-tanda-open-sched-375-light.png`](ux-craft-audit/03-tanda-open-sched-375-light.png)), lo que provoca **entregas o cobros olvidados** (§4.2 tabla/listas: filtrar y ordenar; Miller: no obligar a recordar; el listado de tandas sí calcula revenue/pending).
- Arreglo: barra de resumen arriba de Sales ("12 ventas · $4,320 · $1,100 pendiente · 7/12 entregadas") y chips de filtro (`Todas · Sin entregar · Pendiente de pago`) guardados en `?filter=`; campo de búsqueda por cliente a partir de ~10 ventas.

### A-08 Los toasts con "Undo" no se pausan y desaparecen a los 8 s, también tras importar
- Severidad: **3** (raro × crítico para la importación; ocasional × medio para pagos) · Esfuerzo: S · Confianza: observado
- Dónde: Toast global · `src/shared/ui/useToast.ts:14-43`, `ToastHost.vue:9-29`; usado por `settings/index.vue:47-60` (Replace all data) y `PaymentForm.vue:86-89`, `PaymentList.vue:21-35`
- Problema: con el puntero encima, el toast "Payment… recorded · Undo" desapareció igual a los 8 s (medido: 0 toasts a los 8,6 s), y el diálogo de importación promete "You can undo it right after", lo que provoca que **el único camino para recuperar TODOS los datos dure 8 s y no se pueda detener** (§3.5 shield: Deshacer ≥5–10 s que se pausa con hover o foco; WCAG 2.2.1 tiempo ajustable).
- Arreglo: pausar el temporizador en `pointerenter`/`focusin` y reanudar al salir; para la importación, no depender del toast: guardar la instantánea anterior y ofrecer "Restore previous data" persistente en Settings durante la sesión (y descargar automáticamente un backup antes de reemplazar).

### A-09 Campos de 15,2 px: iOS Safari hace zoom al enfocar cualquier campo
- Severidad: **3** (frecuente × medio en iPhone) · Esfuerzo: S · Confianza: inferido (tamaño observado; zoom no verificable sin iOS)
- Dónde: todas las vistas › `.input/.select/.textarea` y `.qty-input` · `main.css:241` (`font-size: 0.95rem`), cuerpo `main.css:105` (`15px`)
- Problema: el tamaño computado es 15,2 px (<16), lo que provoca que **la hoja de venta se amplíe y se desplace al tocar Client, Product o la cantidad**, obligando a pellizcar para volver (§4.1 web móvil: inputs de 16 px).
- Arreglo: `font-size: max(16px, 1rem)` en controles de formulario (o `1rem` con cuerpo en `1rem`), incluido `.qty-input` del stepper.

### A-10 El cuerpo en px no sigue el tamaño de letra del usuario e invierte la jerarquía
- Severidad: 2 (ocasional × medio) · Esfuerzo: S · Confianza: observado
- Dónde: global · `main.css:105` (`body { font-size: 15px }`)
- Problema: con la letra base al 200 %, el cuerpo sigue en 15 px mientras el texto secundario `.muted` (rem) pasa a 27,2 px (medido), lo que provoca **etiquetas y ayudas más grandes que el contenido** para quien sube el tamaño de letra (WCAG 1.4.4; §3.8 tipo: cuerpo en rem).
- Arreglo: `body { font-size: 1rem }` (o `0.9375rem` si se quiere conservar 15 px por defecto) y derivar el resto de una escala en rem (ver A-19).

### A-11 Al 200 % de texto la cabecera de una tanda abierta se sale de su tarjeta
- Severidad: 2 (ocasional × medio) · Esfuerzo: S · Confianza: observado (simulación con `html{font-size:200%}`)
- Dónde: Tanda abierta › TandaHeader + StatusFlow › 375 px · `TandaHeader.vue:55-82`, `StatusFlow.vue:62-68`
- Problema: los campos de nombre y fecha sobresalen del borde de la tarjeta ("Pedidos Día de Mu…") y el caption de estado se parte palabra a palabra junto a la insignia (captura no incluida), lo que provoca **contenido recortado y difícil de leer** (WCAG 1.4.4 / 1.4.10). No es UX-09: aquel arregló el scroll horizontal; esto es desborde dentro de la tarjeta.
- Arreglo: `min-width: 0` en el `<div>` hijo de `.row-between` de TandaHeader y `flex-wrap: wrap` en `.status-info` con el caption a `flex-basis: 100%` cuando no cabe (o container query).

### A-12 Botones, campos y desplegables usan Arial; la descripción del producto sale en monoespaciada
- Severidad: 2 (frecuente × bajo) · Esfuerzo: S · Confianza: observado
- Dónde: global · `main.css:168-181, 232-242` (sin `font: inherit`); Products › Edit › Description (captura no incluida)
- Problema: el computado de `.btn` y `.input` es **Arial** mientras el cuerpo es `system-ui`, y el `<textarea>` usa la monoespaciada por defecto del navegador, lo que provoca **dos tipografías mezcladas en cada pantalla** y un campo que parece de código (§3.8 tipo: una o dos familias con roles cerrados; Estética-usabilidad).
- Arreglo: `button, input, select, textarea { font: inherit; }` en la base de `main.css`.

### A-13 El destino activo de la navegación solo se distingue por el color
- Severidad: 2 (frecuente × bajo, para daltónicos y baja visión) · Esfuerzo: S · Confianza: observado
- Dónde: cabecera de escritorio y barra inferior · `App.vue:179-187, 245-247`
- Problema: activo `#b3541e` frente a inactivo `#6b5d4f` = **1,27:1** (oscuro 1,13:1), mismo peso y sin subrayado; en las vistas de detalle (`/tandas/:id`) los enlaces no llevan `aria-current` (medido: `null`), lo que provoca **no saber en qué sección se está** sin percibir el tono (WCAG 1.4.1; §3.5: selección con algo más que color + estado programático).
- Arreglo: indicador no cromático (barra de 2–3 px bajo el enlace en escritorio, píldora tonal detrás del icono en la barra inferior) y `aria-current="page"` también cuando la ruta está dentro de la sección (`router-link-active`).

### A-14 La hoja de venta empieza en Product, valida al revés y deja el error lejos
- Severidad: 2 (frecuente × bajo-medio) · Esfuerzo: S · Confianza: observado
- Dónde: Hoja "New sale" · `SaleForm.vue:73` (`onMounted(focusSkuSearch)`), `:120-129` (orden de validación), `:206`
- Problema: el foco inicial cae en Product (medido) saltándose Client, que es el primer campo y obligatorio; al enviar vacío, el error "Add at least one product." aparece a media hoja, el foco se queda en el botón del pie y, si falta el cliente, el aviso solo llega después; el mensaje anterior sigue visible mientras se escribe el cliente ([captura `22-accent-search-1440-light.png`](ux-craft-audit/22-accent-search-1440-light.png)), lo que provoca **ida y vuelta por la hoja para descubrir qué falta** (§3.4 validación: resumen o error junto al origen y foco en él; orden de lectura = orden de foco).
- Arreglo: foco inicial en Client cuando está vacío (en Product solo al editar o si viene `initialSkuId`); validar en orden visual (cliente, luego productos); poner cada error bajo su campo con `aria-describedby` y mover el foco al primero inválido; limpiar el error al corregir.

### A-15 Todos los menús ⋯ se llaman "Actions"
- Severidad: 2 (frecuente × medio, para lector de pantalla) · Esfuerzo: S · Confianza: observado
- Dónde: tarjetas de venta, filas de producto y de cliente · `src/shared/ui/ActionMenu.vue:127` (`aria-label="Actions"`)
- Problema: el recorrido con Tab en una tanda da 4 botones seguidos "Actions" (medido) sin decir de qué venta, lo que provoca **no saber qué venta se va a editar o borrar** en la lista de botones del lector (WCAG 2.4.6 encabezados y etiquetas; 4.1.2).
- Arreglo: prop `label` en ActionMenu → `aria-label="Actions for Ana López's sale"` / `"Actions for Pastel de temporada"`.

### A-16 El motivo de "no se puede borrar" aparece arriba de la página, lejos de la tarjeta
- Severidad: 2 (ocasional × medio) · Esfuerzo: S · Confianza: observado en escritorio (top = 127 px), inferido en móvil
- Dónde: Products › ⋯ › Delete de un producto con ventas o inventario · `src/pages/products/index.vue:87`; igual en Clients (`clients/index.vue:146`, al pie de la tarjeta)
- Problema: el mensaje "This product already has sales or inventory — it cannot be deleted." se pinta sobre la lista; en móvil, al borrar la 4.ª tarjeta, queda fuera de pantalla, lo que provoca **que el toque parezca no hacer nada** (Proximidad; §3.3 errores junto al origen; §2 Gestalt: los cambios de estado ocurren cerca del foco).
- Arreglo: mostrarlo como diálogo informativo con un solo botón ("OK, got it") o deshabilitar "Delete" en el menú con el motivo como descripción (`aria-describedby`), como pide el spec para clientes ("the option is shown but fails with an explanatory message").

### A-17 Estados vacíos sin explicación ni acción
- Severidad: 2 (raro-ocasional × medio en el primer uso) · Esfuerzo: S · Confianza: observado
- Dónde: Tandas vacío ("No tandas yet." — `tandas/index.vue:96`; captura no incluida), Clients vacío ("No clients yet."), Sales de una tanda ("No sales yet." — `SaleList.vue:62`), Payments ("No payments yet.")
- Problema: el texto no dice qué aparecerá ni ofrece el CTA (solo el FAB en móvil o el botón de la cabecera, lejos), lo que provoca **un primer uso sin guía** (§3.3 vacío: qué aparecerá + CTA directo; §4.2 onboarding: estados vacíos con CTA).
- Arreglo: p. ej. Tandas: "A tanda is one batch: take pre-orders or sell what you baked." + botón "New tanda"; Sales en tanda abierta: "No orders yet." + "New sale"; Dashboard ya lo hace bien como referencia.

### A-18 Clients no tiene búsqueda ni orden por saldo
- Severidad: 2 (frecuente × bajo-medio) · Esfuerzo: M · Confianza: inferido
- Dónde: Clients (lista) · `src/pages/clients/index.vue:24-28` (orden alfabético fijo)
- Problema: la lista solo se ordena por nombre y no se puede buscar, lo que provoca que **responder "¿quién me debe más?" o encontrar a un cliente entre 60 exija desplazarse** (§4.2 búsqueda y filtros; Hick).
- Arreglo: campo de búsqueda (con el mismo `fold` de A-01) y orden "Balance ↓" como opción (en escritorio, cabecera de columna ordenable con `aria-sort`), guardado en `?sort=`.

### A-19 No hay DESIGN.md y la tipografía no tiene escala: 18 tamaños sueltos
- Severidad: 2 (persistente × bajo; causa de A-10/A-12) · Esfuerzo: M · Confianza: observado
- Dónde: repositorio (sin `DESIGN.md`/`PRODUCT.md`) · `rg 'font-size'` en `src/`: 18 valores distintos (0,68–1,8 rem: 0.78, 0.8, 0.85, 0.9, 0.95, 1.02, 1.05…)
- Problema: los tokens de color y espacio están bien pensados pero sus decisiones no están escritas, y tipografía y movimiento no tienen tokens, lo que provoca **deriva** (Arial filtrado, tamaños casi iguales que compiten, duraciones 120/140/150/160/200 ms) (§3.7: DESIGN.md como fuente de verdad; §3.8 tipo: escala modular).
- Arreglo: escribir `DESIGN.md` (formato Stitch, §3.7) a partir de `main.css`; añadir `--text-xs/sm/base/lg/xl/2xl` con razón 1.2 y `--motion-duration-*`/`--motion-ease-*`; sustituir los 18 valores. No se escribe aquí por ser modo audit.

### A-20 El inventario guarda en silencio y no reutiliza el stepper
- Severidad: 2 (ocasional × medio) · Esfuerzo: S · Confianza: observado
- Dónde: Tanda anticipada abierta › Inventory › "Produced" · `InventoryEditor.vue:106-115, 161-170` (`type="number"`, `@change`, sin `notify`)
- Problema: la cantidad producida se guarda al salir del campo sin ninguna confirmación (precios y pagos sí la tienen) y usa un `<input type=number>` desnudo en vez del `QuantityStepper` que ya existe, lo que provoca **dudas de si se guardó** y cambios accidentales con la rueda del ratón (Nielsen #1 visibilidad del estado, #4 consistencia).
- Arreglo: usar `QuantityStepper` con `min=0`; confirmar el guardado inline (check "Saved" junto a la fila durante 2 s, en `role="status"`) en lugar de un toast por fila.

### A-21 "Scheduled" y "Open" comparten color, y el naranja de acción decora insignias
- Severidad: 2 (frecuente × bajo) · Esfuerzo: S · Confianza: observado
- Dónde: badges de tipo y estado · `src/shared/ui/badges.ts:46-56` (`open` y `scheduled` → `badge-info`)
- Problema: en la tarjeta de una tanda abierta programada aparecen dos píldoras naranjas idénticas de conceptos distintos (captura no incluida), y el naranja es también el color de los botones y enlaces, lo que provoca **leer las insignias como pulsables y no distinguir tipo de estado de un vistazo** (§3.8 color: el acento no decora; Semejanza).
- Arreglo: tipo en neutro siempre (Scheduled y Anticipated en gris con icono distinto), estado con su color; reservar el naranja para lo accionable.

### A-22 Cada precio guardado en la tabla dispara un toast
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Products › Variations & pricing › tabla de precios · `PriceTable.vue:64-70`
- Problema: rellenar 6 precios produce 6 toasts apilados (máx. 3) tapando la parte baja, lo que provoca **ruido** (§4.2 overlays: toast para información no crítica; Carga cognitiva).
- Arreglo: confirmación inline por fila (como A-20) y reservar el toast para acciones globales.

### A-23 El diálogo de confirmación no tiene título visible
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: ConfirmDialogHost · `ConfirmDialogHost.vue:45-46` (título oculto "Please confirm")
- Problema: el diálogo es un párrafo largo con el objeto en medio ("Delete the sale for … ?\nPayments of …"), lo que provoca **leer todo para saber qué se decide** (§3.5 shield: título con el objeto, consecuencia debajo).
- Arreglo: aceptar `title` y `message` por separado: título "Delete Ana López's sale?", cuerpo con la consecuencia.

### A-24 Botones de estado en minúscula técnica y flecha de texto
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: StatusFlow · `StatusFlow.vue:70-75` ("← Back to production", "Advance to closed")
- Problema: usan el valor del enum en minúscula mientras las insignias dicen "Production"/"Closed", y la flecha es un carácter en lugar de un icono de la librería, lo que provoca **dos nombres para el mismo concepto** (Una palabra por concepto, §3.6).
- Arreglo: `statusLabel(next)` en los botones e icono `ArrowLeft` de lucide.

### A-25 "1 sales"
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Tandas › tarjeta móvil · `tandas/index.vue:153`
- Problema y arreglo: plural fijo; usar `Intl.PluralRules` o la misma lógica que "item/items" del formulario de venta.

### A-26 El tema no puede volver a "Sistema"
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Settings › Theme · `settings/index.vue:91-95`, `useTheme.ts:33-37`
- Problema: el texto dice "Follows your system preference until you choose one", pero tras elegir no hay forma de volver a seguir al sistema.
- Arreglo: opción "System" que borra la clave de `localStorage` y escucha `matchMedia('(prefers-color-scheme: dark)')`.

### A-27 "Tanda not found" sin encabezado
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: `/tandas/<id-inexistente>` · `tandas/[id].vue:79-82` (también `clients/[id].vue:39-41`)
- Problema: no hay `<h1>` (medido 0) y el título del documento es "Tandas · Mini Tanda", así que el foco tras navegar va a `<main>` sin anuncio útil.
- Arreglo: `<h1>Tanda not found</h1>` con el enlace como CTA.

### A-28 "Total · 2 items" cuenta líneas, no unidades
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Hoja de venta › pie · `SaleForm.vue:249-251`
- Problema: 3 pasteles + 2 cajas se leen "2 items". Arreglo: "2 products · 5 units" o solo unidades.

### A-29 El nombre por defecto de la tanda va en ISO
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Tandas › New tanda · `tandas/index.vue:32` ("Tanda 2026-10-07" frente a "7 oct 2026" en el resto)
- Arreglo: `Tanda ${formatDate(todayISO())}`.

### A-30 Las fechas se parten en dos líneas en la tabla de tandas a 768 px
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Tandas › tabla › 768 px (captura no incluida) · `tandas/index.vue:116`
- Arreglo: `white-space: nowrap` en fecha e importes.

### A-31 Superficies del navegador sin tematizar y tarjetas con borde + sombra
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: global · `main.css:128-135` (`.card` con `border` y `box-shadow`); sin `::selection`, `accent-color`, `caret-color`, `scrollbar-color` (`rg` = 0)
- Problema: selección azul por defecto sobre la paleta crema y doble recurso de elevación en cada tarjeta (§3.8 acabado: borde **o** sombra; tematizar superficies del navegador).
- Arreglo: `:root { accent-color: var(--color-primary); caret-color: var(--color-primary) } ::selection { background: var(--color-primary-soft) }` y elegir borde (plano-tonal) para tarjetas en reposo.

### A-32 Tarjetas de cifras centradas con enlaces que repiten la navegación
- Severidad: 1 · Esfuerzo: S · Confianza: observado
- Dónde: Dashboard · 1440 px (captura no incluida) · `src/pages/index.vue:50-70`
- Problema: tres tarjetas iguales, centradas, con "View …" que duplica la barra de navegación; el patrón no dice nada que la lista "Next up" no diga ya (§3.8 andamiaje: tres tarjetas + todo centrado; §4.2 dashboard: cada widget responde una pregunta).
- Arreglo: fila compacta alineada a la izquierda con 2–3 cifras que respondan preguntas reales ("Por cobrar", "Por entregar hoy") y enlace solo donde lleve a una vista filtrada.

### A-33 "Record payment" nombra dos acciones distintas en la ficha del cliente
- Severidad: 1 · Esfuerzo: S · Confianza: observado (el propio script de siembra pulsó el botón equivocado)
- Dónde: Cliente › formulario (envía) y cada venta (solo preselecciona) · `PaymentForm.vue:131`, `ClientSalesList.vue:96-103`
- Arreglo: renombrar el de cada venta a "Pay this sale" (o "Pay $660.00").

---

## Comprobaciones obligatorias (§3.6)

| Comprobación | Resultado |
|---|---|
| Estados de la tarea primaria | Vacío, error de validación, conflicto de stock, confirmación de descarte y éxito (toast) presentes. Faltan: Atrás (A-02), duplicado de cliente (A-01). |
| Tiempos de feedback | Todo es local (sql.js): respuestas instantáneas. Splash de arranque en `index.html`. Sin estados de carga largos que medir. |
| Cada estado tiene salida | Diálogos: ×, Esc, Cancel. Faltan: Atrás en la hoja y en el editor de producto (A-02, A-05); renombrar cliente (A-06). |
| Una palabra por concepto | Fallan "production" / "Production" (A-24), "items" = líneas (A-28), "Record payment" ×2 (A-33). |
| Color nunca única señal | Falla la navegación activa (A-13). Insignias, saldos e inventario agotado llevan texto. |
| Errores con qué, por qué y qué hacer | Bien en pago, precio y foto. Débil en hoja de venta (A-14) y bloqueo de borrado (A-16). |

## Contraste calculado (WCAG 2, 41 pares)

Todos los pares de **texto** pasan AA en claro y oscuro: ink-soft/bg 5,90 (oscuro 6,16), primario/superficie 5,00 (4,72), botón primario 5,00 (oscuro 4,71), insignias 4,69–6,85, peligro/superficie 5,99 (5,47), borde de control 3,87 (3,73), anillo de foco 5,00 (4,72). Fallan solo: **activo vs inactivo en navegación 1,27 / 1,13** (A-13). Los textos deshabilitados (2,08–2,64) están exentos por WCAG y llevan motivo visible.

## Fila de dispositivo (§4.1)

| Requisito | Web móvil | Escritorio web |
|---|---|---|
| Objetivos | ✅ 44×44 en puntero grueso (kebab, Atrás, toggle, botones, campos); barra inferior 75×58; FAB 56 | ✅ ≥24 px (kebab 34×32) |
| Inputs de 16 px | ❌ 15,2 px (A-09) | n/a |
| Sin hover como única vía | ✅ | ✅ |
| `svh`/`dvh` en alturas | ✅ `100dvh` / `85dvh` | ✅ |
| Sin scroll horizontal a 320 px | ✅ 0 px en 7 vistas + hoja de venta | — |
| Teclado completo y foco visible | — | ✅ skip link, foco en h1 al navegar, trampas de foco en diálogos, tabs ARIA, menú ⋯ con flechas. Foco visible en todo lo recorrido |
| Atrás predictivo / Atrás cierra overlays | ❌ (A-02, A-05) | ❌ mismo comportamiento con Alt+← |
| Zona del pulgar | ✅ FAB y acciones primarias de la hoja abajo; "Add sale" fijo al pie | — |
| No verificable | Teclado virtual tapando campos, zoom real de iOS, gestos de sistema, Dynamic Type | Lector de pantalla real (solo árbol y nombres) |

## Señales de "UI hecha por IA" (§3.8)

**5 señales en 4 familias** (≥3 familias = "look plantilla" leve):
1. *Paleta* — crema + terracota cálida (parcial: está derivada del mundo panadería, lo cual es una razón válida; documentarla en DESIGN.md la convierte en decisión).
2. *Tipografía* — `system-ui` en todo sin decisión escrita, y además Arial filtrado en controles (A-12).
3. *Andamiaje* — tres tarjetas de cifras centradas con enlace (A-32).
4. *Acabado* — borde fino + sombra en todas las tarjetas (A-31).
5. *Acabado* — superficies del navegador sin tematizar (A-31).

No hay: degradados, texto con degradado, emoji como iconos (Lucide en todo, salvo "×" y "←" de texto), glassmorphism, copy de marketing, animaciones sin propósito.

## §3.7 DESIGN.md

No existe `DESIGN.md` ni `PRODUCT.md` (A-19). En modo audit no se escribe; recomendación: crearlo en un `restyle` con los tokens actuales de `main.css` como punto de partida y añadir a `CLAUDE.md`/`AGENTS.md` la regla "Antes de tocar UI, lee DESIGN.md".

## Ética (§9)

Sin patrones engañosos: aceptar y cancelar tienen el mismo peso, los destructivos llevan confirmación roja con foco en Cancel, no hay urgencias ni contadores inventados, nada premarcado. La promesa "You can undo it right after" en la importación es más fuerte de lo que el mecanismo cumple (A-08).

## Lo que ya funciona (preservar)

- **Diálogos accesibles de verdad** (`useDialogFocus`): foco inicial, trampa de Tab, Esc, retorno del foco, pila de diálogos; confirmaciones destructivas en rojo con foco en Cancel y Cancel separado a la izquierda.
- **Protección del borrador** con ×, Esc y fondo ("Discard this sale? The 2 items…").
- **Combobox ARIA 1.2** completo con teclado (activedescendant, flechas, Enter, Esc que no cierra el diálogo), opciones sin precio deshabilitadas con el motivo.
- **Navegación:** skip link, foco al `<h1>` en cada cambio de ruta, títulos de documento por entidad, Atrás solo en detalle y con caída a la lista padre.
- **Contraste** de todo el texto ≥4,5:1 en ambos temas; modo oscuro con paleta propia (no invertida) y `color-scheme: dark`.
- **Reflow:** 0 px de scroll horizontal a 320 px en todas las vistas; nav inferior que oculta etiquetas a tamaños grandes en vez de recortarlas.
- **Objetivos táctiles de 44 px** en puntero grueso y `safe-area` en barra, FAB, hoja y toasts.
- **QuantityStepper** (teclado, límites, 44 px táctil) y total fijo al pie de la hoja.
- **Choice cards** con radio/checkbox nativos, foco en la tarjeta y `prefers-reduced-motion`.
- **Inventario** que oculta lo no producido y reserva el rojo para lo agotado; aviso "No price — set it in Products".
- **Pagos con Undo**, errores de campo con `aria-invalid` + `aria-describedby` + foco al primero inválido; validación de foto (tipo y 1 MB) antes de subir.
- **Splash de arranque** y pantalla de error de arranque en `index.html`.
- **Tokens de ritmo** (`--gap-section`, `--gap-grid`, `--pad-card`) aplicados de forma coherente: las tarjetas alinean en 375/768/1440.

## Matriz de prioridad

| ID | Sev | Esfuerzo | Cuándo |
|---|---|---|---|
| A-01 | 4 | S | Antes de lanzar |
| A-02 | 3 | M | Siguiente iteración |
| A-03 | 3 | S | Siguiente iteración |
| A-04 | 3 | S | Siguiente iteración |
| A-05 | 3 | M | Siguiente iteración |
| A-06 | 3 | M | Siguiente iteración |
| A-07 | 3 | M | Siguiente iteración |
| A-08 | 3 | S | Siguiente iteración |
| A-09 | 3 | S | Siguiente iteración (quick win) |
| A-10 | 2 | S | Backlog (junto a A-19) |
| A-11 | 2 | S | Backlog |
| A-12 | 2 | S | Backlog (quick win, 1 línea) |
| A-13 | 2 | S | Backlog |
| A-14 | 2 | S | Backlog |
| A-15 | 2 | S | Backlog |
| A-16 | 2 | S | Backlog |
| A-17 | 2 | S | Backlog |
| A-18 | 2 | M | Backlog |
| A-19 | 2 | M | Backlog (restyle) |
| A-20 | 2 | S | Backlog |
| A-21 | 2 | S | Backlog |
| A-22…A-33 | 1 | S | Cuando haya ocasión |

Quick wins de una sesión: A-01, A-09, A-12, A-03, A-08 (pausa), A-15, A-25, A-29, A-30.

## Gate §8

- [x] Intent escrito; una primaria por área (FAB en móvil, botón en escritorio; "Add sale" único en la hoja).
- [~] Estados: completos salvo Atrás (A-02/A-05) y vacíos sin CTA (A-17).
- [x] Feedback <100 ms (todo local); [~] doble envío: el envío es síncrono, no se probó doble clic rápido.
- [x] Destructivo con confirmación específica y foco en Cancel; Undo en pagos.
- [~] Formularios: etiquetas visibles, `inputmode="decimal"`, `autocomplete="off"`; fallan 16 px (A-09) y orden de validación de la venta (A-14).
- [~] Accesibilidad: contraste calculado ✅, Tab ✅, nombres ✅ salvo "Actions" (A-15), objetivos ✅, reduced-motion ✅; color único en nav (A-13).
- [x] 375/768/1440 sin scroll horizontal; 320 px ✅; [~] 200 % (A-10, A-11).
- [x] Claro y oscuro con contraste comprobado en la superficie más clara de cada tema.
- [~] Fila de dispositivo recorrida; no verificable: teclado virtual, iOS real, lector de pantalla real.
- [ ] Sin DESIGN.md; 5 señales de plantilla (A-19, A-31, A-32).
- [x] Sin patrones engañosos.

## Límites del método

- Inspección experta + medición automatizada en **Chromium de escritorio** con emulación móvil (`isMobile`, `hasTouch`). No se probó en iOS Safari ni Android reales: el zoom de A-09, el gesto Atrás real de A-02 y el teclado virtual sobre la hoja son inferencias sobre comportamiento conocido de plataforma.
- El 200 % de texto se simuló con `html{font-size:200%}`, no con el ajuste del sistema operativo.
- Lector de pantalla no ejecutado: se verificaron nombres accesibles, roles y orden de foco, no la locución real.
- Datos sembrados (4 productos, 5 clientes, 9 ventas): A-07 y A-18 (volumen alto) son **inferidos**; validar con una tanda real de 20–40 pedidos.
- Recomendado validar con 3–5 usuarias reales los sev ≥3 inferidos (A-07, A-09) antes de priorizar esfuerzo M.
- Artefactos: capturas citadas por A-01..A-09 en [`ux-craft-audit/`](ux-craft-audit/); el resto de capturas, las mediciones (`measure.json`, `capture-report.json`) y los scripts de siembra y medición quedaron en el directorio temporal de la sesión y no se incluyen. La auditoría no modificó el código.
