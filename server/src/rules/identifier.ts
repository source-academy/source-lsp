import { Context } from "js-slang/dist/types";
import { AST } from "../ast";
import { Rule } from "./rule";
import { Identifier, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { DECLARATIONS } from "../types";
import { isBuiltinConst, isBuiltinFunction, sourceLocEquals, rangeToSourceLoc } from "../utils";

export const identifierRule = new class extends Rule<Identifier> {
    public process(child: Identifier, parent: Node, context: Context, ast: AST): void {
        if (child.name === "eval")
            ast.addDiagnostic("eval is not allowed", DiagnosticSeverity.Error, child.loc!);
        if (parent.type !== DECLARATIONS.IMPORT) {
            // Ensure that all declarations have been processed
            ast.addDiagnosticCallback((node: Node) => {
                const identifier = node as Identifier;
                if (identifier.loc) {
                    const loc = identifier.loc;
                    const declaration = ast.findDeclarationByName(identifier.name, loc)
                    if (declaration === undefined && !(isBuiltinConst(identifier.name, context) || isBuiltinFunction(identifier.name, context) || ast.isDummy(identifier)))
                        ast.addDiagnostic(`Name '${identifier.name}' not declared`, DiagnosticSeverity.Error, loc);
                }
            }, child)
        }

        const declaration = ast.findDeclarationByName(child.name, child.loc!);
        if (declaration && !sourceLocEquals(rangeToSourceLoc(declaration.selectionRange), child.loc!)) {
            declaration.unused = false;
        }
    }
}();