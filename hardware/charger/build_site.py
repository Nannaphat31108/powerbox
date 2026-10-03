#!/usr/bin/env python3
"""Regenerate the charger website data from the sources in this folder.

    python hardware/charger/pcb/design.py   # re-route the PCB -> pcb/pcb.json
    python hardware/charger/build_site.py   # -> software/static/charger/assets/data.js
"""
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent / "software" / "static" / "charger"

pcb = (HERE / "pcb" / "pcb.json").read_text()
code = (HERE / "SmartCharger" / "SmartCharger.ino").read_text()
(SITE / "assets" / "data.js").write_text(
    "// สร้างจาก hardware/charger/build_site.py ห้ามแก้ไฟล์นี้ด้วยมือ\n"
    f"const PCB={pcb};\nconst CODE={json.dumps(code, ensure_ascii=False)};\n"
)
shutil.copy(HERE / "SmartCharger" / "SmartCharger.ino", SITE / "SmartCharger.ino")
print("wrote", SITE / "assets" / "data.js")
