"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECLARATIONS = exports.AUTOCOMPLETE_TYPES = void 0;
// Note that the order the enum fields appear in determine the order they are displayed in the autocomplete list
var AUTOCOMPLETE_TYPES;
(function (AUTOCOMPLETE_TYPES) {
    AUTOCOMPLETE_TYPES[AUTOCOMPLETE_TYPES["BUILTIN"] = 0] = "BUILTIN";
    AUTOCOMPLETE_TYPES[AUTOCOMPLETE_TYPES["SYMBOL"] = 1] = "SYMBOL";
    AUTOCOMPLETE_TYPES[AUTOCOMPLETE_TYPES["MODULE"] = 2] = "MODULE";
})(AUTOCOMPLETE_TYPES || (exports.AUTOCOMPLETE_TYPES = AUTOCOMPLETE_TYPES = {}));
var DECLARATIONS;
(function (DECLARATIONS) {
    DECLARATIONS["VARIABLE"] = "VariableDeclaration";
    DECLARATIONS["FUNCTION"] = "FunctionDelcaration";
    DECLARATIONS["IMPORT"] = "ImportDeclaration";
})(DECLARATIONS || (exports.DECLARATIONS = DECLARATIONS = {}));
//# sourceMappingURL=types.js.map