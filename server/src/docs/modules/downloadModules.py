import requests
import json
from markdownify import markdownify as md

MODULE_LIST_URL = "https://raw.githubusercontent.com/source-academy/modules/refs/heads/master/modules.json"
MODULE_DOCS_URL = "https://source-academy.github.io/modules/jsons"

module_list = requests.get(MODULE_LIST_URL).json().keys()
modules = {}
kind_to_meta_map = {"variable": "const", "function": "func", "unknown": "unknown"}

for module_name in module_list:
    module = requests.get(f"{MODULE_DOCS_URL}/{module_name}.json").json()
    print(module_name)
    modules[module_name] = [
        [
            item := {
                "label": k,
                "meta": kind_to_meta_map[module[k]["kind"]],
                "title": f"Auto-import from {module_name}",
                "description": (
                    "#### "
                    + (
                        f"{k}:{module[k]['type']}"
                        if module[k]["kind"] == "variable"
                        else f"{k}({', '.join([i[0] for i in module[k]['params']])}) → {module[k]['retType']}"
                        if module[k]["kind"] == "function"
                        else ""
                    )
                    + md(module[k]["description"])[1:-1]
                )
                if module[k]["kind"] != "unknown"
                else "",
            },
            item.update(
                {
                    "parameters": [
                        f"${{{i+1}:{v[0]}}}" for i, v in enumerate(module[k]["params"])
                    ]
                }
            )
            if module[k]["kind"] == "function"
            else 0,
        ][0]
        for k in module
    ]

with open("modules.json", "w") as f:
    json.dump(modules, f)
