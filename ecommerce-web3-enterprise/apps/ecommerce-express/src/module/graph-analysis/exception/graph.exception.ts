// graph.exception.ts => errores de dominio del módulo Graph Analysis.
import { NotFoundException } from "../../../shared/filter/http-exception.filter";

export class GraphResultNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Graph result", id); // 404 GRAPH_RESULT_NOT_FOUND
  }
}

export class GraphNodeNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Graph node", id); // 404 GRAPH_NODE_NOT_FOUND: el producto no existe o no está activo
  }
}
