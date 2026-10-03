#!/usr/bin/env python3
"""Smart battery charger PCB: placement + 2-layer grid router.
Grid unit = 1.27 mm. Board 80 x 64 cells (101.6 x 81.28 mm)."""
import heapq, json, sys

G = 1.27
W, H = 80, 64

# ---------- footprints: pads (name, dx, dy, shape, size_mm), body ----------
def fp_tb2():
    return dict(pads=[("1", 0, 0, "sq", 2.6), ("2", 0, 4, "rd", 2.6)],
                body=("rect", -4.5, -2.2, 2.5, 6.2), kind="tb2")
def fp_fuse():
    return dict(pads=[("1", 0, 0, "rd", 3.0), ("2", 18, 0, "rd", 3.0)],
                body=("rect", -1.8, -2.6, 19.8, 2.6), kind="fuse")
def fp_d_big():
    return dict(pads=[("A", 0, 0, "rd", 2.6), ("K", 12, 0, "sq", 2.6)],
                body=("rect", 3.0, -2.1, 9.0, 2.1), kind="diode_big")
def fp_d():
    return dict(pads=[("A", 0, 0, "rd", 1.9), ("K", 8, 0, "sq", 1.9)],
                body=("rect", 2.0, -1.1, 6.0, 1.1), kind="diode")
def fp_res():
    return dict(pads=[("1", 0, 0, "rd", 1.8), ("2", 8, 0, "rd", 1.8)],
                body=("rect", 1.6, -1.0, 6.4, 1.0), kind="res")
def fp_res2w():
    return dict(pads=[("1", 0, 0, "rd", 2.2), ("2", 12, 0, "rd", 2.2)],
                body=("rect", 2.0, -1.9, 10.0, 1.9), kind="res2w")
def fp_cap():
    return dict(pads=[("1", 0, 0, "rd", 1.8), ("2", 4, 0, "rd", 1.8)],
                body=("rect", -0.9, -1.1, 4.9, 1.1), kind="cap")
def fp_ecap(pitch, r):
    return dict(pads=[("+", 0, 0, "sq", 1.9), ("-", pitch, 0, "rd", 1.9)],
                body=("circ", pitch / 2, 0, r), kind="ecap")
def fp_to220(names):
    return dict(pads=[(names[0], 0, 0, "sq", 2.0), (names[1], 2, 0, "rd", 2.0), (names[2], 4, 0, "rd", 2.0)],
                body=("rect", -1.95, -1.2, 5.95, 2.4), kind="to220",
                heatsink=("rect", -2.6, -9.5, 6.6, -1.2))
def fp_to92():
    return dict(pads=[("C", 0, 0, "rd", 1.6), ("B", 2, 0, "rd", 1.6), ("E", 4, 0, "rd", 1.6)],
                body=("rect", -0.4, -1.6, 4.4, 1.6), kind="to92")
def fp_relay():
    return dict(pads=[("COM", 0, 0, "sq", 2.6), ("C1", 2, -5, "rd", 2.2), ("C2", 2, 5, "rd", 2.2),
                      ("NC", 11, -5, "rd", 2.6), ("NO", 11, 5, "rd", 2.6)],
                body=("rect", -2.2, -6.1, 12.8, 6.1), kind="relay")
