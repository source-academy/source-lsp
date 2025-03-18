import { Node} from "estree";
import { Context } from "vm";
import { AST } from "../ast";

export abstract class Rule<T extends Node> {
    public abstract process(child: T, parent: Node, context: Context, ast: AST): void
}