"""
Évaluation de l'outil de détection et de diagnostic des défauts.

1. Fonctionnement normal : on applique les règles à chaque minute du mois de
   juillet et on liste toutes les alarmes déclenchées. Une alarme sans défaut
   réel derrière elle est une fausse alarme.
2. Défauts injectés : à 300 instants tirés au hasard, on injecte chaque défaut
   et on vérifie que l'outil le détecte et lui donne le bon nom, sans annoncer
   d'autre défaut.

Usage :
    python ml/detection_defauts/evaluer_detection.py
"""
import importlib.util
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)
FAULTS_DIR = ROOT / "backend" / "app" / "domains" / "faults"


def charger_module(nom):
    spec = importlib.util.spec_from_file_location(nom, FAULTS_DIR / f"{nom}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rules = charger_module("rules")
scenarios = charger_module("scenarios")


def episodes(serie_bool: pd.Series):
    """Regroupe les minutes consécutives en alarme en épisodes (début, fin, durée)."""
    out = []
    debut = None
    prev = None
    for t, actif in serie_bool.items():
        if actif and debut is None:
            debut = t
        if not actif and debut is not None:
            out.append((debut, prev))
            debut = None
        prev = t
    if debut is not None:
        out.append((debut, prev))
    return out


def main():
    h = pd.read_csv(ROOT / "data" / "machine_health_timeseries.csv", parse_dates=["Timestamp"]).set_index("Timestamp")
    # Comme dans le backend : médiane glissante des dernières minutes.
    data = h[rules.RULE_COLUMNS].astype(float).rolling(rules.FENETRE_MIN, min_periods=1).median()
    records = data.to_dict(orient="records")

    # ---------------------------------------------------- 1. fonctionnement normal
    actifs = {r["id"]: [] for r in rules.RULES}
    niveaux = {r["id"]: [] for r in rules.RULES}
    precedents = set()
    for rec in records:
        found = {f["id"]: f["level"] for f in rules.diagnose(rec, precedents)}
        precedents = set(found)
        for rid in actifs:
            actifs[rid].append(rid in found)
            niveaux[rid].append(found.get(rid))
    normal = {}
    for rid, flags in actifs.items():
        serie = pd.Series(flags, index=data.index)
        eps = episodes(serie)
        if eps:
            normal[rid] = [{"debut": str(a), "fin": str(b),
                            "duree_min": int((b - a).total_seconds() / 60) + 1,
                            "niveau_max": "alarme" if "alarme" in [niveaux[rid][i] for i in
                                                                   np.where((data.index >= a) & (data.index <= b))[0]] else "alerte"}
                           for a, b in eps]
    minutes_en_alarme = int(np.any(np.array(list(actifs.values())), axis=0).sum())

    # ---------------------------------------------------- 2. défauts injectés
    rng = np.random.default_rng(42)
    idx = rng.choice(len(records), size=300, replace=False)
    resultats = {}
    confusion = {}
    for sc in scenarios.SCENARIOS:
        detecte = correct = 0
        annonces = {}
        for i in idx:
            base = {f["id"] for f in rules.diagnose(records[i])}
            found = {f["id"] for f in rules.diagnose(scenarios.apply(records[i], sc))}
            nouveaux = found - base
            if set(sc["expected"]) <= found:
                detecte += 1
                if not (nouveaux - set(sc["expected"])):
                    correct += 1
            for rid in nouveaux:
                annonces[rid] = annonces.get(rid, 0) + 1
        resultats[sc["id"]] = {"nom": sc["name"], "attendu": sc["expected"],
                               "taux_detection_pct": round(detecte / len(idx) * 100, 1),
                               "taux_bon_diagnostic_pct": round(correct / len(idx) * 100, 1)}
        confusion[sc["name"]] = annonces

    rapport = {
        "periode": [str(data.index[0]), str(data.index[-1])], "minutes": len(records),
        "nb_regles": len(rules.RULES),
        "fonctionnement_normal": {"episodes_par_regle": normal, "minutes_avec_au_moins_un_defaut": minutes_en_alarme},
        "defauts_injectes": {"instants_testes": len(idx), "par_scenario": resultats},
    }
    (OUT_DIR / "evaluation_detection.json").write_text(json.dumps(rapport, indent=2, ensure_ascii=False),
                                                      encoding="utf-8")

    # ---------------------------------------------------- figure : frise du mois de juillet
    plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False})
    ids = [r["id"] for r in rules.RULES]
    noms = [f"{r['equipment_name']} : {r['fault'].split(' (')[0]}" for r in rules.RULES]
    fig, ax = plt.subplots(figsize=(9, 3.8))
    for k, rid in enumerate(ids):
        lv = pd.Series(niveaux[rid], index=data.index)
        for lvl, col in (("alerte", "#F59E0B"), ("alarme", "#DC2626")):
            m = (lv == lvl).values
            if m.any():
                ax.scatter(data.index[m], np.full(m.sum(), k), s=6, color=col, marker="|")
    ax.set_yticks(range(len(ids)))
    ax.set_yticklabels(noms, fontsize=7)
    ax.set_ylim(-0.6, len(ids) - 0.4)
    ax.invert_yaxis()
    ax.scatter([], [], color="#F59E0B", marker="s", label="Alerte")
    ax.scatter([], [], color="#DC2626", marker="s", label="Alarme")
    ax.legend(loc="lower right", fontsize=8, frameon=False)
    import matplotlib.dates as mdates
    ax.set_xlim(data.index[0], data.index[-1])
    ax.xaxis.set_major_locator(mdates.DayLocator(bymonthday=[1, 5, 10, 15, 20, 25, 30]))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.grid(axis="x", color="#EEEEEE")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "frise_defauts_juillet.png", dpi=200)
    plt.close(fig)

    print(json.dumps(rapport, indent=2, ensure_ascii=False))
    print("Confusion (défauts annoncés en plus de ceux déjà présents) :")
    for k, v in confusion.items():
        print(" ", k, v)


if __name__ == "__main__":
    main()
