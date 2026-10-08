"""
Réévaluation du simulateur What-If (forêt aléatoire multi-sorties du backend).

Le backend évalue le modèle par découpage ALÉATOIRE 80/20 de la table fusionnée
à la minute. Or chaque mesure procédé (15 min) y est recopiée sur 15 lignes :
des lignes quasi identiques se retrouvent à la fois dans l'entraînement et dans
le test, ce qui gonfle le R². On compare ici trois protocoles :
  1. aléatoire, à la minute (protocole actuel du backend) ;
  2. aléatoire, au pas de 15 min (une ligne par mesure procédé) ;
  3. chronologique, au pas de 15 min : 80 % les plus anciens pour apprendre,
     20 % les plus récents pour tester (le seul qui imite l'usage réel).

Usage :
    python ml/whatif_evaluation/evaluer_whatif.py
"""
import ast
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]


def _constantes_backend():
    """Lit INPUT_COLUMNS et OUTPUT_GROUPS dans le service What-If, sans importer
    le backend (évite d'imposer sa version de Python et ses dépendances)."""
    source = (ROOT / "backend" / "app" / "domains" / "whatif" / "service.py").read_text(encoding="utf-8")
    valeurs = {}
    for noeud in ast.parse(source).body:
        if isinstance(noeud, ast.Assign) and isinstance(noeud.targets[0], ast.Name):
            nom = noeud.targets[0].id
            if nom in ("INPUT_COLUMNS", "OUTPUT_GROUPS"):
                valeurs[nom] = ast.literal_eval(noeud.value)
    return valeurs["INPUT_COLUMNS"], valeurs["OUTPUT_GROUPS"]


INPUT_COLUMNS, OUTPUT_GROUPS = _constantes_backend()
OUTPUT_COLUMNS = [c for cols in OUTPUT_GROUPS.values() for c in cols]

DATA_DIR = ROOT / "data"
OUT_DIR = Path(__file__).resolve().parent / "results"
OUT_DIR.mkdir(parents=True, exist_ok=True)
SEED = 42


def table_minute() -> pd.DataFrame:
    """Même fusion que CSVDataProvider : santé (1 min) + dernière mesure procédé connue."""
    p = pd.read_csv(DATA_DIR / "process_flow_timeseries.csv")
    h = pd.read_csv(DATA_DIR / "machine_health_timeseries.csv")
    p["dt"], h["dt"] = pd.to_datetime(p["Timestamp"]), pd.to_datetime(h["Timestamp"])
    m = pd.merge_asof(h.sort_values("dt"), p.drop(columns=["RecordNo"]).sort_values("dt"),
                      on="dt", suffixes=("", "_process"), direction="backward")
    return m.set_index("dt").fillna(0.0)


def foret():
    return RandomForestRegressor(n_estimators=100, max_depth=22, min_samples_leaf=2,
                                 random_state=SEED, n_jobs=2)


def evaluer(X_tr, X_te, y_tr, y_te) -> pd.Series:
    model = foret().fit(X_tr, y_tr)
    pred = model.predict(X_te)
    return pd.Series(r2_score(y_te, pred, multioutput="raw_values"), index=OUTPUT_COLUMNS)


def main():
    m = table_minute()
    q = m[m.index.minute % 15 == 0]           # une ligne par mesure procédé
    protocoles = {}

    X, y = m[INPUT_COLUMNS].astype(float), m[OUTPUT_COLUMNS].astype(float)
    protocoles["aleatoire_minute"] = evaluer(*train_test_split(X, y, test_size=0.2, random_state=SEED))

    X, y = q[INPUT_COLUMNS].astype(float), q[OUTPUT_COLUMNS].astype(float)
    protocoles["aleatoire_15min"] = evaluer(*train_test_split(X, y, test_size=0.2, random_state=SEED))

    cut = int(len(q) * 0.8)
    protocoles["chronologique_15min"] = evaluer(X.iloc[:cut], X.iloc[cut:], y.iloc[:cut], y.iloc[cut:])

    df = pd.DataFrame(protocoles)
    groupe = {c: g for g, cols in OUTPUT_GROUPS.items() for c in cols}
    df["groupe"] = df.index.map(groupe)
    synthese = {
        p: {"R2_median": float(df[p].median()), "R2_moyen": float(df[p].mean()),
            "sorties_R2_sup_0.9": int((df[p] > 0.9).sum()), "sorties_R2_inf_0.5": int((df[p] < 0.5).sum())}
        for p in protocoles
    }
    par_groupe = df.groupby("groupe")[list(protocoles)].median().round(3).to_dict(orient="index")
    resultats = {"n_sorties": len(OUTPUT_COLUMNS), "synthese": synthese, "R2_median_par_groupe": par_groupe,
                 "R2_par_sortie": df[list(protocoles)].round(3).to_dict(orient="index"),
                 "periode_test_chrono": [str(q.index[cut]), str(q.index[-1])]}
    (OUT_DIR / "whatif_evaluation.json").write_text(json.dumps(resultats, indent=2, ensure_ascii=False),
                                                    encoding="utf-8")

    # Figure : R² par sortie, protocole actuel vs chronologique.
    plt.rcParams.update({"font.size": 8, "axes.spines.top": False, "axes.spines.right": False})
    ordre = df.sort_values("chronologique_15min").index
    fig, ax = plt.subplots(figsize=(8, 6))
    yy = np.arange(len(ordre))
    ax.barh(yy + 0.2, df.loc[ordre, "aleatoire_minute"].clip(lower=-0.2), 0.4, color="#BBBBBB",
            label="Découpage aléatoire à la minute (protocole initial)")
    ax.barh(yy - 0.2, df.loc[ordre, "chronologique_15min"].clip(lower=-0.2), 0.4, color="#1F4E79",
            label="Découpage chronologique (période future)")
    ax.set_yticks(yy)
    ax.set_yticklabels(ordre)
    ax.axvline(0, color="black", lw=0.6)
    ax.set_xlabel("R² sur le jeu de test")
    ax.legend(loc="lower center", bbox_to_anchor=(0.4, 1.0), ncol=2, frameon=False)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "whatif_r2_protocoles.png", dpi=200)
    plt.close(fig)

    print(json.dumps({"synthese": synthese, "par_groupe": par_groupe}, indent=2, ensure_ascii=False))
    print(df.round(3).to_string())


if __name__ == "__main__":
    main()
