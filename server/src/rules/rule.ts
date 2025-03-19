import { Node} from "estree";
import { AST } from "../ast";
import { Context } from "../types";

export abstract class Rule<T extends Node> {
    public abstract process(child: T, parent: Node, context: Context, ast: AST): void
}