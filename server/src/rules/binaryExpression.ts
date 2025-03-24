import { BinaryExpression, Node } from "estree";
import { AST } from "../ast";
import { NODES } from "../types";
import { DiagnosticSeverity } from "vscode-languageserver";
import { Rule } from "./rule";
import { Chapter, Context } from "../types";

export const binaryExpressionRule = new class extends Rule<BinaryExpression> {
    private permitted_operators = [
        '+',
        '-',
        '*',
        '/',
        '%',
        '===',
        '!==',
        '<',
        '>',
        '<=',
        '>=',
        '&&',
        '||'
      ]

    public process(child: BinaryExpression, parent: Node, context: Context, ast: AST): void {
        ast.checkIncompleteLeftRightStatement(child.left, child.right, child.loc!, "Incomplete binary expression");

        if (!this.permitted_operators.includes(child.operator)) {
            if (child.operator == "==" || child.operator == "!=")
                ast.addDiagnostic(`Use ${child.operator}= instead of ${child.operator}`, DiagnosticSeverity.Error, child.loc!);
            else
                ast.addDiagnostic(`${child.operator} operator is not allowed`, DiagnosticSeverity.Error, child.loc!);
        }

        if (
            (child.operator === "===" || child.operator === "!==")
            && context.chapter < Chapter.SOURCE_3
        ) {
            // undefined is an identifier so we have to check this first
            if (child.left.type === NODES.IDENTIFIER && child.left.name === "undefined")
                ast.addDiagnostic(`Expected string or number on left hand side of operation, got undefined`, DiagnosticSeverity.Error, child.left.loc!);
            else if (child.left.type === NODES.LITERAL) {
                const left_type = typeof child.left.value;
                if (!(left_type === "string" || left_type === "number"))
                    ast.addDiagnostic(`Expected string or number on left hand side of operation, got ${child.left.value === null ? "null" : left_type}`, DiagnosticSeverity.Error, child.left.loc!);

                else if (child.right.type === NODES.IDENTIFIER && child.right.name === "undefined")
                    ast.addDiagnostic(`Expected ${left_type} on left hand side of operation, got undefined`, DiagnosticSeverity.Error, child.right.loc!);
                else if (child.right.type === NODES.LITERAL) {
                    const right_type = typeof child.right.value;
                    if (left_type !== right_type)
                        ast.addDiagnostic(`Expected ${left_type} on right hand side of operation, got ${child.right.value === null ? "null" : right_type}`, DiagnosticSeverity.Error, child.right.loc!);
                }
            }
        }
    }
};