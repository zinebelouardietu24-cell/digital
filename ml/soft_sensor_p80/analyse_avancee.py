"""
Analyse avancée du capteur virtuel P80 (scénario A : capteurs en ligne uniquement).

Répond à trois questions qu'un exploitant se pose réellement :
  1. Le capteur virtuel fait-il mieux que la pratique actuelle, c'est-à-dire
     une analyse granulométrique de laboratoire toutes les 4 ou 8 heures ?
  2. Quelle confiance accorder à chaque estimation ? -> intervalle de
     prédiction à 90 % par prédiction conforme (split conformal).
  3. Le modèle reconnaît-il le type de minerai (les trois régimes de P80) ?

Usage :
    python ml/soft_sensor_p80/analyse_avancee.py
"""
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, r2_score
from xgboost import XGBRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_xgboost import (OUT_DIR, PROCESS_ONLINE, SEED, TARGET, chrono_split,  # noqa: E402
                           health_columns, load_dataset, tune_xgboost)

ALPHA = 0.10                      # intervalle de prédiction à 90 %
LAB_PERIODS_H = (4, 8)            # fréquences d'analyse de laboratoire comparées
LAB_DELAY_H = 1                   # délai entre prélèvement et résultat disponible
REGIME_BOUNDS = (139.5, 144.5)    # frontières entre les trois régimes de P80 (µm)
BLUE, GREY, ORANGE = "#1F4E79", "#888888", "#E65100"


def regime(values):
    return np.digitize(values, REGIME_BOUNDS)  # 0 = fin, 1 = moyen, 2 = grossier


def lab_baseline(y: pd.Series, test_index: pd.DatetimeIndex, period_h: int) -> pd.Series:
    """Pratique actuelle : un échantillon toutes les `period_h` heures, dont le
    résultat n'est connu qu'après `LAB_DELAY_H` heures ; entre deux résultats,
    l'opérateur se fie à la dernière valeur connue."""
    samples = y[y.index.hour % period_h == 0]
    samples = samples[samples.index.minute == 0]
    known = pd.Series(samples.values, index=samples.index + pd.Timedelta(hours=LAB_DELAY_H))
    return known.reindex(y.index.union(known.index)).ffill().reindex(test_index)


