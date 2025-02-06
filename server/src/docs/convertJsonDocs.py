import sys
import json
from markdownify import markdownify as md
import re

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("usage: python3 convertJsonDocs.py file1.json file2.json ...")
        exit()

    patches = json.loads(open("param_patches.json").read())

    with open("source.json", "w") as f:
        # one liner :)
        json.dump(
            [
                [
                    [
                        item := {
                            "label": key,
                            "title": val["title"],
                            "description": md(val["description"])[1:-1],
                            "meta": val["meta"],
                        },
                        item.update(
                            {
                                "parameters": (
                                    patches[key]
                                    if key in patches
                                    else [param.strip() for param in params.split(",")]
                                )
                                if len(
                                    params := re.findall(
                                        r"\w+\(([^)]*)\)", val["title"]
                                    )[0]
                                )
                                != 0
                                else []
                            }
                        )
                        if item["meta"] == "func"
                        else 0,
                    ][0]
                    for key, val in json.loads(open(i).read()).items()
                ]
                for i in sys.argv[1:]
            ],
            f,
        )
