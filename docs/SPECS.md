# MINI TANDA

## Product
Tengo productos con: nombre, descripción opcional, foto

Cada producto posee o no, N variaciones

Torta:
- variación: SABOR
  - CAFE
  - Chocolate
  - RED VELVET
- variación: SIZE
  - Personal
  - Familiar


El precio:
El precio puede ser:
- global
- dependiendo una o varias variaciones (significa que por cada SKU, se coloca un price)



Para productos sin variación, solo se posee un precio

---

## Tanda.
Teniendo creados los productos, ahora puedo crear tandas.

Una tanda posee un nombre (automáticamente se puede colocar la fecha para la tanda), un estado.

La tanda puede ser de 2 tipos, programada y anticipada

### Programada

Es cunado programo a una fecha futura, y empiezo a recibir productos por encargo.
Cada encargo, significa una venta

Es decir, las ventas se hacen pre producción del producto.

Cada venta se compone de:
- Un cliente (que se puede crear al toke si no existe),
- Un estado del pago (pagado o no)
- Un estado de la entrega (que se habilita a colocar como entregado cuando la tanda ya pasa de producción a lista). Es par saber si ya entregué el producto
- Los productos asociados a esa venta, de donde se calcula el monto. Ejemplo: 3 tortas personales red velve y una grande de chocolate para la misma persona

### Anticipada

Es cuando hago o se genera con una cantidad de productos determinada y ahora cada venta se realiza sobre el inventario asociado a ese inventario.
Es decir, las ventas se hacen post producción.
No debería poder vender más de lo que produzco.

Cada inventario depende de la combinacióñ de SKUS que agregue al inventario, ejemplo:
produje:

- 4 red vevle pequeñás 
- 4 red velve rgande
- 2 chocolate pequeñas.

Por lo que no puedo vender 1 grande de chocolate, no tengo para esa tanda.


## Clietne

Puedo ir a visitarlo y hacerle abonos a lo que me debe en genral.




---
cliente: solo el name
