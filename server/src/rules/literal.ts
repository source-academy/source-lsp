import { AST } from "../ast";
import { Rule } from "./rule";
import { Literal, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { Chapter, Context } from "../types";

export const literalRule = new class extends Rule<Literal> {
    public process(child: Literal, parent: Node, context: Context, ast: AST): void {
        if (typeof child.value === "string") {
          if (child.raw!.length < 2 || !child.raw!.endsWith(child.raw!.charAt(0)))
            ast.addDiagnostic("Incomplete string expression", DiagnosticSeverity.Error, child.loc!);
        }
        if (child.value === null && context.chapter == Chapter.SOURCE_1)
          ast.addDiagnostic("Null literals not allowed", DiagnosticSeverity.Error, child.loc!)
    }
}();