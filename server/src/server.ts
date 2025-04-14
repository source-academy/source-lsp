import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  InsertTextFormat,
  Range,
  DocumentHighlightParams,
  DocumentSymbolParams,
  RenameParams,
  WorkspaceEdit,
  DocumentSymbol,
  HoverParams,
  Hover
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { sourceLocToRange } from './utils';

import { AST } from './ast';
import { Chapter, Context } from './types';

const SECTION = "\u00A7";
const chapter_names = {
  [`Source ${SECTION}1`]: Chapter.SOURCE_1,
  [`Source ${SECTION}2`]: Chapter.SOURCE_2,
  [`Source ${SECTION}3`]: Chapter.SOURCE_3,
  [`Source ${SECTION}4`]: Chapter.SOURCE_4
};

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

// let context: Context = { chapter: Chapter.SOURCE_1 };
let contextCache: Map<string, Context> = new Map();
let astCache: Map<string, AST> = new Map();

function getAST(uri: string): AST {
  if (astCache.has(uri)) return astCache.get(uri)!;

  let context = contextCache.get(uri)
  if (!context) {
    context = { chapter: Chapter.SOURCE_1 };
    console.log(`No context found for ${uri}, using default context ${JSON.stringify(context)}`);
  }
  console.log(`Creating AST for ${uri} with context ${JSON.stringify(context)}`);

  const ast = new AST(documents.get(uri)!.getText(), context, uri);
  astCache.set(uri, ast);
  return ast;
}

connection.onInitialize((params: InitializeParams) => {
    connection.console.log('LSP INIT');
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      },
      declarationProvider: true,
      documentHighlightProvider: true,
      documentSymbolProvider: true,
      renameProvider: true,
      hoverProvider: true
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// // Custom request to set the language version
// connection.onRequest("setLanguageVersion", (params: { version: string }) => {
//   if (Object.keys(chapter_names).includes(params.version)) {
//     context = { chapter: chapter_names[params.version as keyof typeof chapter_names] }
//     astCache.clear();
//     documents.all().forEach(validateTextDocument);
//     return { success: true };
//   }
//   else return { success: false };
// });

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let timeout: NodeJS.Timeout | undefined = undefined;
documents.onDidChangeContent(change => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    astCache.delete(change.document.uri);
    validateTextDocument(change.document);
  }, 300);
});

async function validateTextDocument(document: TextDocument): Promise<void> {
  connection.sendDiagnostics({ uri: document.uri, diagnostics: getAST(document.uri).getDiagnostics() });
}

// TODO: handle file deletion and creation
connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VS Code
  connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) return [];

    return getAST(textDocumentPosition.textDocument.uri).getCompletionItems(textDocumentPosition.position);
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data?.parameters) {
    item.insertText = `${item.label}(${item.data.parameters.filter((x: string) => item.data.optional_params ? !item.data.optional_params.includes(x) : true).map((param: string, idx: number) => `\${${idx + 1}:${param}}`)})`;
    item.insertTextFormat = InsertTextFormat.Snippet;
  };

  return item;
}
);



// This handler provides the declaration location of the name at the location provided
connection.onDeclaration(async (params) => {
  const position = params.position;

  const result = getAST(params.textDocument.uri).findDeclaration(position);

  if (result) {
    const range: Range = sourceLocToRange(result);

    return {
      uri: params.textDocument.uri,
      range
    };
  }
  else {
    return null;
  }
});

connection.onDocumentHighlight((params: DocumentHighlightParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  return getAST(params.textDocument.uri).getOccurences(params.position);
})

connection.onDocumentSymbol(async (params: DocumentSymbolParams): Promise<DocumentSymbol[] | null> => {
  return getAST(params.textDocument.uri).getDocumentSymbols();
})

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const position = params.position;

  return getAST(params.textDocument.uri).renameSymbol(position, params.newName);
})

connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const position = params.position;

  return getAST(params.textDocument.uri).onHover(position);
})

connection.onNotification("source/publishInfo", (info) => {
  connection.console.log("Info");
  connection.console.log(info);

  contextCache = new Map(Object.entries(info));
  // TODO: We only need to revalidate the documents that have changed
  astCache.clear();
  documents.all().forEach(validateTextDocument);
  return { success: true };
})

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
