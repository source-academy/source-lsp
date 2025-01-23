# source-lsp

A lsp server for [source](https://github.com/source-academy/js-slang)

# Setup

First run these commands:

```console
git clone https://github.com/mug1wara26/source-lsp
cd source-lsp
npm i
```

Now we need to rebuild js-slang. This is because vscode uses electron, which causes a node_module_version mismatch
To fix this, we need to use electron-rebuild, we need to find our vscode electron version for this, which is in Help > About

```console
cd server
./node_modules/bin/electron-rebuild -v <electron version>
```

Then now the plugin should be able to run, enter `code .` in the root folder to startup vscode

Then in vscode, press ctrl + shift + b to build, then press F5 to run the plugin. You can open test.sourcejs for testing
