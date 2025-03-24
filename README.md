# source-lsp

A LSP server for [source](https://github.com/source-academy/js-slang)

## Use

The code for the lsp is in `/server` but code for testing the lsp is provided in `/client`. If you want to use this lsp in your own VSCode extension, download the
latest version from the [releases](https://github.com/mug1wara26/source-lsp/releases) page, and copy the set up in `client/src/extension.ts`.
Ensure that the lines

```
const serverModule = context.asAbsolutePath(
  path.join("dist", 'source-lsp.js')
);
```

point to the correct path to the downloaded lsp file.

If you want to test out the lsp, you can clone the repo and open up VSCode

```console
git clone https://github.com/mug1wara26/source-lsp && cd source-lsp
npm i 
code .
```

Then press ctrl + shift + b and enter to build, then press f5 to run the plugin.

## Features

Currently, the following language features are supported:

* Completion
* Go to declaration
* Highlight names
* Document Symbols
* Rename symbol
* Hover information
* Diagnostics

## Documentation

Documentation for diagnostics can be found [here](server/src/rules)
