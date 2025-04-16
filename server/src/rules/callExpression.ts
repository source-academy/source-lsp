import { AST } from "../ast";
import { Context, DeclarationKind } from "../types";
import { Rule } from "./rule";
import { CallExpression, Identifier, Node } from "estree"
import { DiagnosticSeverity } from "vscode-languageserver";
import { NODES, ImportedSymbol } from "../types";
import { getImportedName, builtin_functions } from "../utils";

export const callExpressionRule = new class extends Rule<CallExpression> {
    public process(child: CallExpression, parent: Node, context: Context, ast: AST): void {
        if (child.callee.type === NODES.IDENTIFIER) {
          // Declaration might not have been processed yet
          ast.addDiagnosticCallback((node: Node) => {
            const call_expression = node as CallExpression;
            const callee = call_expression.callee as Identifier;
            if (callee.loc) {
              const loc = callee.loc;
              let declaration = ast.findDeclarationByName(callee.name, loc)
              if (declaration !== undefined) {
                // We cannot check for let because they can be reassigned. Constants assigned to lambdas will still be "func"
                if (declaration.meta === "const" && declaration.declarationKind !== DeclarationKind.KIND_PARAM)
                  ast.addDiagnostic(`'${callee.name}' is not a function`, DiagnosticSeverity.Error, loc);
                if (declaration.parameters !== undefined || declaration.declarationKind === DeclarationKind.KIND_IMPORT) {
                  let hasRestElement = false;
                  let num_params = 0;
                  if (declaration.declarationKind === DeclarationKind.KIND_IMPORT) {
                    const imported = getImportedName((declaration as ImportedSymbol).module_name, (declaration as ImportedSymbol).real_name)!;
                    num_params = imported.parameters ? imported.parameters.length : 0;
                  }
                  else {
                    hasRestElement = declaration.parameters!.some(x => x.isRestElement);
                    num_params = declaration.parameters!.length - (hasRestElement ? 1 : 0);
                  }


                  if (hasRestElement) {
                    if (call_expression.arguments.length < num_params)
                      ast.addDiagnostic(`Expected ${num_params} or more arguments, but got ${call_expression.arguments.length}`, DiagnosticSeverity.Error, loc);
                  }
                  else {
                    if (call_expression.arguments.length !== num_params)
                      ast.addDiagnostic(`Expected ${num_params} arguments, but got ${call_expression.arguments.length}`, DiagnosticSeverity.Error, loc);
                  }
                }
              }
              else if (callee.name in builtin_functions[context.chapter - 1]) {
                const doc = builtin_functions[context.chapter - 1][callee.name];
                // parameters must exist
                const num_params = doc.parameters!.length

                // In the documentation, there is no parameter for the rest element, so we dont have to num_params-1 if the function has a rest element
                // There is also no occurence of an optional param with a rest element
                if (doc.hasRestElement === true) {
                  if (call_expression.arguments.length < num_params)
                    ast.addDiagnostic(`Expected ${num_params} or more arguments, but got ${call_expression.arguments.length}`, DiagnosticSeverity.Error, loc);
                }
                else {
                  if (doc.optional_params) {
                    const min_params = num_params - doc.optional_params.length;
                    if (call_expression.arguments.length < min_params || call_expression.arguments.length > num_params)
                      ast.addDiagnostic(`Expected between ${min_params} and ${num_params} arguments, but got ${call_expression.arguments.length}`, DiagnosticSeverity.Error, loc);
                  }
                  else {
                    if (call_expression.arguments.length !== num_params)
                      ast.addDiagnostic(`Expected ${num_params} arguments, but got ${call_expression.arguments.length}`, DiagnosticSeverity.Error, loc);
                  }
                }
              }
            }
          }, child);
        }
    }
}();