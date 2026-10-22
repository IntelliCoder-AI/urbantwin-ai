"""Generate a four-junction SUMO network, paired runs, and browser replay evidence.
Run: .venv/bin/python simulation/evaluate.py
All traffic is synthetic. No map or observed Bengaluru demand is used.
"""

import argparse
import hashlib
import json
import math
import random
import statistics
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import traci
import sumolib
from controller import Controller

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "public" / "data"
GEN = ROOT / "generated"
DT, DURATION, DEMAND_UNTIL = 0.5, 600, 300
SEEDS = [11, 22, 33, 44, 55]
SCENARIOS = ["normal", "rush", "incident"]
CENTERS = [(-45, 45), (45, 45), (-45, -45), (45, -45)]


def write_xml(root, path):
    ET.indent(root)
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)


def build_network():
    GEN.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    nodes = ET.Element("nodes")
    coords = {f"J{i}": p for i, p in enumerate(CENTERS)}
    paths = []
    # SUMO y is the inverse of the renderer's z. Left-hand traffic, straight routes only.
    for row, y in enumerate([45, -45]):
        coords[f"W{row}"], coords[f"E{row}"] = (-110, y), (110, y)
        paths.extend(
            [
                [f"W{row}", f"J{row*2}", f"J{row*2+1}", f"E{row}"],
                [f"E{row}", f"J{row*2+1}", f"J{row*2}", f"W{row}"],
            ]
        )
        x = [-45, 45][row]
        coords[f"N{row}"], coords[f"S{row}"] = (x, 110), (x, -110)
        paths.extend(
            [
                [f"N{row}", f"J{row}", f"J{row+2}", f"S{row}"],
                [f"S{row}", f"J{row+2}", f"J{row}", f"N{row}"],
            ]
        )
    for name, (x, y) in coords.items():
        ET.SubElement(
            nodes,
            "node",
            id=name,
            x=str(x),
            y=str(y),
            type="traffic_light" if name.startswith("J") else "priority",
        )
    edges = ET.Element("edges")
    connections = ET.Element("connections")
    seen = set()
    routes = []
    for path in paths:
        route = []
        for a, b in zip(path, path[1:]):
            e = f"{a}_{b}"
            route.append(e)
            if e not in seen:
                ET.SubElement(
                    edges,
                    "edge",
                    id=e,
                    **{"from": a, "to": b},
                    numLanes="1",
                    speed="10",
                    width="3.2",
                )
                seen.add(e)
        routes.append(route)
        for a, b in zip(route, route[1:]):
            ET.SubElement(
                connections,
                "connection",
                **{"from": a, "to": b},
                fromLane="0",
                toLane="0",
            )
    for element, name in [
        (nodes, "nodes.nod.xml"),
        (edges, "edges.edg.xml"),
        (connections, "connections.con.xml"),
    ]:
        write_xml(element, GEN / name)
    subprocess.run(
        [
            sumolib.checkBinary("netconvert"),
            "--node-files",
            str(GEN / "nodes.nod.xml"),
            "--edge-files",
            str(GEN / "edges.edg.xml"),
            "--connection-files",
            str(GEN / "connections.con.xml"),
            "--output-file",
            str(GEN / "district.net.xml"),
            "--lefthand",
            "true",
            "--offset.disable-normalization",
            "true",
            "--no-turnarounds",
            "true",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return routes


def demand_file(scenario, seed, routes):
    rng = random.Random(seed)
    demand = []
    for tick in range(int(DEMAND_UNTIL / DT)):
        for r in range(8):
            rate = 0.075 if scenario == "normal" else 0.22 if r % 4 < 2 else 0.055
            if rng.random() < rate * DT:
                demand.append({"id": str(len(demand)), "depart": tick * DT, "route": r})
    root = ET.Element("routes")
    ET.SubElement(
        root,
        "vType",
        id="car",
        accel="2.6",
        decel="4.5",
        emergencyDecel="9",
        sigma="0",
        length="4.2",
        minGap="2.5",
        maxSpeed="10",
        speedFactor="1",
        tau="1",
    )
    for r, edges in enumerate(routes):
        ET.SubElement(root, "route", id=f"r{r}", edges=" ".join(edges))
    for v in demand:
        ET.SubElement(
            root,
            "vehicle",
            id=v["id"],
            type="car",
            route=f"r{v['route']}",
            depart=str(v["depart"]),
            departLane="0",
            departSpeed="max",
        )
    path = GEN / f"{scenario}-{seed}.rou.xml"
    write_xml(root, path)
    return path, demand, hashlib.sha256(path.read_bytes()).hexdigest()


def run(scenario, seed, strategy, route_file, demand, record=False):
    label = f"{scenario}-{seed}-{strategy}"
    tripfile = GEN / f"{label}.tripinfo.xml"
    cmd = [
        sumolib.checkBinary("sumo"),
        "-n",
        str(GEN / "district.net.xml"),
        "-r",
        str(route_file),
        "--step-length",
        str(DT),
        "--seed",
        str(seed),
        "--no-step-log",
        "true",
        "--duration-log.disable",
        "true",
        "--time-to-teleport",
        "-1",
        "--collision.action",
        "warn",
        "--tripinfo-output",
        str(tripfile),
        "--tripinfo-output.write-unfinished",
        "true",
        "--no-warnings",
        "true",
    ]
    traci.start(cmd, label=label, stdout=subprocess.DEVNULL)
    conn = traci.getConnection(label)
    controls = [Controller(strategy) for _ in range(4)]
    lanes = []
    axes = []
    for i in range(4):
        links = conn.trafficlight.getControlledLinks(f"J{i}")
        ll = [link[0][0] for link in links]
        aa = []
        for lane in ll:
            shape = conn.lane.getShape(lane)
            dx = shape[-1][0] - shape[0][0]
            dy = shape[-1][1] - shape[0][1]
            aa.append(0 if abs(dx) > abs(dy) else 1)
        lanes.append(ll)
        axes.append(aa)
        conn.trafficlight.setRedYellowGreenState(f"J{i}", controls[i].state(aa))
    records = {}
    completed = set()
    frames = []
    collisions = 0
    teleports = 0
    queue_area = 0
    time = 0

    def metrics():
        released = [v for v in demand if v["depart"] < time]
        values = []
        waits = [[], [], [], []]
        pending = 0
        for v in released:
            rec = records.get(v["id"])
            if rec is None:
                pending += 1
                rec = {
                    "wait": max(0, time - v["depart"]),
                    "delay": max(0, time - v["depart"]),
                    "stops": 0,
                }
            values.append(rec)
            waits[v["route"] % 4].append(rec["wait"])
        n = len(values) or 1
        means = [sum(w) / len(w) if w else 0 for w in waits]
        present = [m for m, w in zip(means, waits) if w]
        sq = sum(m * m for m in present)
        return {
            "time": time,
            "waiting": sum(v["wait"] for v in values) / n,
            "delay": sum(v["delay"] for v in values) / n,
            "queue": sum(
                1 for v in conn.vehicle.getIDList() if conn.vehicle.getSpeed(v) < 0.1
            ),
            "throughput": len(completed),
            "stops": sum(v["stops"] for v in values),
            "worstWait": max([v["wait"] for v in values], default=0),
            "fairness": sum(present) ** 2 / (len(present) * sq) if sq else 1,
            "arrived": len(released),
            "unfinished": len(released) - len(completed),
            "pending": pending,
            "approachWait": means,
        }

    def pressures():
        qs = []
        old = []
        for ll, aa in zip(lanes, axes):
            q = [0, 0]
            o = [0, 0]
            for lane, axis in zip(ll, aa):
                length = conn.lane.getLength(lane)
                for v in conn.lane.getLastStepVehicleIDs(lane):
                    if length - conn.vehicle.getLanePosition(v) <= 65:
                        q[axis] += 1
                        o[axis] = max(o[axis], records.get(v, {}).get("wait", 0))
            qs.append(q)
            old.append(o)
        return qs, old

    def frame(q):
        cars = []
        for v in conn.vehicle.getIDList():
            x, y = conn.vehicle.getPosition(v)
            angle = conn.vehicle.getAngle(v) * math.pi / 180
            cars.append(
                {
                    "id": int(v),
                    "x": round(x, 2),
                    "z": round(-y, 2),
                    "angle": round(math.pi - angle, 4),
                    "speed": round(conn.vehicle.getSpeed(v), 2),
                }
            )
        return {
            "time": int(time),
            "vehicles": cars,
            "signals": [c.snapshot() for c in controls],
            "metrics": metrics(),
            "queues": q,
        }

    if record:
        frames.append(frame([[0, 0] for _ in range(4)]))
    scheduled = {v["id"]: v for v in demand}
    try:
        for tick in range(int(DURATION / DT)):
            if scenario == "incident" and time in (90, 180):
                conn.lane.setMaxSpeed("W0_J0_0", 0.1 if time == 90 else 10)
            conn.simulationStep()
            time = round(conn.simulation.getTime(), 1)
            for v in conn.vehicle.getIDList():
                if v not in records:
                    # SUMO actual departure is start of its first simulated step.
                    departure_delay = max(
                        0, conn.vehicle.getDeparture(v) - scheduled[v]["depart"]
                    )
                    records[v] = {
                        "wait": departure_delay,
                        "delay": departure_delay,
                        "stops": 0,
                        "stopped": False,
                        "departureDelay": departure_delay,
                    }
                rec = records[v]
                speed = conn.vehicle.getSpeed(v)
                stopped = speed < 0.1
                if stopped:
                    rec["wait"] += DT
                    if not rec["stopped"]:
                        rec["stops"] += 1
                rec["stopped"] = stopped
                rec["delay"] = rec["departureDelay"] + conn.vehicle.getTimeLoss(v)
            completed.update(conn.simulation.getArrivedIDList())
            collisions += conn.simulation.getCollidingVehiclesNumber()
            teleports += conn.simulation.getStartingTeleportNumber()
            queue_area += (
                sum(conn.vehicle.getSpeed(v) < 0.1 for v in conn.vehicle.getIDList())
                * DT
            )
            # Completed interval uses the prior state; the new state governs the next one.
            q, old = pressures()
            for i, c in enumerate(controls):
                c.update(q[i], old[i])
                state = c.state(axes[i])
                assert not (
                    "G" in [s for s, a in zip(state, axes[i]) if a == 0]
                    and "G" in [s for s, a in zip(state, axes[i]) if a == 1]
                )
                conn.trafficlight.setRedYellowGreenState(f"J{i}", state)
            if record and time % 1 == 0:
                frames.append(frame(q))
        final = metrics()
    finally:
        conn.close()
    assert collisions == 0, f"{label}: {collisions} colliding vehicles"
    assert teleports == 0, f"{label}: {teleports} teleports"
    return {
        "metrics": final,
        "meanQueue": queue_area / DURATION,
        "collisions": collisions,
        "teleports": teleports,
        **({"frames": frames} if record else {}),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    routes = build_network()
    results = []
    for scenario in SCENARIOS:
        runs = []
        for seed in ([42] if args.quick else SEEDS + [42]):
            path, demand, digest = demand_file(scenario, seed, routes)
            pair = {
                s: run(scenario, seed, s, path, demand, record=seed == 42)
                for s in ["fixed", "adaptive"]
            }
            row = {
                "seed": seed,
                "demandSHA256": digest,
                "scheduledVehicles": len(demand),
                **{
                    s: {k: v for k, v in pair[s].items() if k != "frames"} for s in pair
                },
            }
            if seed != 42:
                runs.append(row)
            if seed == 42:
                trace = {
                    "engine": "Eclipse SUMO",
                    "version": "1.28.0",
                    "duration": DURATION,
                    "config": {
                        "scenario": scenario,
                        "seed": 42,
                        "junctions": 4,
                        "demand": 1,
                        "duration": DURATION,
                        "demandUntil": DEMAND_UNTIL,
                    },
                    "demandSHA256": digest,
                    **pair,
                }
                (OUT / f"sumo-{scenario}-42.json").write_text(
                    json.dumps(trace, separators=(",", ":"))
                )
            print(
                f"{scenario} seed {seed}: fixed={pair['fixed']['metrics']['waiting']:.2f}s adaptive={pair['adaptive']['metrics']['waiting']:.2f}s",
                flush=True,
            )
        if runs:
            changes = [
                100
                * (
                    r["fixed"]["metrics"]["waiting"]
                    - r["adaptive"]["metrics"]["waiting"]
                )
                / r["fixed"]["metrics"]["waiting"]
                for r in runs
            ]
            mean = statistics.mean(changes)
            margin = 2.776 * statistics.stdev(changes) / math.sqrt(len(changes))
            results.append(
                {
                    "scenario": scenario,
                    "runs": runs,
                    "waitImprovementMean": mean,
                    "waitImprovement95CI": [mean - margin, mean + margin],
                }
            )
    if results:
        (OUT / "sumo-evaluation.json").write_text(
            json.dumps(
                {
                    "engine": "Eclipse SUMO",
                    "version": "1.28.0",
                    "seeds": SEEDS,
                    "duration": DURATION,
                    "demandUntil": DEMAND_UNTIL,
                    "results": results,
                },
                indent=2,
            )
        )
    print("Evidence written to public/data", flush=True)


if __name__ == "__main__":
    main()
