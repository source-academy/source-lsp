import sys
import json
from markdownify import markdownify as md

if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("usage: python3 convertJsonDocs.py file1.json file2.json ...")
        exit()

    with open("source.json", "w") as f:
        json.dump(
            [
                [
                    {
                        "label": key,
                        "title": val["title"],
                        "description": md(val["description"])[1:-1],
                        "meta": val["meta"],
                    }
                    for key, val in json.loads(open(i).read()).items()
                ]
                for i in sys.argv[1:]
            ],
            f,
        )
