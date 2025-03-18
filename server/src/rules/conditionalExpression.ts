import { Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { ConditionalExpression, Node } from "estree"

export const conditonalExpressionRule = new class extends Rule<ConditionalExpression> {
    public process(child: ConditionalExpression, parent: Node, context: Context, ast: AST): void {
        ast.checkIncompleteLeftRightStatement(child.consequent, child.alternate, child.loc!, "Incomplete ternary");
    }
}();