def fp_nano():
    top = ["VIN", "GND", "RST", "5V", "A7", "A6", "A5", "A4", "A3", "A2", "A1", "A0", "REF", "3V3", "D13"]
    bot = ["TX", "RX", "RST2", "GND2", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12"]
    pads = [(n, 2 * i, 0, "sq" if n == "VIN" else "rd", 1.8) for i, n in enumerate(top)]
    pads += [(n, 2 * i, 12, "rd", 1.8) for i, n in enumerate(bot)]
    return dict(pads=pads, body=("rect", -3.0, -1.4, 31.0, 13.4), kind="nano")
def fp_hdr(n, names):
    return dict(pads=[(names[i], 2 * i, 0, "sq" if i == 0 else "rd", 1.7) for i in range(n)],
                body=("rect", -1.0, -1.0, 2 * n - 1.0, 1.0), kind="hdr")
def fp_tact():
    return dict(pads=[("A", 0, 0, "rd", 1.9), ("A2", 5, 0, "rd", 1.9), ("B", 0, 4, "rd", 1.9), ("B2", 5, 4, "rd", 1.9)],
                body=("rect", 0.1, -0.4, 4.9, 4.4), kind="tact")
def fp_led():
    return dict(pads=[("A", 0, 0, "rd", 1.8), ("K", 2, 0, "sq", 1.8)],
                body=("circ", 1, 0, 1.97), kind="led")
def fp_buzzer():
    return dict(pads=[("+", 0, 0, "sq", 1.9), ("-", 6, 0, "rd", 1.9)],
                body=("circ", 3, 0, 4.7), kind="buzzer")
def fp_trim():
    return dict(pads=[("1", 0, 0, "sq", 1.8), ("2", 2, 0, "rd", 1.8), ("3", 4, 0, "rd", 1.8)],
                body=("rect", -1.6, -1.9, 5.6, 1.9), kind="trim")

# ---------- placement: ref, value, footprint, x, y, rot, {pad: net} ----------
P = []
def place(ref, value, fp, x, y, rot, nets, **kw):
    P.append(dict(ref=ref, value=value, fp=fp, x=x, y=y, rot=rot, nets=nets, **kw))

place("J1", "DC IN 18-19V", fp_tb2(), 5, 8, 0, {"1": "VRAW", "2": "GND"})
place("F1", "Fuse 2A", fp_fuse(), 11, 4, 0, {"1": "VRAW", "2": "VF"})
place("D1", "1N5408", fp_d_big(), 33, 3, 0, {"A": "VF", "K": "VIN"})
place("C1", "1000uF 35V", fp_ecap(4, 5.0), 40, 11, 0, {"+": "VIN", "-": "GND"})
place("U1", "LM7805", fp_to220(["IN", "GND", "OUT"]), 8, 24, 0, {"IN": "VIN", "GND": "GND", "OUT": "+5V"})
place("U2", "LM317T", fp_to220(["ADJ", "OUT", "IN"]), 22, 24, 0, {"ADJ": "ADJ", "OUT": "VREG", "IN": "VIN"})
place("C2", "0.33uF", fp_cap(), 7, 28, 90, {"1": "VIN", "2": "GND"})
place("C3", "0.1uF", fp_cap(), 13, 28, 90, {"1": "+5V", "2": "GND"})
place("C4", "100uF 16V", fp_ecap(2, 2.5), 16, 30, 0, {"+": "+5V", "-": "GND"})
place("R3", "240R", fp_res(), 20, 28, 90, {"1": "VREG", "2": "ADJ"})
place("R4", "2.2k", fp_res(), 24, 28, 90, {"1": "ADJ", "2": "ADJR"})
place("C5", "0.1uF", fp_cap(), 28, 28, 90, {"1": "VIN", "2": "GND"})
place("C6", "100uF 25V", fp_ecap(2, 2.5), 31, 28, 0, {"+": "VREG", "-": "GND"})
place("RV1", "1k (3296W)", fp_trim(), 24, 40, 0, {"1": "ADJR", "2": "GND", "3": "GND"})
place("RL1", "SRD-05VDC-SL-C", fp_relay(), 60, 12, 0,
      {"COM": "VREG", "C1": "+5V", "C2": "COIL", "NO": "RLNO"})
place("D2", "1N4007", fp_d(), 54, 14, 270, {"A": "COIL", "K": "+5V"})
place("Q1", "BC547", fp_to92(), 49, 19, 0, {"C": "COIL", "B": "QB", "E": "GND"})
place("R5", "1k", fp_res(), 46, 26, 270, {"1": "RLY", "2": "QB"})
place("D3", "1N5408", fp_d_big(), 76, 8, 90, {"A": "RLNO", "K": "BATP"})
place("J2", "BATTERY 12V", fp_tb2(), 76, 24, 0, {"1": "BATP", "2": "BATN"}, flip=True)
place("R10", "0.22R 2W", fp_res2w(), 76, 34, 180, {"1": "BATN", "2": "GND"})
place("R9", "10k", fp_res(), 55, 22, 90, {"1": "+5V", "2": "TSENSE"})
place("R6", "1k", fp_res(), 58, 22, 90, {"1": "BATN", "2": "ISENSE"})
place("C8", "0.1uF", fp_cap(), 61, 30, 270, {"1": "ISENSE", "2": "GND"})
place("R1", "10k", fp_res(), 64, 22, 90, {"1": "BATP", "2": "VSENSE"})
place("R2", "3.3k", fp_res(), 67, 30, 270, {"1": "VSENSE", "2": "GND"})
place("C7", "0.1uF", fp_cap(), 70, 30, 270, {"1": "VSENSE", "2": "GND"})
place("A1", "Arduino Nano V3", fp_nano(), 40, 38, 0,
      {"VIN": None, "GND": "GND", "5V": "+5V", "A0": "VSENSE", "A1": "ISENSE", "A2": "TSENSE",
       "A4": "SDA", "A5": "SCL", "GND2": "GND", "D2": "BTN1", "D3": "BTN2", "D5": "LEDR",
       "D6": "LEDG", "D7": "RLY", "D8": "BUZ"})
place("SW1", "START", fp_tact(), 39, 55, 0, {"A": "BTN1", "B": "GND"})
place("SW2", "MODE", fp_tact(), 47, 55, 0, {"A": "BTN2", "B": "GND"})
place("R7", "1k", fp_res(), 54, 53, 90, {"1": "LEDR", "2": "LR"})
place("LED1", "RED", fp_led(), 57, 59, 0, {"A": "LR", "K": "GND"})
place("R8", "1k", fp_res(), 62, 53, 90, {"1": "LEDG", "2": "LG"})
place("LED2", "GREEN", fp_led(), 64, 59, 0, {"A": "LG", "K": "GND"})
place("BZ1", "Buzzer 5V", fp_buzzer(), 69, 57, 0, {"+": "BUZ", "-": "GND"})
place("J4", "LCD I2C", fp_hdr(4, ["GND", "VCC", "SDA", "SCL"]), 8, 58, 0,
      {"GND": "GND", "VCC": "+5V", "SDA": "SDA", "SCL": "SCL"})
place("J3", "NTC 10k", fp_hdr(2, ["1", "2"]), 18, 58, 0, {"1": "TSENSE", "2": "GND"})

HOLES = [(3, 3), (77, 3), (3, 61), (77, 62)]

WIDE = {"GND": 1.0, "VIN": 1.2, "VRAW": 1.2, "VF": 1.2, "VREG": 1.2, "RLNO": 1.2, "BATP": 1.2, "BATN": 1.2,
        "+5V": 0.8}

def rot(dx, dy, r):
    for _ in range(r // 90):
        dx, dy = -dy, dx
    return dx, dy

# ---------- build pad table ----------
pads = []  # dict(ref, name, x, y, net, shape, size)
for c in P:
    fp = c["fp"]
    for (n, dx, dy, sh, sz) in fp["pads"]:
        rx, ry = rot(dx, dy, c["rot"])
        net = c["nets"].get(n)
        pads.append(dict(ref=c["ref"], name=n, x=c["x"] + rx, y=c["y"] + ry, net=net, shape=sh, size=sz))

# sanity: duplicate pad positions
seen = {}
for p in pads:
    k = (p["x"], p["y"])
    if k in seen:
        sys.exit(f"pad overlap {p['ref']}.{p['name']} with {seen[k]} at {k}")
    seen[k] = f"{p['ref']}.{p['name']}"
    if not (1 <= p["x"] <= W - 2 and 1 <= p["y"] <= H - 2):
        sys.exit(f"pad off board {p}")

nets = sorted({p["net"] for p in pads if p["net"]})
NID = {n: i for i, n in enumerate(nets)}
BLOCK = -2

occ = [[[-1] * W for _ in range(H)] for _ in range(2)]
keep = [[[set() for _ in range(W)] for _ in range(H)] for _ in range(2)]

def mark_keep(L, x, y, nid, rad8=True):
    for ddx in (-1, 0, 1):
        for ddy in (-1, 0, 1):
            if not rad8 and ddx and ddy:
                continue
            xx, yy = x + ddx, y + ddy
            if 0 <= xx < W and 0 <= yy < H:
                keep[L][yy][xx].add(nid)

for L in (0, 1):
    for x in range(W):
        occ[L][0][x] = occ[L][H - 1][x] = BLOCK
    for y in range(H):
        occ[L][y][0] = occ[L][y][W - 1] = BLOCK
    for (hx, hy) in HOLES:
        for x in range(hx - 2, hx + 3):
            for y in range(hy - 2, hy + 3):
                if 0 <= x < W and 0 <= y < H and (x - hx) ** 2 + (y - hy) ** 2 <= 6:
                    occ[L][y][x] = BLOCK

PADNID = {}
for p in pads:
    nid = NID[p["net"]] if p["net"] else 1000 + len(PADNID)
    PADNID[(p["x"], p["y"])] = nid
    for L in (0, 1):
        occ[L][p["y"]][p["x"]] = nid
        mark_keep(L, p["x"], p["y"], nid, True)
        # big pads (>=2.4mm) keep a wider ring
        if p["size"] >= 2.4:
            for ddx, ddy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                xx, yy = p["x"] + ddx, p["y"] + ddy
                if 0 <= xx < W and 0 <= yy < H:
                    keep[L][yy][xx].add(nid)

def passable(L, x, y, nid):
    o = occ[L][y][x]
    if o != -1 and o != nid:
        return False
    k = keep[L][y][x]
    return not (k and (len(k) > 1 or nid not in k))

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]

def route(nid, tree, targets, wide):
    """Dijkstra from tree cells (set of (L,x,y)) to any target cell (x,y), either layer."""
    dist = {}
    pq = []
    for (L, x, y) in tree:
        for d in range(4):
            st = (L, x, y, d)
            dist[st] = 0
            heapq.heappush(pq, (0, L, x, y, d))
    prev = {}
    goal = None
    while pq:
        cst, L, x, y, d = heapq.heappop(pq)
        if dist.get((L, x, y, d), 1e18) < cst:
            continue
        if (x, y) in targets:
            goal = (L, x, y, d)
            break
        # moves
        for nd, (dx, dy) in enumerate(DIRS):
            xx, yy = x + dx, y + dy
            if not (0 <= xx < W and 0 <= yy < H):
                continue
            if not passable(L, xx, yy, nid):
                continue
            # wide traces need side clearance too
            if wide:
                ok = True
                for sx, sy in ((dy, dx), (-dy, -dx)):
                    ax, ay = xx + sx, yy + sy
                    o = occ[L][ay][ax] if (0 <= ax < W and 0 <= ay < H) else BLOCK
                    if o >= 0 and o != nid:
                        ok = False
                if not ok:
                    continue
            pref = (dx != 0) if L == 0 else (dy != 0)
            step = 1.0 if pref else 1.8
            if nd != d:
                step += 0.6
            nc = cst + step
            st = (L, xx, yy, nd)
            if nc < dist.get(st, 1e18):
                dist[st] = nc
                prev[st] = (L, x, y, d)
                heapq.heappush(pq, (nc, L, xx, yy, nd))
        # via
        OL = 1 - L
        if occ[L][y][x] == -1 or occ[L][y][x] == nid:
            if passable(OL, x, y, nid) and via_ok(x, y, nid):
                nc = cst + 9
                st = (OL, x, y, d)
                if nc < dist.get(st, 1e18):
                    dist[st] = nc
                    prev[st] = (L, x, y, d)
                    heapq.heappush(pq, (nc, OL, x, y, d))
    if goal is None:
        return None
    path = []
    st = goal
    while st in prev:
        path.append(st[:3])
        st = prev[st]
    path.append(st[:3])
    return path[::-1]

def via_ok(x, y, nid):
    for L in (0, 1):
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                xx, yy = x + ddx, y + ddy
                o = occ[L][yy][xx]
                if o >= 0 and o != nid:
                    return False
    return True

order = ["GND", "VIN", "VRAW", "VF", "VREG", "RLNO", "BATP", "BATN", "+5V"]
rest = [n for n in nets if n not in order]
def span(n):
    ps = [p for p in pads if p["net"] == n]
    return (max(p["x"] for p in ps) - min(p["x"] for p in ps)) + (max(p["y"] for p in ps) - min(p["y"] for p in ps))
rest.sort(key=span)
ORDER = order + rest
if len(sys.argv) > 1:
    ORDER = sys.argv[1].split(",") + [n for n in ORDER if n not in sys.argv[1].split(",")]

traces = []  # (net, layer, [(x,y),...])
vias = []
failed = []
for net in ORDER:
    nid = NID[net]
    wide = net in WIDE
    npads = [p for p in pads if p["net"] == net]
    # start from pad closest to centroid
    tree = set()
    first = npads[0]
    tree |= {(0, first["x"], first["y"]), (1, first["x"], first["y"])}
    remaining = {(p["x"], p["y"]) for p in npads[1:]}
    while remaining:
        path = route(nid, tree, remaining, wide)
        if path is None:
            failed.append((net, sorted(remaining)))
            break
        end = path[-1]
        remaining.discard((end[1], end[2]))
        for (L, x, y) in path:
            tree.add((L, x, y))
        tree |= {(0, end[1], end[2]), (1, end[1], end[2])}
        # commit path
        seg = []
        for i, (L, x, y) in enumerate(path):
            if occ[L][y][x] == -1:
                occ[L][y][x] = nid
                if wide:
                    mark_keep(L, x, y, nid, rad8=False)
            if i and path[i - 1][0] != L:
                vias.append((x, y, net))
                for LL in (0, 1):
                    occ[LL][y][x] = nid
                    mark_keep(LL, x, y, nid, True)
        # split into per-layer polylines
        cur = [path[0]]
        for st in path[1:]:
            if st[0] != cur[-1][0]:
                if len(cur) > 1:
                    traces.append((net, cur[0][0], [(c[1], c[2]) for c in cur]))
                cur = [st]
            else:
                cur.append(st)
        if len(cur) > 1:
            traces.append((net, cur[0][0], [(c[1], c[2]) for c in cur]))

def simplify(pts):
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = out[-1], pts[i], pts[i + 1]
        if (b[0] - a[0]) * (c[1] - b[1]) == (b[1] - a[1]) * (c[0] - b[0]):
            continue
        out.append(b)
    out.append(pts[-1])
    return out

traces = [(n, L, simplify(pts)) for (n, L, pts) in traces]

# ---------- verify connectivity with union-find over copper cells ----------
parent = {}
def f(a):
    while parent.setdefault(a, a) != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a
def u(a, b):
    parent[f(a)] = f(b)
for (n, L, pts) in traces:
    for a, b in zip(pts, pts[1:]):
        x0, y0 = a; x1, y1 = b
        sx = (x1 > x0) - (x1 < x0); sy = (y1 > y0) - (y1 < y0)
        x, y = x0, y0
        while (x, y) != (x1, y1):
            u((L, x, y), (L, x + sx, y + sy)); x += sx; y += sy
for (x, y, n) in vias:
    u((0, x, y), (1, x, y))
for p in pads:
    u((0, p["x"], p["y"]), (1, p["x"], p["y"]))
# shorts: any copper cell belonging to 2 nets
cellnet = {}
short = []
for (n, L, pts) in traces:
    for a, b in zip(pts, pts[1:]):
        x0, y0 = a; x1, y1 = b
        sx = (x1 > x0) - (x1 < x0); sy = (y1 > y0) - (y1 < y0)
        x, y = x0, y0
        while True:
            k = (L, x, y)
            if cellnet.setdefault(k, n) != n: short.append((k, n, cellnet[k]))
            if (x, y) == (x1, y1): break
            x += sx; y += sy
for p in pads:
    for L in (0, 1):
        k = (L, p["x"], p["y"])
        if k in cellnet and p["net"] != cellnet[k]:
            short.append((k, p["net"], cellnet[k]))
unconn = []
for n in nets:
    roots = {f((0, p["x"], p["y"])) for p in pads if p["net"] == n}
    if len(roots) > 1:
        unconn.append(n)
print("nets", len(nets), "traces", len(traces), "vias", len(vias))
print("FAILED", failed)
print("UNCONNECTED", unconn)
print("SHORTS", short[:5])

out = dict(grid=G, w=W, h=H, holes=HOLES,
           comps=[dict(ref=c["ref"], value=c["value"], kind=c["fp"]["kind"], x=c["x"], y=c["y"], rot=c["rot"],
                       body=c["fp"]["body"], heatsink=c["fp"].get("heatsink"), flip=c.get("flip", False))
                  for c in P],
           pads=pads, traces=[dict(net=n, layer=L, pts=pts, w=WIDE.get(n, 0.5)) for (n, L, pts) in traces],
           vias=[dict(x=x, y=y, net=n) for (x, y, n) in vias])
import os
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pcb.json"), "w"))