def main():
    df = load_dataset()
    features = PROCESS_ONLINE + health_columns(df)
    X, y = df[features].astype(float), df[TARGET].astype(float)
    tr, va, te = chrono_split(len(df))
    X_tr, y_tr, X_va, y_va, X_te, y_te = X.iloc[tr], y.iloc[tr], X.iloc[va], y.iloc[va], X.iloc[te], y.iloc[te]

    best = tune_xgboost(X_tr, y_tr, X_va, y_va)
    params = dict(n_estimators=best["n_estimators"], max_depth=best["max_depth"],
                  learning_rate=best["learning_rate"], subsample=best["subsample"],
                  colsample_bytree=0.8, min_child_weight=3, reg_lambda=1.0,
                  random_state=SEED, n_jobs=2)

    # --- 1. Prédiction conforme : calibrée sur la validation, jamais vue à l'entraînement.
    model = XGBRegressor(**params).fit(X_tr, y_tr)
    resid_cal = np.abs(y_va.values - model.predict(X_va))
    n_cal = len(resid_cal)
    q = float(np.quantile(resid_cal, min(1.0, np.ceil((n_cal + 1) * (1 - ALPHA)) / n_cal)))
    pred = model.predict(X_te)
    lower, upper = pred - q, pred + q
    covered = (y_te.values >= lower) & (y_te.values <= upper)

    # --- 2. Comparaison avec le laboratoire.
    sensor_mae = float(mean_absolute_error(y_te, pred))
    lab = {}
    lab_series = {}
    for period in LAB_PERIODS_H:
        base = lab_baseline(y, X_te.index, period)
        err = np.abs(y_te.values - base.values)
        lab_series[period] = base
        lab[f"{period}h"] = {
            "MAE_um": float(err.mean()),
            "erreur_max_um": float(err.max()),
            "part_erreur_sup_2um_pct": float((err > 2).mean() * 100),
            "regime_correct_pct": float((regime(base.values) == regime(y_te.values)).mean() * 100),
        }
    sensor_err = np.abs(y_te.values - pred)

    # --- 3. Régimes (types de minerai) et précision à l'intérieur d'un régime.
    true_reg, pred_reg = regime(y_te.values), regime(pred)
    regime_acc = float((true_reg == pred_reg).mean() * 100)
    conf = pd.crosstab(pd.Series(true_reg, name="réel"), pd.Series(pred_reg, name="estimé"))
    reg_mean = pd.Series(y_te.values).groupby(true_reg).transform("mean").values
    intra_r2 = float(r2_score(y_te.values - reg_mean, pred - reg_mean))
    seg = (pd.Series(regime(y.values)) != pd.Series(regime(y.values)).shift()).cumsum()
    regime_duration_h = float(seg.value_counts().mean() * 0.25)

    # --- 4. Importance par permutation (indépendante du modèle).
    perm = permutation_importance(model, X_te, y_te, n_repeats=10, random_state=SEED, scoring="r2")
    perm_imp = pd.Series(perm.importances_mean, index=features).sort_values(ascending=False)

    results = {
        "scenario": "A - capteurs en ligne",
        "test_period": [str(X_te.index[0]), str(X_te.index[-1])],
        "capteur_virtuel": {
            "MAE_um": sensor_mae,
            "erreur_max_um": float(sensor_err.max()),
            "part_erreur_sup_2um_pct": float((sensor_err > 2).mean() * 100),
            "regime_correct_pct": regime_acc,
        },
        "laboratoire": lab,
        "intervalle_90": {
            "demi_largeur_um": q,
            "couverture_test_pct": float(covered.mean() * 100),
            "n_calibration": n_cal,
        },
        "regimes": {
            "frontieres_um": REGIME_BOUNDS,
            "duree_moyenne_regime_h": regime_duration_h,
            "matrice_confusion": conf.to_dict(),
            "R2_intra_regime": intra_r2,
        },
        "importance_permutation_top10": perm_imp.head(10).round(4).to_dict(),
    }
    (OUT_DIR / "analyse_avancee.json").write_text(json.dumps(results, indent=2, ensure_ascii=False),
                                                 encoding="utf-8")

    # --- Figures
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})

    # a) capteur virtuel + intervalle vs laboratoire toutes les 8 h, sur 48 h
    window = slice(X_te.index[0], X_te.index[0] + pd.Timedelta(hours=48))
    yt, pt = y_te[window], pd.Series(pred, index=X_te.index)[window]
    lo, up = pd.Series(lower, index=X_te.index)[window], pd.Series(upper, index=X_te.index)[window]
    lab8 = lab_series[8][window]
    fig, ax = plt.subplots(figsize=(9, 3.6))
    ax.fill_between(pt.index, lo, up, color=BLUE, alpha=0.15, lw=0, label="Intervalle à 90 %")
    ax.plot(yt.index, yt, color="black", lw=1.1, label="P80 réel")
    ax.plot(pt.index, pt, color=BLUE, lw=1.3, label="Capteur virtuel (XGBoost)")
    ax.step(lab8.index, lab8, where="post", color=ORANGE, lw=1.6, ls="--", label="Laboratoire (toutes les 8 h)")
    ax.set_ylabel("P80 (µm)")
    ax.legend(loc="upper center", ncol=4, fontsize=8, frameon=False, bbox_to_anchor=(0.5, 1.13))
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(OUT_DIR / "p80_capteur_vs_labo.png", dpi=200)
    plt.close(fig)

    # b) MAE : capteur virtuel vs laboratoire
    labels = ["Laboratoire\ntoutes les 8 h", "Laboratoire\ntoutes les 4 h", "Capteur virtuel\n(continu)"]
    values = [lab["8h"]["MAE_um"], lab["4h"]["MAE_um"], sensor_mae]
    fig, ax = plt.subplots(figsize=(6, 3.4))
    bars = ax.bar(labels, values, color=[ORANGE, ORANGE, BLUE], width=0.55)
    for b, v in zip(bars, values):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.05, f"{v:.2f} µm", ha="center", fontsize=9)
    ax.set_ylabel("Erreur absolue moyenne (µm)")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "p80_mae_labo_vs_capteur.png", dpi=200)
    plt.close(fig)

    print(json.dumps(results, indent=2, ensure_ascii=False))
    ajouter_intervalle_au_modele_servi(df)


def ajouter_intervalle_au_modele_servi(df: pd.DataFrame):
    """Calcule l'intervalle conforme à 90 % du modèle servi par le backend
    (scénario B) et l'enregistre dans son fichier, pour l'afficher sur le site."""
    import joblib
    from train_xgboost import DATA_DIR, FEED_CHARACTERISATION

    features = PROCESS_ONLINE + health_columns(df) + FEED_CHARACTERISATION
    X, y = df[features].astype(float), df[TARGET].astype(float)
    tr, va, te = chrono_split(len(df))
    best = tune_xgboost(X.iloc[tr], y.iloc[tr], X.iloc[va], y.iloc[va])
    model = XGBRegressor(n_estimators=best["n_estimators"], max_depth=best["max_depth"],
                         learning_rate=best["learning_rate"], subsample=best["subsample"],
                         colsample_bytree=0.8, min_child_weight=3, reg_lambda=1.0,
                         random_state=SEED, n_jobs=2).fit(X.iloc[tr], y.iloc[tr])
    resid = np.abs(y.iloc[va].values - model.predict(X.iloc[va]))
    n = len(resid)
    q = float(np.quantile(resid, min(1.0, np.ceil((n + 1) * (1 - ALPHA)) / n)))
    pred = model.predict(X.iloc[te])
    couverture = float((np.abs(y.iloc[te].values - pred) <= q).mean() * 100)

    for path in (OUT_DIR / "xgb_soft_sensor_p80.joblib", DATA_DIR / "models" / "xgb_soft_sensor_p80.joblib"):
        if path.exists():
            bundle = joblib.load(path)
            bundle["interval_90_um"] = round(q, 3)
            bundle["interval_90_coverage_test_pct"] = round(couverture, 1)
            joblib.dump(bundle, path)
    print(f"Modèle servi (scénario B) : intervalle 90 % = ±{q:.2f} µm, couverture test = {couverture:.1f} %")


if __name__ == "__main__":
    main()
