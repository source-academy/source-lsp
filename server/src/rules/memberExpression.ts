import { AST } from "../ast";
import { Rule } from "./rule";
import { MemberExpression, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { NODES } from "../types";
import { Chapter, Context } from "../types";

export const memberExpressionRule = new class extends Rule<MemberExpression> {
    public process(child: MemberExpression, parent: Node, context: Context, ast: AST): void {
        if (context.chapter < Chapter.SOURCE_3) 
            ast.addDiagnostic("Member access expressions are not allowed", DiagnosticSeverity.Error, child.loc!)
        // If computed is false, is dot abbreviation, else is object property / array access
        if (!child.computed)
            ast.addDiagnostic("No dot abbreviations", DiagnosticSeverity.Error, child.loc!);
        else if (child.property.type === NODES.IDENTIFIER && child.property.name === "undefined") 
            ast.addDiagnostic("Expected integer as array index, got undefined.", DiagnosticSeverity.Error, child.property.loc!);
        else if (child.property.type === NODES.LITERAL) {
            if (typeof child.property.value !== "number")
                ast.addDiagnostic(`Expected integer as array index, got ${child.property.value === null ? "null" : typeof child.property.value }.`, DiagnosticSeverity.Error, child.property.loc!);
            else if (!Number.isSafeInteger(child.property.value))
                ast.addDiagnostic("Expected integer as array index, got float.", DiagnosticSeverity.Error, child.property.loc!);
        }
    }
}();